# Travosca — travel website

A responsive, interactive travel site: five static pages, no build step, no framework.
Open `index.html` and it takes you to the home page.

```
TravelWebsite/
├── index.html                 entry point → redirects to the home page
├── home-page/index.html       home: hero search, trip carousel, why-us, partners, testimonials
├── package-page/index.html    packages: filter / sort / search + booking modal
├── about_us-page/index.html   about: values, story, animated stats, gallery lightbox
├── contact-page/index.html    contact: validated form, offices, FAQ accordion
├── single_blog-page/index.html blog: article, sidebar, comment thread
├── assets/
│   ├── css/base.css           design tokens, header, footer, forms, carousel, modal, lightbox
│   ├── css/{home,packages,about,contact,blog}.css
│   ├── js/data.js             all shared content (destinations, testimonials, posts, …)
│   ├── js/ui.js               shared behaviour (menu, search, carousels, modal, toasts, reveals)
│   ├── js/{home,packages,about,contact,blog}.js
│   └── img/                   optimised artwork (4.7 MB, was 171 MB)
└── tools/build-assets.py      regenerates assets/img from the original artwork
```

## Running it

Any static server works — the site is plain HTML/CSS/JS:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

It also deploys as-is to GitHub Pages, Netlify, S3 or any web host. No build, no dependencies.

## What was fixed

**Broken / dead things**

- Navigation was built from `<select>` elements whose options (`Saab`, `Mercedes`, `Audi`) were placeholders — replaced with real links and a working "Packages" dropdown.
- Dead links: `About Us` pointed at the packages page, `Tours` pointed at a directory, `Contact` pointed at `#`. All links now resolve.
- Footer contact icons were swapped (envelope icon on the phone number, phone icon on the email) — corrected, and the phone/email are now `tel:` / `mailto:` links.
- Duplicate `id` attributes (`id="cars"` three times on every page, `id="send"` on every newsletter form).
- Missing page entry point: the repository root had no `index.html`, so the site only opened if you knew the path of a sub-folder.

**Performance**

- The original artwork was SVG files wrapping full-resolution base64 PNGs — 171 MB in total, with the same photo committed up to five times. Everything is now extracted, resized and re-encoded to sensible dimensions: **4.7 MB**, ~97 % smaller.
- Images use `srcset`/`sizes`, `loading="lazy"`, `decoding="async"` and explicit `width`/`height` (no layout shift). Large backgrounds swap to a `-sm` variant on phones.
- Dropped the Font Awesome CDN (a broken SRI hash would have silently killed every icon) for a local SVG sprite in `assets/img/icons.svg`.

**Responsive**

- Nothing was responsive before: fixed pixel widths up to 1890 px, `height: 100vh` sections and a 357 px logo meant horizontal scrolling on any phone.
- Rebuilt on a fluid system — `clamp()` typography, CSS grid/flex, breakpoints at 1100/1000/960/900/860/760/640/560/420 px, and `svh` units so mobile browser chrome does not clip the hero.
- Touch targets, focus states, `prefers-reduced-motion` and a skip link were added throughout.

**Content**

- Replaced the `Lorem ipsum` filler with real copy for a travel company.
- Added `alt` text to every image, `aria-label`s, `aria-expanded` on every control that toggles, and landmarks.

## What was added (interactivity)

| Feature | Where |
| --- | --- |
| Sticky header that turns solid on scroll and swaps to the dark logo | all pages |
| Off-canvas mobile menu (Esc, scrim click, focus trap, scroll lock) | all pages |
| Site-wide destination search overlay with live results | all pages |
| Hero trip search → filters the packages page via URL params | home → packages |
| Carousels with buttons, dots, keyboard, swipe and pausing autoplay | home |
| Live filtering, sorting and text search with result count and empty state | packages |
| Booking modal with validation, focus trap and success state | packages |
| Animated counters and a gallery lightbox (arrows, Esc, caption) | about |
| Contact form with per-field validation and inline confirmation | contact |
| FAQ accordion | contact |
| Article switching via `?post=`, copy-link share, comment thread | blog |
| Newsletter validation, scroll reveals, back-to-top, toasts | all pages |

Forms have no back end: they validate on the client and confirm locally, so nothing pretends to be saved on a server. Comments are stored in `localStorage`.

## Editing content

Every repeated piece of content lives in `assets/js/data.js` — destinations, features,
testimonials, partners, blog posts, gallery, offices. Change it there and all pages update.

## Regenerating the images

`tools/build-assets.py` rebuilds `assets/img/` from the original artwork, which now only
exists in git history (it was too heavy to keep in the working tree):

```bash
git show 830b4ec --stat >/dev/null        # the original commit
git checkout 830b4ec -- home-page/imges about_us-page/img contact-page/img package-page/img single_blog-page/img
python3 tools/build-assets.py             # needs ImageMagick (`convert`)
git rm -r --cached home-page/imges about_us-page/img ...   # keep the tree lean again
```

The script skips any source file that is missing, so it is safe to run at any time.

## Browser support

Chromium, Firefox and Safari (current and previous major), desktop and mobile.
No polyfills, no transpilation — ES2017 syntax plus `IntersectionObserver`, which is
feature-detected and degrades to "show everything".
