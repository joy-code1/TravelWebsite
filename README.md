# Travosca — static travel site + zero-dependency backend

A five-page vanilla HTML/CSS/JS travel website **plus** a second layer: a CMS,
real bookings with a (test-mode) payment flow, leads, newsletter, comments,
cookie-free analytics, an admin console, EN/RU/UZ localisation and SEO —
all with **no build step, no framework and zero npm dependencies**.

The frontend stays fully static: open the folder on GitHub Pages or with
`python3 -m http.server` and everything keeps working in **local mode** —
content comes from `assets/js/data.js`, forms confirm locally, comments fall
back to `localStorage`. Start the Node backend and the same pages
transparently switch to real bookings and payments.

```
TravelWebsite/
├── index.html                 entry stub → redirects to the home page
├── home-page/                 home: hero search, trips, why-us, partners, testimonials
├── package-page/              packages: filter/sort/search + booking modal + last-booking block
├── about_us-page/             about: values, story, stats, gallery lightbox
├── contact-page/              contact: validated form (→ /api/leads), offices, FAQ
├── single_blog-page/          blog: article, sidebar, comments (API + localStorage fallback)
├── checkout.html              card payment page for a booking reference
├── admin/                     admin console (token login, CMS, bookings, leads, analytics)
├── server/
│   ├── server.js              the whole backend — node:http/fs/path/crypto/https only
│   └── data/content.json      SINGLE SOURCE OF TRUTH for content (committed seed)
├── assets/js/data.js          GENERATED from content.json (npm run sync) — do not edit
├── assets/js/api.js           window.TravoscaAPI client (4s timeout, offline fallback)
├── assets/js/i18n.js          window.TravoscaI18n — EN/RU/UZ, ~260 keys
├── tools/
│   ├── sync-content.js        content.json → assets/js/data.js
│   ├── seo.js                 idempotent canonical/OG/Twitter/JSON-LD blocks
│   ├── demo-seed.js           demo bookings/leads/subscribers/events
│   └── e2e-test.js            96 end-to-end checks against a real server
└── package.json               scripts only — no dependencies
```

## Quick start

```bash
npm start                 # http://localhost:4173 (binds 0.0.0.0)
PORT=8000 npm start       # custom port
npm run seed && npm start # start with demo data for the admin console
npm test                  # 96/96 end-to-end checks (boots a real server on a temp dir)
npm run sync              # regenerate assets/js/data.js from server/data/content.json
npm run seo               # re-apply the SEO block to every page (idempotent)
```

Static-only mode (no Node): open `home-page/index.html` directly, or deploy the
repo to GitHub Pages — everything renders from the generated `data.js` and all
forms confirm locally with a “no server” note.

Admin console: **http://localhost:4173/admin/** — default token `travosca-admin`
(override with `ADMIN_TOKEN`).

## 10-step verification

| # | Do this | You should see |
| --- | --- | --- |
| 1 | `npm test` | `96/96 passed`, exit code 0 |
| 2 | `npm run seed && PORT=8000 npm start` | server banner with `payments: mock` |
| 3 | Open `http://localhost:8000/home-page/` | the site as before + EN/RU/UZ switch in the header |
| 4 | Switch the language to RU/УЗ, then reload | interface + trip cards stay translated (stored in localStorage) |
| 5 | Packages → “Booking now” → fill the modal | `TRV-XXXXXX` reference, `$total`, status `pending`, “Continue to payment” |
| 6 | On checkout.html pay with `4242 4242 4242 4242` | “Payment received”, booking status → `paid` |
| 7 | Pay another booking with a card ending `0002` | HTTP 402, “Card declined”, booking stays `pending` |
| 8 | Reload the Packages page | “Your recent booking” return block with ref, total and live status |
| 9 | Open `/admin/`, sign in with the token | Overview stats, Trips CMS, Bookings (mark paid / cancel), Leads, Newsletter, Analytics, CSV export |
| 10 | Edit a trip title in /admin/ → Save | `assets/js/data.js` regenerated; reload the site shows the new title |

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | HTTP port (binds `0.0.0.0`) |
| `ADMIN_TOKEN` | `travosca-admin` | protects `PUT /api/content`, `GET /api/bookings`, `PATCH`, admin GETs and `/api/stats` via `x-admin-token` |
| `STRIPE_SECRET_KEY` | *(empty → mock)* | with a real key, `POST /api/payments/checkout` creates a genuine Stripe Checkout Session through `node:https` (no SDK) |
| `STRIPE_WEBHOOK_SECRET` | *(empty)* | when set, `POST /api/webhooks/stripe` requires a valid `t=…,v1=…` HMAC-SHA256 signature (constant-time compare) |
| `CRM_WEBHOOK_URL` | *(empty)* | bookings / leads / payments / subscribers are forwarded with an `x-travosca-signature` (HMAC-SHA256 of the body, keyed with `ADMIN_TOKEN`) |
| `SITE_URL` | `https://joy-code1.github.io/TravelWebsite` | absolute URL base for sitemap.xml, robots.txt and Stripe redirect URLs |
| `DATA_DIR` | `server/data` | where the JSON files live (tests point it at a temp dir) |
| `FRONTEND_DIR` | repo root | where the generated `assets/js/data.js` is written (tests use a temp dir) |

## API reference (curl recipes)

```bash
BASE=http://localhost:4173
TOKEN=travosca-admin

# health / content
curl -s $BASE/api/health
curl -s $BASE/api/content
curl -s -X PUT $BASE/api/content -H "x-admin-token: $TOKEN" \
  -H 'content-type: application/json' -d @server/data/content.json   # validates + regenerates data.js

# trips: filter / sort / localise
curl -s "$BASE/api/trips?region=Asia&sort=price"
curl -s "$BASE/api/trips?q=alps&minPrice=300"
curl -s "$BASE/api/trips?lang=ru"          # localized titles/tags/excerpts

# bookings
REF=$(curl -s -X POST $BASE/api/bookings -H 'content-type: application/json' \
  -d '{"tripId":"bali","date":"2026-12-01","people":2,"name":"Test","email":"t@example.com"}' \
  | grep -oP '"ref":"\K[^"]+')
curl -s "$BASE/api/bookings/lookup?ref=$REF&email=t@example.com"
curl -s $BASE/api/bookings -H "x-admin-token: $TOKEN"                # admin list
curl -s -X PATCH $BASE/api/bookings/$REF -H "x-admin-token: $TOKEN" \
  -H 'content-type: application/json' -d '{"status":"paid"}'         # or {"paid":true} / {"status":"cancelled"}

# payments (mock contract mirrors Stripe Checkout)
curl -s -X POST $BASE/api/payments/checkout -H 'content-type: application/json' -d "{\"ref\":\"$REF\"}"
curl -s "$BASE/api/payments/session?id=cs_test_…"
curl -s -X POST $BASE/api/payments/confirm -H 'content-type: application/json' \
  -d "{\"ref\":\"$REF\",\"card\":\"4242 4242 4242 4242\"}"            # → 200 paid
curl -s -X POST $BASE/api/payments/confirm -H 'content-type: application/json' \
  -d "{\"ref\":\"$REF\",\"card\":\"4000 0000 0000 0002\"}"            # → 402, stays pending
curl -s -i -X POST $BASE/api/payments/confirm -H 'content-type: application/json' \
  -d "{\"ref\":\"$REF\",\"card\":\"4111111111111111\"}"               # → 400 unsupported_test_card

# leads / newsletter / comments
curl -s -X POST $BASE/api/leads -H 'content-type: application/json' \
  -d '{"name":"Ann","email":"a@b.co","message":"We want to hike in the Alps."}'
curl -s $BASE/api/leads -H "x-admin-token: $TOKEN"
curl -s -X POST $BASE/api/subscribe -H 'content-type: application/json' -d '{"email":"x@y.z"}'
curl -s $BASE/api/subscribers -H "x-admin-token: $TOKEN"
curl -s "$BASE/api/comments?post=travel-stories"
curl -s -X POST $BASE/api/comments -H 'content-type: application/json' \
  -d '{"post":"travel-stories","name":"Ann","text":"Great read!"}'

# analytics + stats
curl -s -X POST $BASE/api/events -H 'content-type: application/json' \
  -d '{"type":"pageview","path":"/home-page/"}'
curl -s -X POST $BASE/api/events -H 'content-type: application/json' \
  -d '{"type":"click","path":"/home-page/","label":"popular-bali"}'
curl -s $BASE/api/stats -H "x-admin-token: $TOKEN"

# SEO
curl -s $BASE/sitemap.xml
curl -s $BASE/robots.txt

# stripe webhook (only checked when STRIPE_WEBHOOK_SECRET is set)
TS=$(date +%s); SECRET=whsec_xxx; BODY='{"type":"checkout.session.completed","data":{"object":{"client_reference_id":"TRV-XXXXXX"}}}'
SIG=$(printf '%s.%s' $TS "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/.* //')
curl -s -X POST $BASE/api/webhooks/stripe -H "stripe-signature: t=$TS,v1=$SIG" \
  -H 'content-type: application/json' -d "$BODY"
```

## CMS — editing content without touching code

`server/data/content.json` is the single source of truth: `settings`
(brand/e-mail/phone/address), `destinations[]` (id, title, country, region,
price, days, rating, reviews, photo, photoSm, tag, excerpt, highlights,
i18n), `features[]`, `testimonials[]`, `partners[]`, `posts[]`, `gallery[]`,
`offices[]`, `months[]`. Every destination/feature/testimonial/post also
carries `i18n.ru` / `i18n.uz` translations.

- `GET /api/content` — public read.
- `PUT /api/content` (admin token) — validates the schema, saves atomically,
  **regenerates `assets/js/data.js`** and bumps `settings.updated` (used by
  sitemap `lastmod`).
- `/admin/` → *Trips (CMS)* tab edits destinations and settings through that API.
- CLI equivalent: edit `server/data/content.json`, then `npm run sync`.

`assets/js/data.js` is generated (see its header) — never edit it by hand.

## Bookings & payments model

- `POST /api/bookings` validates tripId/date-in-the-future/people 1–12/name/
  e-mail, computes `total = price × people`, mints a `TRV-XXXXXX` reference
  (6 chars A–Z0–9), stores `status: 'pending'` + `payment.status:
  'checkout_created'`, creates a checkout session and returns
  `{ ref, total, checkoutUrl, lookupUrl }`.
- The client (`assets/js/api.js`) tries the server first; on static hosting it
  falls back to the old local confirmation and shows a “local mode” banner.
- `checkout.html` pays by card. Test contract: `4242 4242 4242 4242` → paid
  (both `booking.status='paid'` **and** `booking.payment.status='paid'`), any
  16-digit card ending `0002` → HTTP 402 and the booking stays pending,
  anything else / not 16 digits → 400. Card data is validated and never stored.
- With `STRIPE_SECRET_KEY` set, `POST /api/payments/checkout` creates a real
  Stripe Checkout Session over HTTPS (form-encoded API call via `node:https`).
  Completion arrives through `POST /api/webhooks/stripe`, whose
  `stripe-signature` HMAC is verified in constant time when
  `STRIPE_WEBHOOK_SECRET` is configured.

## i18n (EN / RU / UZ)

`assets/js/i18n.js` exposes `window.TravoscaI18n` with a ~260-key dictionary,
`t(key, vars)`, `field(item, name, lang)` (reads `item.i18n.<lang>.<name>`
with base-field fallback), `month(i)`, `set(lang)`, `apply()`. The language
is stored in `localStorage['travosca:lang']`; every change dispatches
`travosca:langchange`, which home/packages/blog use to re-render dynamic
content. Switchers (`[data-lang-switch]`) sit in the header and the mobile
menu; static strings are wired through `data-i18n*` attributes.

## SEO

Every page carries a `<!-- BEGIN SEO --> … <!-- END SEO -->` block (idempotent
— `npm run seo` rewrites it): absolute canonical
(`https://joy-code1.github.io/TravelWebsite/…`), Open Graph
(title/description/image/url/type/site_name), Twitter summary_large_image,
meta description and JSON-LD — `Organization` everywhere, `WebSite` +
`BreadcrumbList` on content pages, one `Product` with `offers` (+
`additionalType: TouristTrip`) per trip on the packages page, `Article` on
the blog. `/sitemap.xml` lists all pages plus per-trip and per-post URLs with
`lastmod`/`priority`; `/robots.txt` allows crawling, hides `/admin/` and
`/api/`, and links the sitemap.

## Verification

- `npm test` — 96 checks against a **real** server on an ephemeral port with a
  temp data dir: health, content GET/PUT + mirroring, trips filters/sorting/
  localisation, booking validation, lookup, full payment cycle (4242 → paid,
  …0002 → 402, invalid → 400), admin booking ops, leads, newsletter,
  comments, analytics, stats math, path traversal (incl. `%2e%2e`), static
  serving, sitemap/robots, webhook HMAC.
- `npx html-validate` passes on all documents (home, packages, about, contact,
  blog, checkout, admin, index).
- jsdom run: every page boots with its real scripts against the live server —
  cards/article render, the language switch translates and re-renders, and
  with the server down the offline banner shows and content still renders.

## Known limitations (honest list)

- **Payments are mock by default.** Without `STRIPE_SECRET_KEY` the checkout
  session is a local `cs_test_…` object and confirm() simulates the card
  result. Real Stripe mode only creates the session; confirm still needs the
  webhook/test flow.
- **No SSR** — pages are static HTML + client-side rendering; crawlers see the
  SEO meta/JSON-LD but the trip lists render in the browser.
- **Blog article bodies stay English** (only titles/excerpts/meta are
  translated); a few long static paragraphs (company story, FAQ answers) are
  English-only too.
- **Storage is JSON files** with atomic writes — perfect for a demo/small
  team, not a multi-instance production DB. No auth rate limiting.
- **Photos are from Unsplash** (optimised locally); no e-mail is actually sent
  — confirmations appear in the UI/lookup only.
- The root `index.html` redirect stub intentionally does not load api.js
  (it would double-count the pageview before bouncing to the home page).

## Regenerating the images

`tools/build-assets.py` rebuilds `assets/img/` from the original artwork kept
in git history (needs ImageMagick) — unchanged from the previous layer, see
`git log`.

## Browser support

Chromium, Firefox and Safari (current + previous major). ES2017 syntax,
`IntersectionObserver` and `fetch` are feature-detected; without them the
site degrades to the static/local experience instead of breaking.
