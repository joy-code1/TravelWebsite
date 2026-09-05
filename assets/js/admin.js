/* ==========================================================================
   Travosca — admin console behaviour (/admin/)
   Token login, tabs, CMS editing (PUT /api/content), bookings management
   (PATCH /api/bookings/:ref), leads, newsletter, analytics, CSV export.
   Zero dependencies: talks to the API through window.TravoscaAPI.
   ========================================================================== */
(function () {
  'use strict';

  var API = window.TravoscaAPI;
  var TOKEN_KEY = 'travosca:adminToken';
  var token = '';
  var content = null;
  var cache = { bookings: [], leads: [], subscribers: [], stats: null };

  try { token = window.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { token = ''; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function headers() { return { 'x-admin-token': token }; }

  function flash(message, isError) {
    $$('.admin__flash').forEach(function (el) { el.remove(); });
    var el = document.createElement('div');
    el.className = 'admin__flash' + (isError ? ' is-error' : '');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  /* ---------------------------------------------------------------- login */
  function showPanel(name) {
    $('[data-panel="login"]').hidden = name !== 'login';
    $$('[data-panel]').forEach(function (p) {
      if (p.getAttribute('data-panel') !== 'login') p.hidden = p.getAttribute('data-panel') !== name;
    });
    $$('.admin__nav-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === name);
    });
  }

  function initLogin() {
    var form = $('[data-login-form]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      token = ($('#admin-token') || {}).value || '';
      API.get('stats', { headers: headers() }).then(function (res) {
        if (res.ok) {
          try { window.localStorage.setItem(TOKEN_KEY, token); } catch (err) { /* ok */ }
          $('[data-login-error]').hidden = true;
          enter();
        } else {
          var err = $('[data-login-error]');
          err.textContent = res.status === 401 ? 'Wrong token (HTTP 401).' : 'Server error ' + res.status + '.';
          err.hidden = false;
        }
      });
    });

    var logout = $('[data-logout]');
    if (logout) {
      logout.addEventListener('click', function () {
        try { window.localStorage.removeItem(TOKEN_KEY); } catch (err) { /* ok */ }
        token = '';
        location.reload();
      });
    }
  }

  function enter() {
    $('[data-logout]').hidden = false;
    showPanel('overview');
    loadOverview();
  }

  /* -------------------------------------------------------------- tables */
  function statusBadge(status) {
    return '<span class="badge badge--' + esc(status) + '">' + esc(status) + '</span>';
  }

  function table(el, head, rows) {
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<tbody><tr><td colspan="' + head.length + '">No records yet.</td></tr></tbody>';
      return;
    }
    el.innerHTML = '<thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody>';
  }

  /* ------------------------------------------------------------ overview */
  function loadOverview() {
    API.get('stats', { headers: headers() }).then(function (res) {
      if (!res.ok) {
        if (res.status === 401) { showPanel('login'); return; }
        flash('Could not load stats: HTTP ' + res.status, true);
        return;
      }
      var s = res.data;
      cache.stats = s;
      var totals = s.totals;

      $('[data-stat-cards]').innerHTML =
        stat(totals.bookings, 'bookings') +
        stat('$' + totals.revenue, 'revenue (paid)') +
        stat(totals.leads, 'leads') +
        stat(totals.subscribers, 'subscribers') +
        stat(totals.pageviews, 'pageviews') +
        stat(totals.comments, 'comments');

      function stat(value, label) {
        return '<div class="stat"><p class="stat__value">' + esc(value) + '</p><p class="stat__label">' + esc(label) + '</p></div>';
      }

      $('[data-funnel]').innerHTML =
        '<li><span>Pageviews</span><strong>' + s.funnel.pageviews + '</strong></li>' +
        '<li><span>Bookings created</span><strong>' + s.funnel.bookingsCreated + '</strong></li>' +
        '<li><span>Paid bookings</span><strong>' + s.funnel.paidBookings + '</strong></li>' +
        '<li><span>Conversion (paid / views)</span><strong>' + s.funnel.conversionRate + '%</strong></li>';

      table($('[data-top-pages]'), ['Page', 'Views'], s.topPages.map(function (p) {
        return '<tr><td>' + esc(p.path) + '</td><td>' + p.views + '</td></tr>';
      }));
      table($('[data-top-pages2]'), ['Page', 'Views'], s.topPages.map(function (p) {
        return '<tr><td>' + esc(p.path) + '</td><td>' + p.views + '</td></tr>';
      }));
      table($('[data-top-trips]'), ['Trip', 'Bookings'], s.topTrips.map(function (p) {
        return '<tr><td>' + esc(p.title) + '</td><td>' + p.bookings + '</td></tr>';
      }));
      var sys = s.system;
      table($('[data-system]'), ['Check', 'Value'], [
        '<tr><td>Payments</td><td>' + esc(sys.payments) + '</td></tr>',
        '<tr><td>CRM webhook</td><td>' + (sys.crm ? 'configured' : 'off') + '</td></tr>',
        '<tr><td>Stripe webhook secret</td><td>' + (sys.webhookSecret ? 'configured' : 'off') + '</td></tr>',
        '<tr><td>Content updated</td><td>' + esc(sys.contentUpdated || '—') + '</td></tr>',
        '<tr><td>Node</td><td>' + esc(sys.node) + '</td></tr>',
        '<tr><td>Uptime</td><td>' + sys.uptime + ' s</td></tr>'
      ]);
      table($('[data-recent-events]'), ['Time', 'Type', 'Path', 'Label'], s.recentEvents.map(function (e) {
        return '<tr><td>' + esc(e.ts) + '</td><td>' + esc(e.type) + '</td><td>' + esc(e.path) + '</td><td>' + esc(e.label || (e.data && e.data.label) || '') + '</td></tr>';
      }));
    });
  }

  /* --------------------------------------------------------------- trips */
  function loadContent() {
    return API.get('content').then(function (res) {
      if (!res.ok) { flash('Could not load content: HTTP ' + res.status, true); return; }
      content = res.data;
      renderSettings();
      renderTrips();
    });
  }

  function renderSettings() {
    $$('[data-set]').forEach(function (input) {
      input.value = (content.settings && content.settings[input.getAttribute('data-set')]) || '';
    });
  }

  function renderTrips() {
    var wrap = $('[data-trip-list]');
    if (!wrap) return;
    wrap.innerHTML = (content.destinations || []).map(function (d, i) {
      function f(name) { return esc(d[name]); }
      return '<div class="trip-edit" data-trip-index="' + i + '">' +
        '<div class="trip-edit__head"><h3>' + esc(d.title) + ' <small>(' + esc(d.id) + ')</small></h3>' +
          '<button class="btn btn--outline btn--sm" type="button" data-remove-trip="' + i + '">Remove</button></div>' +
        '<div class="form-grid">' +
          '<label>id (slug) <input class="input" data-f="id" value="' + f('id') + '"></label>' +
          '<label>Title <input class="input" data-f="title" value="' + f('title') + '"></label>' +
          '<label>Country <input class="input" data-f="country" value="' + f('country') + '"></label>' +
          '<label>Region (Asia/Europe) <input class="input" data-f="region" value="' + f('region') + '"></label>' +
          '<label>Price (USD) <input class="input" data-f="price" type="number" min="1" step="1" value="' + f('price') + '"></label>' +
          '<label>Days <input class="input" data-f="days" type="number" min="1" step="1" value="' + f('days') + '"></label>' +
          '<label>Rating (0–5) <input class="input" data-f="rating" type="number" min="0" max="5" step="0.1" value="' + f('rating') + '"></label>' +
          '<label>Reviews <input class="input" data-f="reviews" type="number" min="0" step="1" value="' + f('reviews') + '"></label>' +
          '<label>Photo (file) <input class="input" data-f="photo" value="' + f('photo') + '"></label>' +
          '<label>Photo small (file) <input class="input" data-f="photoSm" value="' + f('photoSm') + '"></label>' +
          '<label class="field--full">Tag <input class="input" data-f="tag" value="' + f('tag') + '"></label>' +
          '<label class="field--full">Excerpt <textarea class="textarea" data-f="excerpt" rows="2">' + f('excerpt') + '</textarea></label>' +
          '<label class="field--full">Highlights (one per line) <textarea class="textarea" data-f="highlights" rows="4">' +
            esc((d.highlights || []).join('\n')) + '</textarea></label>' +
        '</div></div>';
    }).join('');

    $$('[data-remove-trip]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-remove-trip'), 10);
        content.destinations.splice(i, 1);
        renderTrips();
      });
    });
  }

  function collectTrips() {
    return $$('.trip-edit').map(function (card) {
      function val(name) {
        var el = $('[data-f="' + name + '"]', card);
        return el ? el.value : '';
      }
      var old = content.destinations[parseInt(card.getAttribute('data-trip-index'), 10)] || {};
      return {
        id: val('id').trim(),
        title: val('title').trim(),
        country: val('country').trim(),
        region: val('region').trim(),
        price: parseFloat(val('price')),
        days: parseInt(val('days'), 10),
        rating: parseFloat(val('rating')),
        reviews: parseInt(val('reviews'), 10),
        photo: val('photo').trim(),
        photoSm: val('photoSm').trim(),
        tag: val('tag').trim(),
        excerpt: val('excerpt').trim(),
        highlights: val('highlights').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
        i18n: old.i18n || undefined
      };
    });
  }

  function saveContent() {
    if (!content) return;
    content.destinations = collectTrips();
    ['brand', 'email', 'phone', 'address'].forEach(function (key) {
      var el = $('[data-set="' + key + '"]');
      if (el && el.value.trim()) content.settings[key] = el.value.trim();
    });
    API.put('content', content, { headers: headers() }).then(function (res) {
      if (res.ok) {
        flash('Saved — assets/js/data.js regenerated.');
        content = res.data.content;
        renderSettings();
        renderTrips();
      } else if (res.status === 401) {
        showPanel('login');
      } else {
        var msg = 'Save failed: HTTP ' + res.status;
        if (res.data && res.data.details) msg += ' — ' + res.data.details.join(' · ');
        flash(msg, true);
        if (res.data && res.data.details) {
          var first = $('.trip-edit');
          if (first) {
            var p = document.createElement('p');
            p.className = 'trip-edit__error';
            p.textContent = res.data.details.join(' · ');
            first.prepend(p);
          }
        }
      }
    });
  }

  function addTrip() {
    if (!content) return;
    content.destinations.push({
      id: 'new-trip-' + (content.destinations.length + 1),
      title: 'New trip',
      country: 'Country',
      region: 'Asia',
      price: 199,
      days: 3,
      rating: 4.5,
      reviews: 0,
      photo: 'dest-bali.jpg',
      photoSm: 'dest-bali-sm.jpg',
      tag: 'New',
      excerpt: 'Describe this trip.',
      highlights: ['Highlight one', 'Highlight two']
    });
    renderTrips();
  }

  /* ------------------------------------------------------------ bookings */
  function loadBookings() {
    var status = ($('[data-booking-filter]') || {}).value || '';
    API.get('bookings' + (status ? '?status=' + encodeURIComponent(status) : ''), { headers: headers() })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 401) showPanel('login');
          else flash('Could not load bookings: HTTP ' + res.status, true);
          return;
        }
        cache.bookings = res.data.bookings || [];
        table($('[data-bookings-table]'),
          ['Ref', 'Trip', 'Name', 'Date', 'People', 'Total', 'Status', 'Payment', 'Actions'],
          cache.bookings.map(function (b) {
            return '<tr>' +
              '<td><strong>' + esc(b.ref) + '</strong></td>' +
              '<td>' + esc(b.tripTitle) + '</td>' +
              '<td>' + esc(b.name) + '<br><small>' + esc(b.email) + '</small></td>' +
              '<td>' + esc(b.date) + '</td>' +
              '<td>' + b.people + '</td>' +
              '<td>$' + b.total + '</td>' +
              '<td>' + statusBadge(b.status) + '</td>' +
              '<td>' + esc(b.payment ? b.payment.status : '—') + '</td>' +
              '<td>' +
                (b.status !== 'paid' ? '<button class="btn btn--primary btn--sm" type="button" data-mark-paid="' + esc(b.ref) + '">Mark paid</button>' : '') +
                (b.status !== 'cancelled' ? '<button class="btn btn--outline btn--sm" type="button" data-cancel="' + esc(b.ref) + '">Cancel</button>' : '') +
              '</td></tr>';
          }));

        $$('[data-mark-paid]').forEach(function (btn) {
          btn.addEventListener('click', function () { patchBooking(btn.getAttribute('data-mark-paid'), { status: 'paid' }); });
        });
        $$('[data-cancel]').forEach(function (btn) {
          btn.addEventListener('click', function () { patchBooking(btn.getAttribute('data-cancel'), { status: 'cancelled' }); });
        });
      });
  }

  function patchBooking(ref, body) {
    API.patch('bookings/' + ref, body, { headers: headers() }).then(function (res) {
      if (res.ok) {
        flash('Booking ' + ref + ' → ' + res.data.booking.status + ' (payment: ' + res.data.booking.payment.status + ').');
        loadBookings();
      } else if (res.status === 401) {
        showPanel('login');
      } else {
        flash('Update failed: HTTP ' + res.status, true);
      }
    });
  }

  /* --------------------------------------------------------------- leads */
  function loadLeads() {
    API.get('leads', { headers: headers() }).then(function (res) {
      if (!res.ok) {
        if (res.status === 401) showPanel('login');
        return;
      }
      cache.leads = res.data.leads || [];
      table($('[data-leads-table]'), ['When', 'Name', 'E-mail', 'Subject', 'Message'],
        cache.leads.map(function (l) {
          return '<tr><td>' + esc(l.createdAt) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.email) +
            '</td><td>' + esc(l.subject || '') + '</td><td>' + esc(String(l.message).slice(0, 140)) + '</td></tr>';
        }));
    });
  }

  /* ---------------------------------------------------------- newsletter */
  function loadSubscribers() {
    API.get('subscribers', { headers: headers() }).then(function (res) {
      if (!res.ok) {
        if (res.status === 401) showPanel('login');
        return;
      }
      cache.subscribers = res.data.subscribers || [];
      table($('[data-subscribers-table]'), ['E-mail', 'Subscribed at'],
        cache.subscribers.map(function (s) {
          return '<tr><td>' + esc(s.email) + '</td><td>' + esc(s.createdAt) + '</td></tr>';
        }));
    });
  }

  /* ----------------------------------------------------------- csv export */
  function toCsv(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        var v = String(cell === undefined || cell === null ? '' : cell);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
  }

  function download(name, rows) {
    var blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* -------------------------------------------------------------- wiring */
  function initTabs() {
    $$('.admin__nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        showPanel(tab);
        if (tab === 'overview' || tab === 'analytics') loadOverview();
        if (tab === 'trips') loadContent();
        if (tab === 'bookings') loadBookings();
        if (tab === 'leads') loadLeads();
        if (tab === 'newsletter') loadSubscribers();
      });
    });
  }

  function initActions() {
    $$('[data-refresh]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var what = btn.getAttribute('data-refresh');
        if (what === 'overview') loadOverview();
        if (what === 'trips') loadContent();
        if (what === 'bookings') loadBookings();
        if (what === 'leads') loadLeads();
        if (what === 'newsletter') loadSubscribers();
      });
    });
    var save = $('[data-save-trips]');
    if (save) save.addEventListener('click', saveContent);
    var add = $('[data-add-trip]');
    if (add) add.addEventListener('click', addTrip);
    var filter = $('[data-booking-filter]');
    if (filter) filter.addEventListener('change', loadBookings);

    $$('[data-export]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var what = btn.getAttribute('data-export');
        if (what === 'bookings') {
          download('travosca-bookings.csv', [['ref', 'trip', 'name', 'email', 'date', 'people', 'total', 'status', 'payment']]
            .concat(cache.bookings.map(function (b) {
              return [b.ref, b.tripTitle, b.name, b.email, b.date, b.people, b.total, b.status, b.payment ? b.payment.status : ''];
            })));
        } else if (what === 'leads') {
          download('travosca-leads.csv', [['createdAt', 'name', 'email', 'subject', 'message']]
            .concat(cache.leads.map(function (l) { return [l.createdAt, l.name, l.email, l.subject || '', l.message]; })));
        } else if (what === 'subscribers') {
          download('travosca-subscribers.csv', [['email', 'createdAt']]
            .concat(cache.subscribers.map(function (s) { return [s.email, s.createdAt]; })));
        } else if (what === 'events' && cache.stats) {
          download('travosca-events.csv', [['ts', 'type', 'path', 'label']]
            .concat(cache.stats.recentEvents.map(function (e) {
              return [e.ts, e.type, e.path, e.label || (e.data && e.data.label) || ''];
            })));
        }
      });
    });
  }

  function boot() {
    initLogin();
    initTabs();
    initActions();
    if (token) {
      // Verify the stored token before showing any data.
      API.get('stats', { headers: headers() }).then(function (res) {
        if (res.ok) enter();
        else showPanel('login');
      });
    } else {
      showPanel('login');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
