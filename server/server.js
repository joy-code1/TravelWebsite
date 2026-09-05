/* ==========================================================================
   Travosca — application server (single file, zero dependencies)
   --------------------------------------------------------------------------
   Node 18+ built-ins only: node:http, node:fs, node:path, node:crypto,
   node:https.  It serves the static site from the repository root, the
   JSON REST API under /api/, the admin console under /admin/, sitemap.xml
   and robots.txt.

   Storage: plain JSON files inside DATA_DIR (default: server/data).
   content.json is the committed seed / single source of truth; all other
   files (bookings, leads, subscribers, comments, events, sessions) are
   runtime data and git-ignored.  Every write is atomic (tmp file + rename).

   Exports: { server, sitemap, DATA_DIR, getContent, mirrorContentToFrontend,
              createApp } so tests can boot the server on a temporary DATA_DIR.
   ========================================================================== */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');

const ROOT = path.join(__dirname, '..');
const SEED_CONTENT = path.join(__dirname, 'data', 'content.json');
const RUNTIME_FILES = ['bookings', 'leads', 'subscribers', 'comments', 'events', 'sessions'];

let PKG_VERSION = '0.0.0';
try { PKG_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || PKG_VERSION; } catch (e) { /* keep default */ }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BOOKING_STATUSES = ['pending', 'paid', 'cancelled', 'completed'];

/* ------------------------------------------------------------------ errors */
class ApiError extends Error {
  constructor(status, code, details) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details || undefined;
  }
}

/* ==================================================================== app */
function createApp(env) {
  const config = {
    port: parseInt(env.PORT || '4173', 10),
    host: env.HOST || '0.0.0.0',
    adminToken: env.ADMIN_TOKEN || 'travosca-admin',
    stripeKey: env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    crmWebhookUrl: env.CRM_WEBHOOK_URL || '',
    siteUrl: (env.SITE_URL || 'https://joy-code1.github.io/TravelWebsite').replace(/\/+$/, ''),
    dataDir: env.DATA_DIR || path.join(__dirname, 'data'),
    frontendDir: env.FRONTEND_DIR || ROOT
  };

  const DATA_DIR = config.dataDir;

  /* ------------------------------------------------------------- storage */
  function dataFile(name) { return path.join(DATA_DIR, name + '.json'); }

  function readJson(name, fallback) {
    try {
      return JSON.parse(fs.readFileSync(dataFile(name), 'utf8'));
    } catch (e) {
      return fallback;
    }
  }

  function writeJsonAtomic(name, data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = dataFile(name);
    const tmp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, file);
  }

  function updateCollection(name, mutator) {
    // Read-modify-write helper. Node is single threaded, so the synchronous
    // section below is atomic with respect to other requests.
    const list = readJson(name, []);
    const result = mutator(list);
    writeJsonAtomic(name, list);
    return result;
  }

  /* -------------------------------------------------------------- content */
  function getContent() {
    const file = dataFile('content');
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      // First boot on a fresh DATA_DIR: seed from the committed content.json.
      if (fs.existsSync(SEED_CONTENT)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.copyFileSync(SEED_CONTENT, file);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
      throw new ApiError(500, 'content_missing');
    }
  }

  function validateContent(body) {
    const errors = [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) return ['body must be a JSON object'];
    const c = body;

    const s = c.settings;
    if (!s || typeof s !== 'object') errors.push('settings: required object missing');
    else {
      ['brand', 'email', 'phone', 'address'].forEach(function (key) {
        if (typeof s[key] !== 'string' || !s[key].trim()) errors.push('settings.' + key + ': non-empty string required');
      });
      if (s.email && !EMAIL_RE.test(s.email)) errors.push('settings.email: invalid email');
    }

    if (!Array.isArray(c.destinations) || c.destinations.length === 0) {
      errors.push('destinations: at least one destination is required');
    } else {
      const ids = new Set();
      c.destinations.forEach(function (d, i) {
        const at = 'destinations[' + i + ']';
        if (!d || typeof d !== 'object') { errors.push(at + ': object required'); return; }
        if (!/^[a-z0-9-]{2,40}$/.test(String(d.id || ''))) errors.push(at + '.id: slug [a-z0-9-] required');
        if (ids.has(d.id)) errors.push(at + '.id: duplicate "' + d.id + '"');
        ids.add(d.id);
        ['title', 'country', 'region', 'tag', 'excerpt'].forEach(function (key) {
          if (typeof d[key] !== 'string' || !d[key].trim()) errors.push(at + '.' + key + ': non-empty string required');
        });
        ['photo', 'photoSm'].forEach(function (key) {
          if (typeof d[key] !== 'string' || !d[key].trim()) errors.push(at + '.' + key + ': non-empty string required');
        });
        if (typeof d.price !== 'number' || !(d.price > 0)) errors.push(at + '.price: positive number required');
        if (!Number.isInteger(d.days) || d.days < 1) errors.push(at + '.days: integer >= 1 required');
        if (typeof d.rating !== 'number' || d.rating < 0 || d.rating > 5) errors.push(at + '.rating: 0..5 required');
        if (!Number.isInteger(d.reviews) || d.reviews < 0) errors.push(at + '.reviews: integer >= 0 required');
        if (d.highlights !== undefined && (!Array.isArray(d.highlights) || d.highlights.some(function (h) { return typeof h !== 'string'; }))) {
          errors.push(at + '.highlights: array of strings required');
        }
        if (d.i18n !== undefined && (typeof d.i18n !== 'object' || Array.isArray(d.i18n))) errors.push(at + '.i18n: object required');
      });
    }

    [['features', 0], ['testimonials', 0], ['partners', 0], ['posts', 0], ['gallery', 0], ['offices', 0], ['months', 13]].forEach(function (pair) {
      const key = pair[0];
      const min = pair[1];
      const v = c[key];
      if (!Array.isArray(v)) { errors.push(key + ': array required'); return; }
      if (min && v.length < min) errors.push(key + ': at least ' + min + ' items required');
    });

    return errors;
  }

  /* -------------------------------------------- data.js mirror (generated) */
  function buildDataJs(content) {
    const stamp = new Date().toISOString();
    return '/* ==========================================================================\n' +
      '   GENERATED FILE — do not edit by hand.\n' +
      '   Source of truth: server/data/content.json\n' +
      '   Regenerate with: npm run sync  (tools/sync-content.js)\n' +
      '   or by saving content through PUT /api/content (the admin console).\n' +
      '   Generated: ' + stamp + '\n' +
      '   ========================================================================== */\n' +
      '(function () {\n' +
      "  'use strict';\n\n" +
      "  var script = document.currentScript || document.querySelector('script[src$=\"data.js\"]');\n" +
      "  var src = script ? script.getAttribute('src') : '../assets/js/data.js';\n" +
      "  var base = src.replace(/assets\\/js\\/data\\.js.*$/, '') || '../';\n\n" +
      "  var img = function (name) { return base + 'assets/img/' + name; };\n\n" +
      '  var CONTENT = ' + JSON.stringify(content, null, 2) + ';\n\n' +
      '  window.TRAVOSCA = {\n' +
      '    base: base,\n' +
      '    img: img,\n' +
      '    settings: CONTENT.settings,\n' +
      '    destinations: CONTENT.destinations,\n' +
      '    features: CONTENT.features,\n' +
      '    testimonials: CONTENT.testimonials,\n' +
      '    partners: CONTENT.partners,\n' +
      '    posts: CONTENT.posts,\n' +
      '    gallery: CONTENT.gallery,\n' +
      '    offices: CONTENT.offices,\n' +
      '    months: CONTENT.months\n' +
      '  };\n' +
      '})();\n';
  }

  function mirrorContentToFrontend(content) {
    const target = path.join(config.frontendDir, 'assets', 'js', 'data.js');
    const body = content || getContent();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = target + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    fs.writeFileSync(tmp, buildDataJs(body));
    fs.renameSync(tmp, target);
    return target;
  }

  /* --------------------------------------------------------------- helpers */
  function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  }

  function readBody(req, limit) {
    return new Promise(function (resolve, reject) {
      const chunks = [];
      let size = 0;
      req.on('data', function (chunk) {
        size += chunk.length;
        if (size > (limit || 1024 * 1024)) {
          reject(new ApiError(413, 'payload_too_large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', function () { resolve(Buffer.concat(chunks)); });
      req.on('error', reject);
    });
  }

  async function readJsonBody(req) {
    const raw = (await readBody(req)).toString('utf8');
    if (!raw.trim()) throw new ApiError(400, 'empty_body');
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new ApiError(400, 'invalid_json');
    }
  }

  function isAdmin(req) {
    const header = String(req.headers['x-admin-token'] || '');
    const expected = String(config.adminToken);
    if (!header || header.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  }

  function requireAdmin(req) {
    if (!isAdmin(req)) throw new ApiError(401, 'unauthorized');
  }

  function bad(status, code, details) { throw new ApiError(status, code, details); }

  function newId(prefix) {
    return prefix + '-' + crypto.randomBytes(4).toString('hex');
  }

  function newRef() {
    let out = '';
    for (let i = 0; i < 6; i++) out += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
    return 'TRV-' + out;
  }

  /* -------------------------------------------------------- CRM forwarding */
  function pushCrm(event, payload) {
    if (!config.crmWebhookUrl) return;
    const body = JSON.stringify({ event: event, payload: payload, ts: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', config.adminToken).update(body).digest('hex');
    let url;
    try { url = new URL(config.crmWebhookUrl); } catch (e) { return; }
    if (url.protocol !== 'https:') return;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-travosca-signature': 'sha256=' + signature
      },
      timeout: 4000
    }, function (res) { res.resume(); });
    req.on('timeout', function () { req.destroy(); });
    req.on('error', function () { /* fire and forget */ });
    req.end(body);
  }

  /* ---------------------------------------------------------------- Stripe */
  function stripeRequest(form) {
    return new Promise(function (resolve, reject) {
      const body = new URLSearchParams(form).toString();
      const req = https.request('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + config.stripeKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 8000
      }, function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          let json = null;
          try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { /* handled below */ }
          if (res.statusCode >= 200 && res.statusCode < 300 && json) resolve(json);
          else reject(new ApiError(502, 'stripe_error', json && json.error ? json.error.message : undefined));
        });
      });
      req.on('timeout', function () { req.destroy(new ApiError(504, 'stripe_timeout')); });
      req.on('error', function (err) {
        if (err instanceof ApiError) reject(err); else reject(new ApiError(502, 'stripe_unreachable'));
      });
      req.end(body);
    });
  }

  async function createCheckoutSession(booking) {
    if (config.stripeKey) {
      const siteBase = config.siteUrl;
      const session = await stripeRequest({
        mode: 'payment',
        client_reference_id: booking.ref,
        customer_email: booking.email,
        success_url: siteBase + '/checkout.html?ref=' + booking.ref + '&session={CHECKOUT_SESSION_ID}&paid=1',
        cancel_url: siteBase + '/checkout.html?ref=' + booking.ref + '&cancelled=1',
        'line_items[0][quantity]': String(booking.people),
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(Math.round(booking.total * 100)),
        'line_items[0][price_data][product_data][name]': booking.tripTitle + ' — Travosca',
        'line_items[0][price_data][product_data][description]': booking.tripTitle + ', ' + booking.country + ' · ' + booking.days + ' days',
        'metadata[ref]': booking.ref
      });
      const record = {
        id: session.id,
        ref: booking.ref,
        amount: booking.total,
        currency: 'usd',
        status: 'open',
        created: new Date().toISOString(),
        stripe: true
      };
      updateCollection('sessions', function (list) { list.push(record); });
      return record;
    }
    // Mock session with the exact same contract as a real one.
    const record = {
      id: 'cs_test_' + crypto.randomBytes(16).toString('hex').slice(0, 30),
      ref: booking.ref,
      amount: booking.total,
      currency: 'usd',
      status: 'open',
      created: new Date().toISOString(),
      stripe: false
    };
    updateCollection('sessions', function (list) { list.push(record); });
    return record;
  }

  function checkoutUrlFor(session) {
    return '/checkout.html?ref=' + encodeURIComponent(session.ref) + '&session=' + encodeURIComponent(session.id);
  }

  function markPaid(booking, via) {
    booking.status = 'paid';
    booking.payment = booking.payment || {};
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date().toISOString();
    booking.payment.paidVia = via || 'mock_confirm';
    booking.updatedAt = new Date().toISOString();
    return booking;
  }

  function findBooking(list, ref) {
    const wanted = String(ref || '').toUpperCase();
    return list.find(function (b) { return b.ref === wanted; }) || null;
  }

  function publicBooking(b) {
    return {
      ref: b.ref,
      tripId: b.tripId,
      tripTitle: b.tripTitle,
      country: b.country,
      date: b.date,
      people: b.people,
      name: b.name,
      email: b.email,
      total: b.total,
      status: b.status,
      payment: b.payment ? { status: b.payment.status, paidAt: b.payment.paidAt || null } : undefined,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt
    };
  }

  /* ----------------------------------------------------------- validation */
  function validateBookingInput(body, content) {
    const details = {};
    if (!body || typeof body !== 'object') bad(400, 'invalid_body');

    const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    const trip = (content.destinations || []).find(function (d) { return d.id === tripId; });
    if (!trip) details.tripId = 'unknown tripId';

    const date = typeof body.date === 'string' ? body.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      details.date = 'date must be YYYY-MM-DD';
    } else {
      const when = new Date(date + 'T00:00:00.000Z');
      if (Number.isNaN(when.getTime())) details.date = 'date is not a real calendar date';
      else {
        const today = new Date();
        const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        if (when.getTime() <= todayUtc) details.date = 'date must be in the future';
        else if (when.getUTCFullYear() > 2099) details.date = 'date is too far ahead';
        // Reject e.g. 2026-02-31 (Date would roll it over).
        if (when.toISOString().slice(0, 10) !== date) details.date = 'date is not a real calendar date';
      }
    }

    const people = body.people === undefined ? 1 : body.people;
    const peopleNum = typeof people === 'string' && /^\d+$/.test(people) ? parseInt(people, 10) : people;
    if (!Number.isInteger(peopleNum) || peopleNum < 1 || peopleNum > 12) details.people = 'people must be an integer between 1 and 12';

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) details.name = 'name (min 2 characters) is required';

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!EMAIL_RE.test(email)) details.email = 'valid email is required';

    if (Object.keys(details).length) bad(400, 'validation_failed', details);

    return {
      trip: trip,
      date: date,
      people: peopleNum,
      name: name,
      email: email,
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : ''
    };
  }

  /* ---------------------------------------------------------- localisation */
  const I18N_FIELDS = ['title', 'country', 'region', 'tag', 'excerpt', 'highlights'];
  function localizeTrip(trip, lang) {
    if (!lang || lang === 'en' || !trip.i18n || !trip.i18n[lang]) return trip;
    const out = Object.assign({}, trip);
    const dict = trip.i18n[lang];
    I18N_FIELDS.forEach(function (f) {
      if (dict[f] !== undefined && dict[f] !== null) out[f] = dict[f];
    });
    out.i18n = undefined;
    return out;
  }

  /* --------------------------------------------------------------- routes */
  async function handleApi(req, res, u) {
    const p = u.pathname.replace(/\/+$/, '') || '/';
    const method = req.method;
    const query = u.searchParams;

    /* ------------------------------------------------------------ health */
    if (p === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        service: 'travosca',
        version: PKG_VERSION,
        uptime: Math.round(process.uptime()),
        time: new Date().toISOString(),
        services: {
          content: true,
          payments: config.stripeKey ? 'stripe' : 'mock',
          crm: Boolean(config.crmWebhookUrl),
          webhook: Boolean(config.stripeWebhookSecret)
        }
      });
    }

    /* ----------------------------------------------------------- content */
    if (p === '/api/content' && method === 'GET') {
      return sendJson(res, 200, getContent());
    }
    if (p === '/api/content' && method === 'PUT') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const errors = validateContent(body);
      if (errors.length) return sendJson(res, 400, { ok: false, error: 'invalid_content', details: errors });
      body.settings = body.settings || {};
      body.settings.updated = new Date().toISOString();
      writeJsonAtomic('content', body);
      const mirroredTo = mirrorContentToFrontend(body);
      pushCrm('content.updated', { updated: body.settings.updated, destinations: body.destinations.length });
      return sendJson(res, 200, { ok: true, mirrored: true, mirroredTo: path.relative(ROOT, mirroredTo), content: body });
    }

    /* ------------------------------------------------------------- trips */
    if (p === '/api/trips' && method === 'GET') {
      const content = getContent();
      const lang = (query.get('lang') || 'en').toLowerCase();
      let trips = (content.destinations || []).slice();

      const region = (query.get('region') || '').toLowerCase();
      if (region) trips = trips.filter(function (d) { return String(d.region).toLowerCase() === region; });

      const q = (query.get('q') || '').trim().toLowerCase();
      if (q) {
        trips = trips.filter(function (d) {
          let haystack = [d.title, d.country, d.region, d.tag, d.excerpt].join(' ').toLowerCase();
          Object.keys(d.i18n || {}).forEach(function (code) {
            const dict = d.i18n[code] || {};
            haystack += ' ' + [dict.title, dict.country, dict.tag, dict.excerpt].join(' ').toLowerCase();
          });
          return haystack.indexOf(q) > -1;
        });
      }

      const minPrice = parseFloat(query.get('minPrice'));
      if (!Number.isNaN(minPrice)) trips = trips.filter(function (d) { return d.price >= minPrice; });
      const maxPrice = parseFloat(query.get('maxPrice'));
      if (!Number.isNaN(maxPrice)) trips = trips.filter(function (d) { return d.price <= maxPrice; });

      const sorters = {
        popular: function (a, b) { return b.reviews - a.reviews; },
        price: function (a, b) { return a.price - b.price; },
        'price-desc': function (a, b) { return b.price - a.price; },
        rating: function (a, b) { return b.rating - a.rating; },
        days: function (a, b) { return a.days - b.days; }
      };
      const sort = query.get('sort') || 'popular';
      trips.sort(sorters[sort] || sorters.popular);

      trips = trips.map(function (d) { return localizeTrip(d, lang); });
      return sendJson(res, 200, { ok: true, total: (content.destinations || []).length, count: trips.length, trips: trips });
    }

    /* ---------------------------------------------------------- bookings */
    if (p === '/api/bookings' && method === 'POST') {
      const body = await readJsonBody(req);
      const content = getContent();
      const input = validateBookingInput(body, content);
      const booking = {
        ref: newRef(),
        tripId: input.trip.id,
        tripTitle: input.trip.title,
        country: input.trip.country,
        region: input.trip.region,
        price: input.trip.price,
        days: input.trip.days,
        date: input.date,
        people: input.people,
        name: input.name,
        email: input.email.toLowerCase(),
        notes: input.notes,
        total: input.trip.price * input.people,
        status: 'pending',
        payment: { method: 'card', status: 'checkout_created', session: null, last4: null, paidAt: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'web'
      };
      const session = await createCheckoutSession(booking);
      booking.payment.session = session.id;

      let saved = null;
      while (!saved) {
        saved = updateCollection('bookings', function (list) {
          if (findBooking(list, booking.ref)) return false; // collision, retry
          list.push(booking);
          return true;
        });
        if (!saved) booking.ref = newRef();
      }
      pushCrm('booking.created', publicBooking(booking));
      return sendJson(res, 201, {
        ok: true,
        ref: booking.ref,
        total: booking.total,
        status: booking.status,
        checkoutUrl: checkoutUrlFor(session),
        lookupUrl: '/api/bookings/lookup?ref=' + booking.ref + '&email=' + encodeURIComponent(booking.email),
        booking: publicBooking(booking)
      });
    }

    if (p === '/api/bookings' && method === 'GET') {
      requireAdmin(req);
      const status = query.get('status');
      let list = readJson('bookings', []);
      if (status) list = list.filter(function (b) { return b.status === status; });
      list.sort(function (a, b) { return b.createdAt < a.createdAt ? -1 : 1; });
      return sendJson(res, 200, { ok: true, count: list.length, bookings: list });
    }

    if (p === '/api/bookings/lookup' && method === 'GET') {
      const ref = (query.get('ref') || '').trim().toUpperCase();
      const email = (query.get('email') || '').trim().toLowerCase();
      if (!ref || !email) bad(400, 'validation_failed', { ref: ref ? undefined : 'required', email: email ? undefined : 'required' });
      const booking = findBooking(readJson('bookings', []), ref);
      if (!booking || booking.email.toLowerCase() !== email) bad(404, 'booking_not_found');
      return sendJson(res, 200, { ok: true, booking: publicBooking(booking) });
    }

    let m = p.match(/^\/api\/bookings\/(TRV-[A-Za-z0-9]{6})$/);
    if (m && method === 'PATCH') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const result = updateCollection('bookings', function (list) {
        const booking = findBooking(list, m[1]);
        if (!booking) return null;
        if (body.paid === true || body.status === 'paid') {
          markPaid(booking, 'admin');
        } else if (body.status) {
          if (BOOKING_STATUSES.indexOf(body.status) === -1) throw new ApiError(400, 'invalid_status', { status: 'must be one of ' + BOOKING_STATUSES.join(', ') });
          booking.status = body.status;
          booking.payment = booking.payment || {};
          if (body.status === 'cancelled' && booking.payment.status !== 'paid') booking.payment.status = 'cancelled';
          booking.updatedAt = new Date().toISOString();
        } else {
          throw new ApiError(400, 'nothing_to_update', { status: 'provide status or paid:true' });
        }
        return booking;
      });
      if (!result) bad(404, 'booking_not_found');
      pushCrm('booking.updated', publicBooking(result));
      return sendJson(res, 200, { ok: true, booking: publicBooking(result) });
    }

    /* ---------------------------------------------------------- payments */
    if (p === '/api/payments/checkout' && method === 'POST') {
      const body = await readJsonBody(req);
      const booking = findBooking(readJson('bookings', []), body.ref || '');
      if (!booking) bad(404, 'booking_not_found');
      if (booking.status === 'cancelled') bad(409, 'booking_cancelled');
      const session = await createCheckoutSession(booking);
      updateCollection('bookings', function (list) {
        const fresh = findBooking(list, booking.ref);
        if (fresh) {
          fresh.payment = fresh.payment || {};
          fresh.payment.session = session.id;
          fresh.payment.status = fresh.payment.status === 'paid' ? 'paid' : 'checkout_created';
          fresh.updatedAt = new Date().toISOString();
        }
      });
      return sendJson(res, 201, { ok: true, id: session.id, url: checkoutUrlFor(session), ref: booking.ref, amount: session.amount });
    }

    if (p === '/api/payments/session' && method === 'GET') {
      const id = (query.get('id') || '').trim();
      if (!id) bad(400, 'validation_failed', { id: 'required' });
      const session = readJson('sessions', []).find(function (s) { return s.id === id; });
      if (!session) bad(404, 'session_not_found');
      return sendJson(res, 200, { ok: true, session: session });
    }

    if (p === '/api/payments/confirm' && method === 'POST') {
      const body = await readJsonBody(req);
      const raw = String(body.card || body.number || '');
      const digits = raw.replace(/[\s-]/g, '');
      if (!/^\d{16}$/.test(digits)) bad(400, 'invalid_card', { card: 'card number must be exactly 16 digits' });

      let booking = null;
      if (body.ref) booking = findBooking(readJson('bookings', []), body.ref);
      else if (body.sessionId) {
        const session = readJson('sessions', []).find(function (s) { return s.id === body.sessionId; });
        if (session) booking = findBooking(readJson('bookings', []), session.ref);
      }
      if (!booking) bad(404, 'booking_not_found');
      if (booking.status === 'cancelled') bad(409, 'booking_cancelled');

      if (digits.endsWith('0002')) {
        const declined = updateCollection('bookings', function (list) {
          const fresh = findBooking(list, booking.ref);
          if (fresh) {
            fresh.payment = fresh.payment || {};
            fresh.payment.status = 'declined';
            fresh.payment.declinedAt = new Date().toISOString();
            fresh.payment.last4 = digits.slice(-4);
            // booking.status intentionally stays 'pending'
            fresh.updatedAt = new Date().toISOString();
          }
          return fresh;
        });
        pushCrm('payment.declined', { ref: booking.ref, total: booking.total });
        return sendJson(res, 402, { ok: false, error: 'card_declined', booking: publicBooking(declined) });
      }

      if (digits === '4242424242424242') {
        const paid = updateCollection('bookings', function (list) {
          const fresh = findBooking(list, booking.ref);
          if (fresh) {
            markPaid(fresh, 'mock_confirm');
            fresh.payment.last4 = '4242';
            fresh.payment.method = 'card';
          }
          return fresh;
        });
        updateCollection('sessions', function (list) {
          const s = list.find(function (s) { return s.ref === booking.ref; });
          if (s) s.status = 'paid';
        });
        pushCrm('payment.paid', publicBooking(paid));
        return sendJson(res, 200, { ok: true, booking: publicBooking(paid) });
      }

      bad(400, 'unsupported_test_card', { card: 'use 4242 4242 4242 4242 (successs) or a card ending 0002 (declined)' });
    }

    if (p === '/api/webhooks/stripe' && method === 'POST') {
      const raw = (await readBody(req)).toString('utf8');
      if (config.stripeWebhookSecret) {
        const header = String(req.headers['stripe-signature'] || '');
        const parts = {};
        header.split(',').forEach(function (kv) {
          const eq = kv.indexOf('=');
          if (eq > -1) parts[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
        });
        const timestamp = parts.t || '';
        const signatures = header.split(',').filter(function (kv) { return kv.trim().indexOf('v1=') === 0; })
          .map(function (kv) { return kv.trim().slice(3); });
        const expected = timestamp
          ? crypto.createHmac('sha256', config.stripeWebhookSecret).update(timestamp + '.' + raw).digest('hex')
          : null;
        const valid = expected && signatures.some(function (sig) {
          if (sig.length !== expected.length) return false;
          return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        });
        if (!valid) return sendJson(res, 400, { ok: false, error: 'invalid_signature' });
      }
      let event = null;
      try { event = JSON.parse(raw); } catch (e) { bad(400, 'invalid_json'); }
      if (event && event.type === 'checkout.session.completed' && event.data && event.data.object) {
        const obj = event.data.object;
        const ref = obj.client_reference_id || (obj.metadata && obj.metadata.ref);
        if (ref) {
          updateCollection('bookings', function (list) {
            const fresh = findBooking(list, ref);
            if (fresh && fresh.status !== 'cancelled') markPaid(fresh, 'stripe_webhook');
          });
          updateCollection('sessions', function (list) {
            const s = list.find(function (s) { return s.id === obj.id || s.ref === ref; });
            if (s) s.status = 'paid';
          });
          pushCrm('payment.webhook', { ref: ref, event: event.type });
        }
      }
      return sendJson(res, 200, { ok: true, received: true });
    }

    /* -------------------------------------------------------------- leads */
    if (p === '/api/leads' && method === 'POST') {
      const body = await readJsonBody(req);
      const details = {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (name.length < 2) details.name = 'name (min 2 characters) is required';
      if (!EMAIL_RE.test(email)) details.email = 'valid email is required';
      if (message.length < 10) details.message = 'message (min 10 characters) is required';
      if (Object.keys(details).length) bad(400, 'validation_failed', details);
      const lead = {
        id: newId('LEAD'),
        name: name,
        email: email.toLowerCase(),
        phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '',
        subject: typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : '',
        message: message.slice(0, 4000),
        status: 'new',
        createdAt: new Date().toISOString()
      };
      updateCollection('leads', function (list) { list.push(lead); });
      pushCrm('lead.created', lead);
      return sendJson(res, 201, { ok: true, id: lead.id });
    }
    if (p === '/api/leads' && method === 'GET') {
      requireAdmin(req);
      const leads = readJson('leads', []);
      return sendJson(res, 200, { ok: true, count: leads.length, leads: leads });
    }

    /* -------------------------------------------------------- subscribers */
    if (p === '/api/subscribe' && method === 'POST') {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(email)) bad(400, 'validation_failed', { email: 'valid email is required' });
      const already = readJson('subscribers', []).some(function (s) { return s.email === email; });
      if (already) return sendJson(res, 200, { ok: true, already: true });
      updateCollection('subscribers', function (list) {
        list.push({ email: email, createdAt: new Date().toISOString() });
      });
      pushCrm('subscriber.created', { email: email });
      return sendJson(res, 201, { ok: true, already: false });
    }
    if (p === '/api/subscribers' && method === 'GET') {
      requireAdmin(req);
      const subscribers = readJson('subscribers', []);
      return sendJson(res, 200, { ok: true, count: subscribers.length, subscribers: subscribers });
    }

    /* ----------------------------------------------------------- comments */
    if (p === '/api/comments' && method === 'GET') {
      const post = (query.get('post') || '').trim();
      if (!post) bad(400, 'validation_failed', { post: 'post id is required' });
      const comments = readJson('comments', []).filter(function (c) { return c.post === post; });
      return sendJson(res, 200, { ok: true, post: post, count: comments.length, comments: comments });
    }
    if (p === '/api/comments' && method === 'POST') {
      const body = await readJsonBody(req);
      const details = {};
      const post = typeof body.post === 'string' ? body.post.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!post) details.post = 'post id is required';
      if (name.length < 2) details.name = 'name (min 2 characters) is required';
      if (text.length < 3) details.text = 'comment text (min 3 characters) is required';
      if (Object.keys(details).length) bad(400, 'validation_failed', details);
      const comment = { id: newId('CMT'), post: post, name: name, text: text.slice(0, 2000), createdAt: new Date().toISOString() };
      updateCollection('comments', function (list) { list.push(comment); });
      return sendJson(res, 201, { ok: true, comment: comment });
    }

    /* ------------------------------------------------------------- events */
    if (p === '/api/events' && method === 'POST') {
      const body = await readJsonBody(req);
      const type = typeof body.type === 'string' ? body.type.trim().slice(0, 60) : '';
      if (!type) bad(400, 'validation_failed', { type: 'event type is required' });
      if (type !== 'pageview' && type !== 'click' && type !== 'click_outbound' && type !== 'custom') {
        bad(400, 'validation_failed', { type: 'type must be pageview | click | click_outbound | custom' });
      }
      const event = {
        id: newId('EVT'),
        type: type,
        path: typeof body.path === 'string' ? body.path.trim().slice(0, 200) : '',
        label: typeof body.label === 'string' ? body.label.trim().slice(0, 120) : '',
        data: body.data && typeof body.data === 'object' ? body.data : {},
        ts: new Date().toISOString()
      };
      updateCollection('events', function (list) {
        list.push(event);
        if (list.length > 5000) list.splice(0, list.length - 5000);
      });
      return sendJson(res, 201, { ok: true });
    }

    /* -------------------------------------------------------------- stats */
    if (p === '/api/stats' && method === 'GET') {
      requireAdmin(req);
      const bookings = readJson('bookings', []);
      const leads = readJson('leads', []);
      const subscribers = readJson('subscribers', []);
      const comments = readJson('comments', []);
      const events = readJson('events', []);
      const content = getContent();

      const byStatus = {};
      BOOKING_STATUSES.forEach(function (s) { byStatus[s] = 0; });
      let revenue = 0;
      const tripsCount = {};
      bookings.forEach(function (b) {
        byStatus[b.status] = (byStatus[b.status] || 0) + 1;
        if (b.status === 'paid') revenue += b.total;
        tripsCount[b.tripId] = (tripsCount[b.tripId] || 0) + 1;
      });

      const pageviews = events.filter(function (e) { return e.type === 'pageview'; });
      const viewsByPath = {};
      pageviews.forEach(function (e) {
        const key = e.path || '(unknown)';
        viewsByPath[key] = (viewsByPath[key] || 0) + 1;
      });
      const topPages = Object.keys(viewsByPath)
        .map(function (path) { return { path: path, views: viewsByPath[path] }; })
        .sort(function (a, b) { return b.views - a.views; })
        .slice(0, 8);

      const topTrips = Object.keys(tripsCount)
        .map(function (id) {
          const trip = (content.destinations || []).find(function (d) { return d.id === id; });
          return { tripId: id, title: trip ? trip.title : id, bookings: tripsCount[id] };
        })
        .sort(function (a, b) { return b.bookings - a.bookings; });

      return sendJson(res, 200, {
        ok: true,
        totals: {
          bookings: bookings.length,
          bookingsByStatus: byStatus,
          revenue: revenue,
          leads: leads.length,
          subscribers: subscribers.length,
          comments: comments.length,
          events: events.length,
          pageviews: pageviews.length,
          destinations: (content.destinations || []).length
        },
        funnel: {
          pageviews: pageviews.length,
          bookingsCreated: bookings.length,
          paidBookings: byStatus.paid,
          conversionRate: pageviews.length ? Math.round((byStatus.paid / pageviews.length) * 1000) / 10 : 0
        },
        topPages: topPages,
        topTrips: topTrips,
        recentEvents: events.slice(-15).reverse(),
        system: {
          payments: config.stripeKey ? 'stripe' : 'mock',
          crm: Boolean(config.crmWebhookUrl),
          webhookSecret: Boolean(config.stripeWebhookSecret),
          contentUpdated: (content.settings && content.settings.updated) || null,
          node: process.version,
          uptime: Math.round(process.uptime()),
          dataFiles: RUNTIME_FILES
        }
      });
    }

    bad(404, 'not_found');
  }

  /* -------------------------------------------------------------- sitemap */
  function fileMtime(rel) {
    try { return fs.statSync(path.join(ROOT, rel)).mtime.toISOString(); } catch (e) { return new Date().toISOString(); }
  }

  function sitemap() {
    const content = getContent();
    const base = config.siteUrl;
    const updated = (content.settings && content.settings.updated) || new Date().toISOString();
    const entries = [
      { loc: base + '/', lastmod: fileMtime('index.html'), changefreq: 'daily', priority: '1.0' },
      { loc: base + '/home-page/', lastmod: fileMtime('home-page/index.html'), changefreq: 'daily', priority: '0.9' },
      { loc: base + '/package-page/', lastmod: updated, changefreq: 'weekly', priority: '0.9' },
      { loc: base + '/about_us-page/', lastmod: fileMtime('about_us-page/index.html'), changefreq: 'monthly', priority: '0.7' },
      { loc: base + '/contact-page/', lastmod: fileMtime('contact-page/index.html'), changefreq: 'monthly', priority: '0.7' },
      { loc: base + '/single_blog-page/', lastmod: updated, changefreq: 'weekly', priority: '0.7' },
      { loc: base + '/checkout.html', lastmod: fileMtime('checkout.html'), changefreq: 'yearly', priority: '0.4' }
    ];
    (content.destinations || []).forEach(function (d) {
      entries.push({
        loc: base + '/package-page/index.html?dest=' + encodeURIComponent(d.id),
        lastmod: updated, changefreq: 'weekly', priority: '0.8'
      });
    });
    (content.posts || []).forEach(function (post) {
      entries.push({
        loc: base + '/single_blog-page/index.html?post=' + encodeURIComponent(post.id),
        lastmod: updated, changefreq: 'monthly', priority: '0.6'
      });
    });
    const esc = function (s) { return String(s).replace(/&/g, '&amp;'); };
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      entries.map(function (e) {
        return '  <url>\n' +
          '    <loc>' + esc(e.loc) + '</loc>\n' +
          '    <lastmod>' + esc(e.lastmod) + '</lastmod>\n' +
          '    <changefreq>' + e.changefreq + '</changefreq>\n' +
          '    <priority>' + e.priority + '</priority>\n' +
          '  </url>';
      }).join('\n') +
      '\n</urlset>\n';
  }

  /* ---------------------------------------------------------- static site */
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };

  const PRIVATE_SEGMENTS = new Set(['server', 'tools', '.git', 'node_modules', 'coverage', '.github']);

  function serveStatic(req, res, u) {
    let decoded;
    try {
      decoded = decodeURIComponent(u.pathname);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
    decoded = decoded.replace(/\\/g, '/');

    if (decoded.indexOf('\0') !== -1) return sendJson(res, 400, { ok: false, error: 'bad_request' });
    if (decoded.split('/').indexOf('..') !== -1) return sendJson(res, 403, { ok: false, error: 'forbidden' });

    if (decoded === '/admin') {
      res.writeHead(301, { Location: '/admin/' });
      return res.end();
    }
    if (decoded === '/admin/' || decoded === '/admin/index.html') {
      return sendFile(req, res, path.join(ROOT, 'admin', 'index.html'));
    }

    let rel = decoded.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!rel) return sendFile(req, res, path.join(ROOT, 'index.html'));

    const target = path.resolve(ROOT, rel);
    if (target !== ROOT && target.indexOf(ROOT + path.sep) !== 0) {
      return sendJson(res, 403, { ok: false, error: 'forbidden' });
    }
    const segments = rel.split('/');
    if (PRIVATE_SEGMENTS.has(segments[0]) || segments.some(function (s) { return s.startsWith('.'); })) {
      return sendJson(res, 404, { ok: false, error: 'not_found' });
    }

    let stat;
    try { stat = fs.statSync(target); } catch (e) { return sendJson(res, 404, { ok: false, error: 'not_found' }); }
    if (stat.isDirectory()) {
      const indexFile = path.join(target, 'index.html');
      if (fs.existsSync(indexFile)) return sendFile(req, res, indexFile);
      return sendJson(res, 404, { ok: false, error: 'not_found' });
    }
    return sendFile(req, res, target);
  }

  function sendFile(req, res, file) {
    fs.readFile(file, function (err, buf) {
      if (err) return sendJson(res, 404, { ok: false, error: 'not_found' });
      const ext = path.extname(file).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buf.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
      });
      res.end(buf);
    });
  }

  /* --------------------------------------------------------------- server */
  const server = http.createServer(function (req, res) {
    let u;
    try {
      u = new URL(req.url, 'http://localhost');
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }

    const isApi = u.pathname === '/api' || u.pathname.indexOf('/api/') === 0;
    const done = isApi
      ? handleApi(req, res, u).catch(function (err) {
          if (err instanceof ApiError) {
            return sendJson(res, err.status, { ok: false, error: err.code, details: err.details });
          }
          console.error('[travosca] unhandled error:', err);
          return sendJson(res, 500, { ok: false, error: 'internal_error' });
        })
      : new Promise(function (resolve) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
            return resolve();
          }
          if (u.pathname === '/sitemap.xml') {
            const xml = sitemap();
            res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(xml);
            return resolve();
          }
          if (u.pathname === '/robots.txt') {
            const txt = 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ' + config.siteUrl + '/sitemap.xml\n';
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(txt);
            return resolve();
          }
          serveStatic(req, res, u);
          resolve();
        });

    done.catch(function () { /* responses already sent */ });
  });

  return {
    server: server,
    config: config,
    DATA_DIR: DATA_DIR,
    getContent: getContent,
    mirrorContentToFrontend: mirrorContentToFrontend,
    sitemap: sitemap,
    validateContent: validateContent,
    buildDataJs: buildDataJs
  };
}

/* --------------------------------------------------------- default export */
const app = createApp(process.env);

module.exports = {
  server: app.server,
  sitemap: app.sitemap,
  DATA_DIR: app.DATA_DIR,
  getContent: app.getContent,
  mirrorContentToFrontend: app.mirrorContentToFrontend,
  createApp: createApp
};

if (require.main === module) {
  const port = app.config.port;
  app.server.listen(port, app.config.host, function () {
    console.log('[travosca] server on http://' + app.config.host + ':' + port +
      ' (payments: ' + (app.config.stripeKey ? 'stripe' : 'mock') + ', data: ' + app.DATA_DIR + ')');
  });
}
