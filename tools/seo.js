#!/usr/bin/env node
/* ==========================================================================
   Apply/refresh the SEO block (canonical, Open Graph, Twitter card, JSON-LD)
   in every page.  Idempotent: the previous <!-- BEGIN SEO -->…<!-- END SEO -->
   block is removed before the new one is inserted after <title>.

   Usage: node tools/seo.js            (writes the files in place)
          node tools/seo.js --check    (exit 1 if any file is not up to date)
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://joy-code1.github.io/TravelWebsite';
const CONTENT = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'content.json'), 'utf8'));
const BRAND = (CONTENT.settings && CONTENT.settings.brand) || 'Travosca';

const PAGES = {
  'index.html': {
    url: SITE + '/',
    title: 'Travosca — travel, planned properly',
    description: 'Travosca plans small-group trips to Bali, Paris, the Swiss Alps, Thailand, Taiwan, Lombok and Singapore.',
    image: SITE + '/assets/img/hero-home.jpg',
    type: 'website',
    jsonld: ['organization', 'website']
  },
  'home-page/index.html': {
    url: SITE + '/home-page/',
    title: 'Travosca — Make your journey with handpicked small-group trips',
    description: 'Small-group trips to Bali, Paris, the Swiss Alps, Thailand, Taiwan, Lombok and Singapore. Handpicked hotels, local guides and a price guarantee.',
    image: SITE + '/assets/img/hero-home.jpg',
    type: 'website',
    jsonld: ['organization', 'website', 'breadcrumb-home']
  },
  'package-page/index.html': {
    url: SITE + '/package-page/',
    title: 'Travel packages — Travosca',
    description: 'Seven hand-built small-group itineraries in Asia and Europe — filter, sort and book online with a real checkout and instant booking references.',
    image: SITE + '/assets/img/bg-packages.jpg',
    type: 'website',
    jsonld: ['organization', 'breadcrumb-packages', 'trips']
  },
  'about_us-page/index.html': {
    url: SITE + '/about_us-page/',
    title: 'About us — Travosca',
    description: 'A small team of planners, guides and fixers who would rather travel slowly. Ten years of small groups, handpicked stays and honest prices.',
    image: SITE + '/assets/img/hero-about.jpg',
    type: 'website',
    jsonld: ['organization', 'breadcrumb-about']
  },
  'contact-page/index.html': {
    url: SITE + '/contact-page/',
    title: 'Contact — Travosca',
    description: 'Tell us where you want to go. Offices in Atlanta, Lhoksemawe and Singapore; we usually answer within one working day.',
    image: SITE + '/assets/img/hero-contact.jpg',
    type: 'website',
    jsonld: ['organization', 'breadcrumb-contact']
  },
  'single_blog-page/index.html': {
    url: SITE + '/single_blog-page/',
    title: 'Blog — Travosca',
    description: 'Travel stories, tips and destination guides from the people who plan the trips.',
    image: SITE + '/assets/img/blog-cover.jpg',
    type: 'article',
    jsonld: ['organization', 'breadcrumb-blog', 'article']
  },
  'checkout.html': {
    url: SITE + '/checkout.html',
    title: 'Checkout — Travosca',
    description: 'Pay for your Travosca booking with a card. Test mode: 4242 4242 4242 4242 succeeds, any card ending 0002 is declined.',
    image: SITE + '/assets/img/hero-home.jpg',
    type: 'website',
    jsonld: ['organization']
  }
};

/* ------------------------------------------------------------ JSON-LD bits */
function organization() {
  const s = CONTENT.settings || {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    url: SITE + '/',
    logo: SITE + '/assets/img/logo-dark.png',
    email: s.email,
    telephone: s.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.address,
      addressCountry: 'US'
    },
    sameAs: []
  };
}

function website() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND,
    url: SITE + '/',
    potentialAction: {
      '@type': 'SearchAction',
      target: SITE + '/package-page/index.html?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  };
}

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (item, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: item[0],
        item: SITE + item[1]
      };
    })
  };
}

function trips() {
  // One Product+TouristTrip entity per destination, with offers.
  const entities = (CONTENT.destinations || []).map(function (d) {
    return {
      '@type': 'Product',
      '@id': SITE + '/package-page/index.html?dest=' + d.id + '#trip',
      name: d.title + ' — ' + d.days + ' days in ' + d.country,
      description: d.excerpt,
      image: SITE + '/assets/img/' + d.photo,
      additionalType: 'https://schema.org/TouristTrip',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: d.rating,
        reviewCount: d.reviews
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: d.price,
        availability: 'https://schema.org/InStock',
        url: SITE + '/package-page/index.html?dest=' + d.id
      }
    };
  });
  return {
    '@context': 'https://schema.org',
    '@graph': entities
  };
}

function article() {
  const post = (CONTENT.posts || []).find(function (p) { return p.featured; }) || CONTENT.posts[0];
  if (!post) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: [SITE + '/assets/img/' + post.photo],
    datePublished: post.date,
    dateModified: (CONTENT.settings && CONTENT.settings.updated) || post.date,
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: BRAND,
      logo: { '@type': 'ImageObject', url: SITE + '/assets/img/logo-dark.png' }
    },
    mainEntityOfPage: SITE + '/single_blog-page/index.html?post=' + post.id
  };
}

const JSONLD = {
  'organization': organization,
  'website': website,
  'breadcrumb-home': () => breadcrumb([['Home', '/home-page/']]),
  'breadcrumb-packages': () => breadcrumb([['Home', '/home-page/'], ['Packages', '/package-page/']]),
  'breadcrumb-about': () => breadcrumb([['Home', '/home-page/'], ['About us', '/about_us-page/']]),
  'breadcrumb-contact': () => breadcrumb([['Home', '/home-page/'], ['Contact', '/contact-page/']]),
  'breadcrumb-blog': () => breadcrumb([['Home', '/home-page/'], ['Blog', '/single_blog-page/']]),
  'trips': trips,
  'article': article
};

/* ----------------------------------------------------------------- block */
function buildBlock(meta) {
  const lines = [];
  lines.push('<link rel="canonical" href="' + meta.url + '">');
  lines.push('<meta property="og:title" content="' + meta.title + '">');
  lines.push('<meta property="og:description" content="' + meta.description + '">');
  lines.push('<meta property="og:image" content="' + meta.image + '">');
  lines.push('<meta property="og:url" content="' + meta.url + '">');
  lines.push('<meta property="og:type" content="' + meta.type + '">');
  lines.push('<meta property="og:site_name" content="' + BRAND + '">');
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  lines.push('<meta name="twitter:title" content="' + meta.title + '">');
  lines.push('<meta name="twitter:description" content="' + meta.description + '">');
  lines.push('<meta name="twitter:image" content="' + meta.image + '">');
  lines.push('<meta name="description" content="' + meta.description + '">');
  meta.jsonld.forEach(function (key) {
    const data = JSONLD[key]();
    if (!data) return;
    lines.push('<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>');
  });
  return '<!-- BEGIN SEO -->\n' + lines.join('\n') + '\n<!-- END SEO -->';
}

function apply(file, meta) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, 'utf8');

  // Idempotency: drop any previous SEO block (and stray duplicate meta
  // descriptions / canonicals outside it).
  html = html.replace(/<!-- BEGIN SEO -->[\s\S]*?<!-- END SEO -->\n?/g, '');
  html = html.replace(/[ \t]*<meta name="description" content="[^"]*">\n/g, '');
  html = html.replace(/[ \t]*<link rel="canonical" href="[^"]*">\n/g, '');

  const block = buildBlock(meta);
  if (/<\/title>/.test(html)) {
    html = html.replace('</title>', '</title>\n' + block);
  } else {
    console.error('[seo] no <title> in ' + file);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(full, html);
  console.log('[seo] ' + file + ' — canonical + OG + Twitter + ' +
    meta.jsonld.length + ' JSON-LD block(s)');
}

const check = process.argv.includes('--check');
if (check) {
  let stale = 0;
  Object.keys(PAGES).forEach(function (file) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const m = html.match(/<!-- BEGIN SEO -->[\s\S]*?<!-- END SEO -->/);
    if (!m || m[0] !== buildBlock(PAGES[file])) {
      stale++;
      console.error('[seo] ' + file + ' SEO block missing or stale — run `npm run seo`');
    }
  });
  if (!stale) console.log('[seo] all ' + Object.keys(PAGES).length + ' pages up to date');
  process.exit(stale ? 1 : 0);
} else {
  Object.keys(PAGES).forEach(function (file) { apply(file, PAGES[file]); });
}
