/* ==========================================================================
   Travosca — home page behaviour
   Renders the trip cards, features, partners and testimonials, and wires the
   hero search box to the packages page.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.TRAVOSCA || {};
  var U = window.TravoscaUI;
  var base = D.base || '../';

  function img(name) { return base + 'assets/img/' + name; }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function stars(rating) {
    var filled = Math.round(rating);
    var out = '';
    for (var i = 0; i < 5; i++) {
      out += '<svg class="icon' + (i < filled ? '' : ' is-empty') + '" aria-hidden="true"><use href="' +
        base + 'assets/img/icons.svg#i-star"></use></svg>';
    }
    return out;
  }

  /* ------------------------------------------------------------- trip cards */
  function renderDestinations() {
    var track = document.querySelector('[data-dest-track]');
    var total = document.querySelector('[data-dest-total]');
    if (!track || !D.destinations) return;

    track.innerHTML = D.destinations.map(function (d) {
      return '' +
        '<article class="trip-card card card--hover">' +
          '<div class="trip-card__media">' +
            '<img src="' + img(d.photoSm) + '" srcset="' + img(d.photoSm) + ' 560w, ' + img(d.photo) + ' 900w" ' +
              'sizes="(max-width: 700px) 90vw, (max-width: 1100px) 45vw, 30vw" ' +
              'alt="' + esc(d.title + ', ' + d.country) + '" width="900" height="620" loading="lazy" decoding="async">' +
            '<span class="trip-card__tag">' + esc(d.tag) + '</span>' +
          '</div>' +
          '<div class="trip-card__body">' +
            '<div class="trip-card__top">' +
              '<div>' +
                '<h3 class="trip-card__title">' + esc(d.title) + '</h3>' +
                '<p class="trip-card__place">' + U.icon('map-pin', 'icon--sm') + esc(d.country) + '</p>' +
              '</div>' +
              '<p class="trip-card__price">$' + d.price + '<span>/ ' + d.days + ' days</span></p>' +
            '</div>' +
            '<p class="trip-card__text">' + esc(d.excerpt) + '</p>' +
            '<div class="trip-card__foot">' +
              '<span class="rating" aria-label="' + d.rating + ' out of 5">' + stars(d.rating) +
                '<span class="rating__value">' + d.rating.toFixed(1) + ' (' + d.reviews + ')</span></span>' +
              '<a class="link-arrow" href="' + base + 'package-page/index.html?dest=' + encodeURIComponent(d.id) + '">View trip' +
                U.icon('arrow-right') + '</a>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    if (total) total.textContent = String(D.destinations.length);
  }

  /* --------------------------------------------------------------- features */
  function renderFeatures() {
    var grid = document.querySelector('[data-why-grid]');
    if (!grid || !D.features) return;
    grid.innerHTML = D.features.map(function (f, i) {
      return '' +
        '<article class="feature-card" data-reveal style="--reveal-delay:' + (i * 110) + 'ms">' +
          '<span class="feature-card__icon"><img src="' + img(f.icon) + '" alt="" width="96" height="98" loading="lazy"></span>' +
          '<h3>' + esc(f.title) + '</h3>' +
          '<p>' + esc(f.text) + '</p>' +
          '<a class="link-arrow" href="' + base + f.link + '">Learn more' + U.icon('arrow-right') + '</a>' +
        '</article>';
    }).join('');
  }

  /* --------------------------------------------------------------- partners */
  function renderPartners() {
    var wrap = document.querySelector('[data-partners]');
    if (!wrap || !D.partners) return;
    wrap.innerHTML = D.partners.map(function (p) {
      return '<img src="' + img(p.logo) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">';
    }).join('');
  }

  /* ----------------------------------------------------------- testimonials */
  function renderTestimonials() {
    var track = document.querySelector('[data-testimonial-track]');
    if (!track || !D.testimonials) return;
    track.innerHTML = D.testimonials.map(function (t) {
      return '' +
        '<article class="quote-card">' +
          '<svg class="quote-card__mark" aria-hidden="true"><use href="' + base + 'assets/img/icons.svg#i-quote"></use></svg>' +
          '<p class="quote-card__text">“' + esc(t.text) + '”</p>' +
          '<div class="rating rating--lg" aria-label="' + t.rating + ' out of 5">' + stars(t.rating) + '</div>' +
          '<div class="quote-card__person">' +
            '<img src="' + img(t.avatar) + '" alt="' + esc(t.name) + '" width="260" height="260" loading="lazy">' +
            '<div><strong>' + esc(t.name) + '</strong><span>' + esc(t.role) + '</span></div>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* ---------------------------------------------------------- hero search */
  function initTripSearch() {
    var form = document.querySelector('[data-trip-search]');
    if (!form) return;
    var dest = form.querySelector('#ts-location');
    var month = form.querySelector('#ts-month');
    var people = form.querySelector('#ts-people');

    function go() {
      var params = [];
      if (dest && dest.value) params.push('dest=' + encodeURIComponent(dest.value));
      if (month && month.value) params.push('month=' + encodeURIComponent(month.value));
      if (people && people.value) params.push('people=' + encodeURIComponent(people.value));
      var url = base + 'package-page/index.html' + (params.length ? '?' + params.join('&') : '');
      U.go(url);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      go();
    });

    var chips = document.querySelectorAll('[data-popular] .chip');
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener('click', function () {
        Array.prototype.forEach.call(chips, function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        if (dest) dest.value = chip.getAttribute('data-dest') || '';
        go();
      });
    });
  }

  renderDestinations();
  renderFeatures();
  renderPartners();
  renderTestimonials();
  initTripSearch();
})();
