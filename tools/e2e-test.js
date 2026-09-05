#!/usr/bin/env node
/* ==========================================================================
   Travosca — end-to-end test (zero dependencies, node:test not required)

   Boots a REAL server instance on an ephemeral port with a temporary
   DATA_DIR (and a temporary FRONTEND_DIR so the repo's assets/js/data.js
   is never touched by the content-PUT checks), then runs 95 checks
   covering: health, content GET/PUT + data.js mirroring, /api/trips
   filters + sorting + localisation, booking creation and validation,
   lookup, the full payment cycle (4242… → paid, …0002 → 402 pending,
   invalid cards → 400), admin booking management, leads, newsletter,
   comments, analytics events, /api/stats, path-traversal protection,
   static serving (/, /admin/, checkout.html), sitemap.xml and robots.txt,
   and Stripe webhook HMAC verification.

   Output: "N/N passed" + per-failure details. Exit code 1 on any failure.
   Run: npm test
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const { createApp } = require(path.join(ROOT, 'server', 'server.js'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra) {
  const ok = Boolean(condition);
  if (ok) {
    passed++;
    console.log('  ok ' + String(passed).padStart(2, '0') + ' — ' + name);
  } else {
    failed++;
    failures.push(name + (extra !== undefined ? '  [' + JSON.stringify(extra).slice(0, 200) + ']' : ''));
    console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 200) : ''));
  }
  return ok;
}

function group(title) {
  console.log('\n== ' + title);
}

async function req(port, method, url, body, headers) {
  const init = { method: method, headers: Object.assign({}, headers || {}) };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch('http://127.0.0.1:' + port + url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* html etc. */ }
  return { status: res.status, text: text, json: json };
}

function listen(server) {
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise(function (resolve) { server.close(resolve); });
}

async function main() {
  console.log('Booting test server on a temporary DATA_DIR…');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'travosca-e2e-'));
  const frontDir = fs.mkdtempSync(path.join(os.tmpdir(), 'travosca-e2e-front-'));

  const app = createApp({
    DATA_DIR: dataDir,
    FRONTEND_DIR: frontDir,
    ADMIN_TOKEN: 'test-admin-token',
    SITE_URL: 'https://joy-code1.github.io/TravelWebsite'
  });
  const port = await listen(app.server);
  const admin = { 'x-admin-token': 'test-admin-token' };
  console.log('Listening on 127.0.0.1:' + port + '  (data: ' + dataDir + ')');

  /* ============================================== 1. health (3 checks) */
  group('health');
  let r = await req(port, 'GET', '/api/health');
  check('GET /api/health returns 200', r.status === 200, r.status);
  check('health payload has ok:true', r.json && r.json.ok === true, r.json);
  check('payments service reports mock mode', r.json && r.json.services && r.json.services.payments === 'mock', r.json && r.json.services);

  /* ============================================== 2. content (6 checks) */
  group('content');
  r = await req(port, 'GET', '/api/content');
  check('GET /api/content returns 200', r.status === 200, r.status);
  const original = r.json;
  check('content has 7 destinations', r.json && r.json.destinations && r.json.destinations.length === 7,
    r.json && r.json.destinations && r.json.destinations.length);
  check('settings.brand is Travosca', r.json && r.json.settings && r.json.settings.brand === 'Travosca');

  r = await req(port, 'PUT', '/api/content', original);
  check('PUT /api/content without token → 401', r.status === 401, r.status);

  r = await req(port, 'PUT', '/api/content', { settings: original.settings, destinations: [] }, admin);
  check('PUT with empty destinations → 400 invalid_content', r.status === 400 && r.json.error === 'invalid_content', r.json);

  const modified = JSON.parse(JSON.stringify(original));
  modified.settings.email = 'cms-test@travosca.dev';
  r = await req(port, 'PUT', '/api/content', modified, admin);
  check('PUT valid content with token → 200', r.status === 200 && r.json.ok === true, r.status);

  /* ============================================== 3. data.js mirror (3) */
  group('data.js mirror');
  const mirroredPath = path.join(frontDir, 'assets', 'js', 'data.js');
  const mirrored = fs.existsSync(mirroredPath) ? fs.readFileSync(mirroredPath, 'utf8') : '';
  check('assets/js/data.js regenerated in frontend dir', fs.existsSync(mirroredPath));
  check('generated file carries the GENERATED header', mirrored.indexOf('GENERATED FILE') > -1 && mirrored.indexOf('do not edit by hand') > -1);
  check('generated file contains the edited e-mail + window.TRAVOSCA', mirrored.indexOf('cms-test@travosca.dev') > -1 && mirrored.indexOf('window.TRAVOSCA') > -1);
  // restore original content so later checks use the seed content
  await req(port, 'PUT', '/api/content', original, admin);

  /* ============================================== 4. /api/trips (9) */
  group('/api/trips — filters, sorting, localisation');
  r = await req(port, 'GET', '/api/trips');
  check('GET /api/trips returns 7 trips', r.status === 200 && r.json.count === 7, r.json && r.json.count);
  r = await req(port, 'GET', '/api/trips?region=Asia');
  check('region=Asia filters to 5 trips', r.json && r.json.count === 5, r.json && r.json.count);
  r = await req(port, 'GET', '/api/trips?region=Europe');
  check('region=Europe filters to 2 trips', r.json && r.json.count === 2, r.json && r.json.count);
  r = await req(port, 'GET', '/api/trips?q=alps');
  check('q=alps finds the Swiss Alps trip', r.json && r.json.count === 1 && r.json.trips[0].id === 'swiss', r.json && r.json.trips[0] && r.json.trips[0].id);
  r = await req(port, 'GET', '/api/trips?sort=price');
  check('sort=price asc starts with Thailand ($219)', r.json && r.json.trips[0].id === 'thailand' && r.json.trips[0].price === 219, r.json && r.json.trips[0] && r.json.trips[0].id);
  r = await req(port, 'GET', '/api/trips?sort=price-desc');
  check('sort=price-desc starts with Swiss Alps ($349)', r.json && r.json.trips[0].id === 'swiss' && r.json.trips[0].price === 349, r.json && r.json.trips[0] && r.json.trips[0].id);
  r = await req(port, 'GET', '/api/trips?minPrice=300');
  check('minPrice=300 leaves 2 trips (SG + Swiss)', r.json && r.json.count === 2, r.json && r.json.count);
  r = await req(port, 'GET', '/api/trips?lang=ru');
  const baliRu = r.json && r.json.trips.find(function (d) { return d.id === 'bali'; });
  check('lang=ru localises titles (Бали)', baliRu && baliRu.title === 'Бали', baliRu && baliRu.title);
  r = await req(port, 'GET', '/api/trips?lang=uz');
  const baliUz = r.json && r.json.trips.find(function (d) { return d.id === 'bali'; });
  check('lang=uz localises tags (Plaj va madaniyat)', baliUz && baliUz.tag === 'Plaj va madaniyat', baliUz && baliUz.tag);

  /* ============================================== 5. bookings create (12) */
  group('POST /api/bookings — creation + validation');
  r = await req(port, 'POST', '/api/bookings', { tripId: 'bali', date: '2026-12-01', people: 2, name: 'Test Tester', email: 't@example.com' });
  check('valid booking returns 201', r.status === 201, r.status);
  check('ref matches TRV-XXXXXX (A–Z0–9)', /^TRV-[A-Z0-9]{6}$/.test(r.json && r.json.ref), r.json && r.json.ref);
  check('total = price × people = 498', r.json && r.json.total === 498, r.json && r.json.total);
  check('initial status is pending', r.json && r.json.status === 'pending');
  check('payment.status is checkout_created', r.json && r.json.booking && r.json.booking.payment && r.json.booking.payment.status === 'checkout_created',
    r.json && r.json.booking && r.json.booking.payment);
  check('checkoutUrl points at checkout.html', r.json && typeof r.json.checkoutUrl === 'string' && r.json.checkoutUrl.indexOf('/checkout.html?ref=') === 0, r.json && r.json.checkoutUrl);
  check('lookupUrl carries ref + email', r.json && typeof r.json.lookupUrl === 'string' && r.json.lookupUrl.indexOf('/api/bookings/lookup?ref=') === 0 && r.json.lookupUrl.indexOf('email=') > -1, r.json && r.json.lookupUrl);
  const ref1 = r.json.ref;

  r = await req(port, 'POST', '/api/bookings', { tripId: 'atlantis', date: '2026-12-01', people: 2, name: 'X Y', email: 'a@b.co' });
  check('unknown tripId → 400', r.status === 400 && r.json.details && r.json.details.tripId, r.json);
  r = await req(port, 'POST', '/api/bookings', { tripId: 'bali', date: '2020-01-01', people: 2, name: 'X Y', email: 'a@b.co' });
  check('past date → 400', r.status === 400 && r.json.details && r.json.details.date, r.json);
  r = await req(port, 'POST', '/api/bookings', { tripId: 'bali', date: '2026-12-01', people: 0, name: 'X Y', email: 'a@b.co' });
  check('people=0 → 400', r.status === 400 && r.json.details && r.json.details.people);
  r = await req(port, 'POST', '/api/bookings', { tripId: 'bali', date: '2026-12-01', people: 13, name: 'X Y', email: 'a@b.co' });
  check('people=13 → 400', r.status === 400 && r.json.details && r.json.details.people);
  r = await req(port, 'POST', '/api/bookings', { tripId: 'bali', date: '2026-12-01', people: 2, name: 'X Y', email: 'not-an-email' });
  check('invalid email → 400', r.status === 400 && r.json.details && r.json.details.email);
  r = await req(port, 'POST', '/api/bookings', { tripId: 'bali', date: '2026-12-01', people: 2, name: '  ', email: 'a@b.co' });
  check('empty name → 400', r.status === 400 && r.json.details && r.json.details.name);

  /* ============================================== 6. lookup (4) */
  group('GET /api/bookings/lookup');
  r = await req(port, 'GET', '/api/bookings/lookup?ref=' + ref1 + '&email=t@example.com');
  check('lookup with correct ref+email → 200', r.status === 200 && r.json.booking.ref === ref1);
  r = await req(port, 'GET', '/api/bookings/lookup?ref=' + ref1 + '&email=wrong@example.com');
  check('lookup with wrong email → 404', r.status === 404, r.status);
  r = await req(port, 'GET', '/api/bookings/lookup?ref=TRV-ZZZZZZ&email=t@example.com');
  check('lookup with unknown ref → 404', r.status === 404, r.status);
  r = await req(port, 'GET', '/api/bookings/lookup');
  check('lookup without params → 400', r.status === 400, r.status);

  /* ============================================== 7. payments (12) */
  group('payments — checkout session + confirm cycle');
  r = await req(port, 'POST', '/api/payments/checkout', { ref: ref1 });
  check('checkout creates a cs_test_ session', r.status === 201 && /^cs_test_/.test(r.json && r.json.id), r.json && r.json.id);
  check('checkout returns a checkout URL', r.json && typeof r.json.url === 'string' && r.json.url.indexOf('/checkout.html?ref=' + ref1) === 0, r.json && r.json.url);
  const sessionId = r.json.id;
  r = await req(port, 'GET', '/api/payments/session?id=' + encodeURIComponent(sessionId));
  check('GET session by id → 200 open', r.status === 200 && r.json.session.status === 'open' && r.json.session.ref === ref1, r.json && r.json.session);
  r = await req(port, 'GET', '/api/payments/session?id=cs_test_nope');
  check('unknown session id → 404', r.status === 404, r.status);
  r = await req(port, 'POST', '/api/payments/confirm', { ref: ref1, card: '4242424242424' });
  check('15-digit card → 400', r.status === 400 && r.json.error === 'invalid_card', r.status);
  r = await req(port, 'POST', '/api/payments/confirm', { ref: ref1, card: '4111111111111111' });
  check('random 16-digit card → 400', r.status === 400 && r.json.error === 'unsupported_test_card', r.json && r.json.error);

  r = await req(port, 'POST', '/api/bookings', { tripId: 'thailand', date: '2027-01-15', people: 3, name: 'Decline Me', email: 'd@example.com' });
  const ref2 = r.json.ref;
  r = await req(port, 'POST', '/api/payments/confirm', { ref: ref2, card: '4000 0000 0000 0002' });
  check('card ending 0002 → HTTP 402', r.status === 402 && r.json.error === 'card_declined', r.status);
  check('declined booking stays pending (payment declined)', r.json && r.json.booking && r.json.booking.status === 'pending' && r.json.booking.payment.status === 'declined', r.json && r.json.booking);

  r = await req(port, 'POST', '/api/payments/confirm', { ref: ref2, card: '4242 4242 4242 4242' });
  check('card 4242… → 200 paid', r.status === 200 && r.json.booking.status === 'paid', r.status);
  check('paid sets booking.status AND payment.status', r.json.booking.status === 'paid' && r.json.booking.payment.status === 'paid', r.json.booking.payment);
  r = await req(port, 'GET', '/api/bookings/lookup?ref=' + ref2 + '&email=d@example.com');
  check('lookup now reports paid', r.json && r.json.booking.status === 'paid');
  r = await req(port, 'POST', '/api/payments/confirm', { ref: ref2, card: '4242 4242 4242 4242' });
  check('re-confirm keeps the booking paid', r.status === 200 && r.json.booking.status === 'paid');

  /* ============================================== 8. admin bookings (5) */
  group('admin — bookings management');
  r = await req(port, 'GET', '/api/bookings');
  check('GET /api/bookings without token → 401', r.status === 401, r.status);
  r = await req(port, 'GET', '/api/bookings', undefined, admin);
  check('GET /api/bookings with token lists our refs', r.status === 200 && r.json.bookings.some(function (b) { return b.ref === ref1 || b.ref === ref2; }));
  r = await req(port, 'PATCH', '/api/bookings/' + ref1, { status: 'nonsense' }, admin);
  check('PATCH with invalid status → 400', r.status === 400 && r.json.error === 'invalid_status', r.json && r.json.error);
  r = await req(port, 'POST', '/api/bookings', { tripId: 'paris', date: '2027-03-03', people: 1, name: 'Admin Patch', email: 'p@example.com' });
  const ref3 = r.json.ref;
  r = await req(port, 'PATCH', '/api/bookings/' + ref3, { paid: true }, admin);
  check('PATCH paid:true syncs status + payment.status', r.status === 200 && r.json.booking.status === 'paid' && r.json.booking.payment.status === 'paid', r.json && r.json.booking);
  r = await req(port, 'PATCH', '/api/bookings/' + ref3, { status: 'cancelled' }, admin);
  check('PATCH cancel sets cancelled', r.status === 200 && r.json.booking.status === 'cancelled');

  /* ============================================== 9. leads (5) */
  group('leads');
  r = await req(port, 'POST', '/api/leads', { name: 'Ann Lead', email: 'lead@example.com', message: 'We want to hike in the Alps next spring.' });
  check('POST /api/leads valid → 201', r.status === 201, r.status);
  r = await req(port, 'POST', '/api/leads', { name: 'Ann', email: 'nope', message: 'A long enough message here.' });
  check('lead with bad email → 400', r.status === 400);
  r = await req(port, 'POST', '/api/leads', { name: 'Ann', email: 'a@b.co', message: 'short' });
  check('lead with short message → 400', r.status === 400);
  r = await req(port, 'GET', '/api/leads');
  check('GET /api/leads without token → 401', r.status === 401, r.status);
  r = await req(port, 'GET', '/api/leads', undefined, admin);
  check('GET /api/leads with token → ≥1 lead', r.status === 200 && r.json.count >= 1, r.json && r.json.count);

  /* ============================================== 10. newsletter (5) */
  group('newsletter');
  r = await req(port, 'POST', '/api/subscribe', { email: 'news@example.com' });
  check('POST /api/subscribe → 201', r.status === 201, r.status);
  r = await req(port, 'POST', '/api/subscribe', { email: 'news@example.com' });
  check('duplicate subscribe → 200 already', r.status === 200 && r.json.already === true, r.json);
  r = await req(port, 'POST', '/api/subscribe', { email: 'nope' });
  check('invalid subscribe → 400', r.status === 400, r.status);
  r = await req(port, 'GET', '/api/subscribers');
  check('GET /api/subscribers without token → 401', r.status === 401, r.status);
  r = await req(port, 'GET', '/api/subscribers', undefined, admin);
  check('GET /api/subscribers lists the e-mail', r.status === 200 && r.json.subscribers.some(function (s) { return s.email === 'news@example.com'; }));

  /* ============================================== 11. comments (5) */
  group('comments');
  r = await req(port, 'POST', '/api/comments', { post: 'travel-stories', name: 'Com Menter', text: 'Great read, thank you!' });
  check('POST /api/comments → 201', r.status === 201, r.status);
  r = await req(port, 'POST', '/api/comments', { post: 'travel-stories', name: '', text: 'x' });
  check('comment with empty name → 400', r.status === 400);
  r = await req(port, 'GET', '/api/comments?post=travel-stories');
  check('GET comments returns the posted comment', r.status === 200 && r.json.comments.some(function (c) { return c.name === 'Com Menter'; }));
  r = await req(port, 'GET', '/api/comments?post=no-such-post');
  check('comments for unknown post → empty list, not error', r.status === 200 && r.json.count === 0);
  r = await req(port, 'GET', '/api/comments');
  check('comments without post param → 400', r.status === 400, r.status);

  /* ============================================== 12. events + stats (8) */
  group('analytics events + stats');
  r = await req(port, 'POST', '/api/events', { type: 'pageview', path: '/home-page/' });
  check('POST pageview event → 201', r.status === 201, r.status);
  r = await req(port, 'POST', '/api/events', { type: 'click', path: '/home-page/', label: 'popular-bali' });
  check('POST click event → 201', r.status === 201, r.status);
  r = await req(port, 'POST', '/api/events', { type: 'spam' });
  check('unknown event type → 400', r.status === 400, r.status);
  r = await req(port, 'GET', '/api/stats');
  check('GET /api/stats without token → 401', r.status === 401, r.status);
  r = await req(port, 'GET', '/api/stats', undefined, admin);
  check('GET /api/stats with token → 200', r.status === 200 && r.json.ok === true);
  const list = (await req(port, 'GET', '/api/bookings', undefined, admin)).json.bookings;
  const expectedRevenue = list.filter(function (b) { return b.status === 'paid'; })
    .reduce(function (sum, b) { return sum + b.total; }, 0);
  check('stats sees all bookings', r.json.totals.bookings === list.length, { stats: r.json.totals.bookings, list: list.length });
  check('revenue equals the sum of paid totals', r.json.totals.revenue === expectedRevenue, { stats: r.json.totals.revenue, expected: expectedRevenue });
  check('topPages contains the tracked path', r.json.topPages.some(function (p) { return p.path === '/home-page/'; }));

  /* ============================================== 13. static + traversal (14) */
  group('static serving, traversal protection, sitemap, robots');
  r = await req(port, 'GET', '/');
  check('GET / serves the entry page', r.status === 200 && r.text.indexOf('Travosca') > -1);
  r = await req(port, 'GET', '/home-page/');
  check('GET /home-page/ serves the home page', r.status === 200 && r.text.indexOf('hero') > -1);
  r = await req(port, 'GET', '/admin/');
  check('GET /admin/ serves the admin console', r.status === 200 && r.text.indexOf('Travosca admin') > -1);
  r = await req(port, 'GET', '/checkout.html');
  check('GET /checkout.html serves the checkout page', r.status === 200 && r.text.indexOf('checkout') > -1);
  r = await req(port, 'GET', '/assets/js/api.js');
  check('GET /assets/js/api.js serves the client', r.status === 200 && r.text.indexOf('TravoscaAPI') > -1);

  r = await req(port, 'GET', '/server/server.js');
  check('/server/server.js is NOT served', r.status !== 200, r.status);
  r = await req(port, 'GET', '/server/data/bookings.json');
  check('/server/data/*.json is NOT served', r.status !== 200, r.status);
  r = await req(port, 'GET', '/..%2fetc%2fpasswd');
  check('encoded ../etc/passwd blocked', r.status !== 200, r.status);
  r = await req(port, 'GET', '/%2e%2e%2f%2e%2e%2fetc/passwd');
  check('%2e%2e%2f double-encoded traversal blocked', r.status !== 200, r.status);
  r = await req(port, 'GET', '/..%2f..%2fserver%2fdata%2fbookings.json');
  check('traversal into runtime data blocked', r.status !== 200 && r.text.indexOf('[') !== 0, r.status);

  r = await req(port, 'GET', '/sitemap.xml');
  check('GET /sitemap.xml → 200 urlset', r.status === 200 && r.text.indexOf('<urlset') > -1);
  check('sitemap lists generated trip URLs (dest=bali)', r.text.indexOf('package-page/index.html?dest=bali') > -1);
  check('sitemap entries carry lastmod + priority', r.text.indexOf('<lastmod>') > -1 && r.text.indexOf('<priority>') > -1);
  r = await req(port, 'GET', '/robots.txt');
  check('robots.txt links the sitemap + hides /admin/', r.text.indexOf('Sitemap: https://joy-code1.github.io/TravelWebsite/sitemap.xml') > -1 && r.text.indexOf('Disallow: /admin/') > -1);

  /* ============================================== 14. stripe webhook (3) */
  group('stripe webhook HMAC');
  const secretApp = createApp({
    DATA_DIR: dataDir,
    FRONTEND_DIR: frontDir,
    ADMIN_TOKEN: 'test-admin-token',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret'
  });
  const secretPort = await listen(secretApp.server);
  r = await req(port, 'POST', '/api/webhooks/stripe', { type: 'checkout.session.completed', data: { object: { client_reference_id: ref1 } } });
  check('webhook accepted without secret configured', r.status === 200 && r.json.received === true, r.status);

  const booking4 = (await req(port, 'POST', '/api/bookings', { tripId: 'singapore', date: '2027-02-02', people: 2, name: 'Hook Stripe', email: 'w@example.com' })).json;
  const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { client_reference_id: booking4.ref } } });
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test_secret').update(ts + '.' + payload).digest('hex');
  let raw = await fetch('http://127.0.0.1:' + secretPort + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=' + ts + ',v1=' + sig },
    body: payload
  });
  check('valid HMAC signature accepted (200)', raw.status === 200, raw.status);
  r = await req(port, 'GET', '/api/bookings/lookup?ref=' + booking4.ref + '&email=w@example.com');
  check('webhook marked the booking paid', r.status === 200 && r.json.booking.status === 'paid', r.json && r.json.booking && r.json.booking.status);
  let rawBad = await fetch('http://127.0.0.1:' + secretPort + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=' + ts + ',v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
    body: payload
  });
  check('invalid HMAC signature rejected (400)', rawBad.status === 400, rawBad.status);
  await close(secretApp.server);

  /* ------------------------------------------------------------- summary */
  const total = passed + failed;
  console.log('\n────────────────────────────────────────');
  console.log((total) + '/' + total + ' passed' + (failed ? ' — ' + failed + ' FAILED' : ''));
  if (failed) {
    failures.forEach(function (f) { console.log('  ✗ ' + f); });
  }
  await close(app.server);
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(frontDir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}

main().catch(function (err) {
  console.error('e2e crashed:', err);
  process.exit(1);
});
