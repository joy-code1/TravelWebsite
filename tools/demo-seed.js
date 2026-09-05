#!/usr/bin/env node
/* ==========================================================================
   Travosca — demo data seeder (npm run seed)

   Writes demo bookings / leads / subscribers / analytics events into DATA_DIR
   (default server/data) so the admin console has something to show.
   Existing runtime files are REPLACED.  content.json is never touched.
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'server', 'data');
const CONTENT = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'content.json'), 'utf8'));

function write(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, name + '.json');
  const tmp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function ref() {
  let out = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 6; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return 'TRV-' + out;
}

function trip(id) {
  return CONTENT.destinations.find(function (d) { return d.id === id; });
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function ago(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

/* ------------------------------------------------------------- bookings */
const demoBookings = [
  { tripId: 'bali', people: 2, name: 'Sara Jay', email: 'sara@example.com', date: daysFromNow(45), paid: true, ago: 4320 },
  { tripId: 'swiss', people: 4, name: 'Cristian Daniel', email: 'cristian@example.com', date: daysFromNow(90), paid: true, ago: 2880 },
  { tripId: 'thailand', people: 3, name: 'Kausar Hasan', email: 'kausar@example.com', date: daysFromNow(60), paid: true, ago: 1500 },
  { tripId: 'paris', people: 2, name: 'Mia Walker', email: 'mia@example.com', date: daysFromNow(30), paid: false, ago: 720 },
  { tripId: 'singapore', people: 1, name: 'Leo Tan', email: 'leo@example.com', date: daysFromNow(21), paid: false, cancelled: true, ago: 300 }
].map(function (seed) {
  const t = trip(seed.tripId);
  const total = t.price * seed.people;
  const createdAt = ago(seed.ago);
  return {
    ref: ref(),
    tripId: t.id,
    tripTitle: t.title,
    country: t.country,
    region: t.region,
    price: t.price,
    days: t.days,
    date: seed.date,
    people: seed.people,
    name: seed.name,
    email: seed.email,
    notes: 'Demo booking seeded by tools/demo-seed.js',
    total: total,
    status: seed.cancelled ? 'cancelled' : (seed.paid ? 'paid' : 'pending'),
    payment: {
      method: 'card',
      status: seed.cancelled ? 'cancelled' : (seed.paid ? 'paid' : 'checkout_created'),
      session: 'cs_test_' + crypto.randomBytes(12).toString('hex'),
      last4: seed.paid ? '4242' : null,
      paidAt: seed.paid ? ago(seed.ago - 2) : null
    },
    createdAt: createdAt,
    updatedAt: createdAt,
    source: 'seed'
  };
});

/* ---------------------------------------------------------------- leads */
const demoLeads = [
  {
    id: 'LEAD-demo01', name: 'Amelia Fardows', email: 'amelia@example.com', phone: '+1 404 555 0132',
    subject: 'Honeymoon in Bali', message: 'We are planning a 6-day honeymoon in Bali next June and would love a boutique stay with a pool.',
    status: 'new', createdAt: ago(2600)
  },
  {
    id: 'LEAD-demo02', name: 'Rustam Karimov', email: 'rustam@example.com', phone: '+998 90 123 4567',
    subject: 'Group trip to the Alps', message: 'Ten colleagues want the Glacier Express route in September — can you arrange a private guide?',
    status: 'new', createdAt: ago(900)
  }
];

/* ---------------------------------------------------------- subscribers */
const demoSubscribers = [
  { email: 'wanderlust@example.com', createdAt: ago(20160) },
  { email: 'deals@example.com', createdAt: ago(4320) }
];

/* --------------------------------------------------------------- events */
const PATHS = [
  ['/home-page/', 34], ['/package-page/', 22], ['/package-page/index.html?dest=bali', 9],
  ['/package-page/index.html?dest=swiss', 6], ['/about_us-page/', 11], ['/contact-page/', 8],
  ['/single_blog-page/', 12], ['/checkout.html', 4]
];
const CLICKS = [
  ['popular-bali', 7], ['popular-paris', 5], ['hero-search', 9], ['nav-cta', 6],
  ['book-bali', 3], ['book-swiss', 2], ['click_outbound', 4]
];

const demoEvents = [];
let eid = 0;
PATHS.forEach(function (pair) {
  for (let i = 0; i < pair[1]; i++) {
    demoEvents.push({
      id: 'EVT-seed' + String(++eid).padStart(3, '0'),
      type: 'pageview',
      path: pair[0],
      label: '',
      data: { seeded: true },
      ts: ago(5 + i * 11 + Math.floor(Math.random() * 7))
    });
  }
});
CLICKS.forEach(function (pair) {
  for (let i = 0; i < pair[1]; i++) {
    demoEvents.push({
      id: 'EVT-seed' + String(++eid).padStart(3, '0'),
      type: pair[0] === 'click_outbound' ? 'click_outbound' : 'click',
      path: '/home-page/',
      label: pair[0],
      data: { seeded: true },
      ts: ago(6 + i * 17 + Math.floor(Math.random() * 9))
    });
  }
});

/* ------------------------------------------------------------- comments */
const demoComments = [
  {
    id: 'CMT-demo01', post: 'travel-stories', name: 'Nodira R.',
    text: 'The "one place, seen properly" line changed how I plan trips. Thank you!',
    createdAt: ago(7000)
  },
  {
    id: 'CMT-demo02', post: 'destinations-on-sale', name: 'Hans M.',
    text: 'Booked Taiwan for October based on this — the night market tips alone were worth it.',
    createdAt: ago(3000)
  }
];

write('bookings', demoBookings);
write('leads', demoLeads);
write('subscribers', demoSubscribers);
write('events', demoEvents);
write('comments', demoComments);

const revenue = demoBookings.filter(function (b) { return b.status === 'paid'; })
  .reduce(function (sum, b) { return sum + b.total; }, 0);

console.log('[seed] demo data written to ' + DATA_DIR);
console.log('[seed] bookings: ' + demoBookings.length +
  ' (' + demoBookings.filter(function (b) { return b.status === 'paid'; }).length + ' paid, revenue $' + revenue + ')' +
  ' · leads: ' + demoLeads.length +
  ' · subscribers: ' + demoSubscribers.length +
  ' · events: ' + demoEvents.length +
  ' · comments: ' + demoComments.length);
console.log('[seed] refs: ' + demoBookings.map(function (b) { return b.ref + ' (' + b.status + ')'; }).join(', '));
