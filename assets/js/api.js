/* ==========================================================================
   Travosca — API client (window.TravoscaAPI)
   Talks to the zero-dependency Node backend when the site is served by it
   (node server/server.js).  When the folder is opened without a server
   (file://, GitHub Pages, python3 -m http.server) every call resolves with
   { ok:false, status:0 } and pages fall back to the local experience driven
   by assets/js/data.js.

   - 4 second timeout per request (AbortController)
   - hard `typeof fetch !== 'function'` guard so jsdom / file:// degrade softly
   - cookie-free analytics: track('pageview'|'click'|'click_outbound', …)
   - lastBooking memory in localStorage for the checkout return block
   ========================================================================== */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[src$="api.js"]');
  var src = script ? script.getAttribute('src') : '../assets/js/api.js';
  var base = src.replace(/assets\/js\/api\.js.*$/, '') || '../';

  var API_BASE = base + 'api/';
  var TIMEOUT_MS = 4000;
  var STORAGE = {
    lastBooking: 'travosca:lastBooking',
    lastEmail: 'travosca:lastEmail'
  };

  var hasFetch = (typeof fetch === 'function') && (typeof AbortController === 'function');

  function storageGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
  }

  /* ------------------------------------------------------------ transport */
  function request(method, path, body, opts) {
    opts = opts || {};
    if (!hasFetch) {
      return Promise.resolve({ ok: false, status: 0, error: 'no_fetch', offline: true });
    }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var url = path.indexOf('http') === 0 ? path : API_BASE + path.replace(/^\/+/, '');
    var headers = { 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });

    var init = {
      method: method,
      headers: headers,
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    return new Promise(function (resolve) {
      if (controller) {
        timer = setTimeout(function () { controller.abort(); }, opts.timeout || TIMEOUT_MS);
      }
      fetch(url, init).then(function (res) {
        clearTimeout(timer);
        res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          resolve({ ok: res.ok, status: res.status, data: data, offline: false });
        }).catch(function () {
          resolve({ ok: false, status: res.status, data: null, offline: false });
        });
      }).catch(function () {
        clearTimeout(timer);
        resolve({ ok: false, status: 0, error: 'network', offline: true });
      });
    });
  }

  /* --------------------------------------------------------- status banner */
  var bannerEl = null;
  function banner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.className = 'api-status';
    bannerEl.setAttribute('role', 'status');
    bannerEl.setAttribute('aria-live', 'polite');
    bannerEl.hidden = true;
    document.body.appendChild(bannerEl);
    return bannerEl;
  }

  function setError(message) {
    if (!document.body) return;
    var el = banner();
    el.textContent = message;
    el.hidden = false;
  }

  function clearError() {
    if (bannerEl) bannerEl.hidden = true;
  }

  /* ------------------------------------------------------------ last booking */
  function rememberBooking(booking) {
    var slim = {
      ref: booking.ref,
      total: booking.total,
      status: booking.status,
      tripId: booking.tripId,
      tripTitle: booking.tripTitle || '',
      date: booking.date || '',
      people: booking.people || 1,
      name: booking.name || '',
      email: booking.email || '',
      checkoutUrl: booking.checkoutUrl || '',
      savedAt: new Date().toISOString()
    };
    storageSet(STORAGE.lastBooking, slim);
    if (slim.email) storageSet(STORAGE.lastEmail, slim.email);
    return slim;
  }

  function lastBooking() {
    return storageGet(STORAGE.lastBooking, null);
  }

  function lastEmail() {
    return storageGet(STORAGE.lastEmail, '') || (lastBooking() || {}).email || '';
  }

  /* ---------------------------------------------------------------- health */
  var availability = null;
  function ready(force) {
    if (availability !== null && !force) return availability;
    availability = request('GET', 'health', undefined, { timeout: 2500 }).then(function (res) {
      return Boolean(res && res.ok && res.data && res.data.ok);
    });
    return availability;
  }

  /* -------------------------------------------------------------- tracking */
  function track(type, data) {
    if (!hasFetch) return;
    ready().then(function (online) {
      if (!online) return;
      request('POST', 'events', {
        type: type,
        path: (location.pathname || '').replace(/^.*?([^/]*\/?)$/, function (m) { return m; }) || '/',
        data: data || {}
      }).catch(function () { /* never break the page */ });
    });
  }

  function trackClicks() {
    document.addEventListener('click', function (e) {
      var tracked = e.target.closest ? e.target.closest('[data-track]') : null;
      if (tracked) {
        track('click', { label: tracked.getAttribute('data-track') || tracked.tagName.toLowerCase() });
        return;
      }
      var anchor = e.target.closest ? e.target.closest('a[href]') : null;
      if (anchor) {
        var href = anchor.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0) {
          track('click_outbound', { label: href.slice(0, 160) });
        }
      }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    trackClicks();
    ready().then(function (online) {
      if (online) {
        clearError();
        track('pageview', { title: document.title });
      } else {
        setError('Travosca backend not reachable — running in local mode. ' +
          'Content loads from assets/js/data.js and forms confirm locally.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }

  window.TravoscaAPI = {
    base: base,
    apiBase: API_BASE,
    hasFetch: hasFetch,
    ready: ready,
    get: function (path, opts) { return request('GET', path, undefined, opts); },
    post: function (path, body, opts) { return request('POST', path, body, opts); },
    put: function (path, body, opts) { return request('PUT', path, body, opts); },
    patch: function (path, body, opts) { return request('PATCH', path, body, opts); },
    del: function (path, opts) { return request('DELETE', path, undefined, opts); },
    track: track,
    setError: setError,
    clearError: clearError,
    rememberBooking: rememberBooking,
    lastBooking: lastBooking,
    lastEmail: lastEmail
  };
})();
