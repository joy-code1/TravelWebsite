/* ==========================================================================
   Travosca — packages page
   Renders the package grid, wires live filtering / sorting, reads the search
   parameters sent by the home page and handles the booking modal.
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

  var state = { query: '', region: '', sort: 'popular', dest: '', month: '', people: '' };

  /* ------------------------------------------------------------- rendering */
  function cardHtml(d) {
    var highlights = (d.highlights || []).slice(0, 3).map(function (h) {
      return '<li>' + U.icon('check') + esc(h) + '</li>';
    }).join('');

    return '' +
      '<article class="pkg-card" id="pkg-' + esc(d.id) + '" data-region="' + esc(d.region) + '">' +
        '<div class="pkg-card__media">' +
          '<img src="' + img(d.photoSm) + '" srcset="' + img(d.photoSm) + ' 560w, ' + img(d.photo) + ' 900w" ' +
            'sizes="(max-width: 640px) 92vw, (max-width: 1000px) 46vw, 31vw" ' +
            'alt="' + esc(d.title + ', ' + d.country) + '" width="900" height="620" loading="lazy" decoding="async">' +
          '<span class="pkg-card__tag">' + esc(d.tag) + '</span>' +
          '<span class="pkg-card__region">' + esc(d.region) + '</span>' +
        '</div>' +
        '<div class="pkg-card__body">' +
          '<div class="pkg-card__top">' +
            '<div>' +
              '<h3 class="pkg-card__title">' + esc(d.title) + '</h3>' +
              '<p class="pkg-card__place">' + esc(d.country) + '</p>' +
            '</div>' +
            '<p class="pkg-card__price">$' + d.price + '<span>/ ' + d.days + ' days</span></p>' +
          '</div>' +
          '<p class="pkg-card__text">' + esc(d.excerpt) + '</p>' +
          '<ul class="pkg-card__list">' + highlights + '</ul>' +
          '<div class="pkg-card__foot">' +
            '<span class="rating" aria-label="' + d.rating + ' out of 5">' + stars(d.rating) +
              '<span class="rating__value">' + d.rating.toFixed(1) + ' (' + d.reviews + ')</span></span>' +
            '<button class="btn btn--primary btn--sm" type="button" data-book="' + esc(d.id) + '">Booking now</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function visibleTrips() {
    var list = (D.destinations || []).filter(function (d) {
      var haystack = (d.title + ' ' + d.country + ' ' + d.region + ' ' + d.tag + ' ' + d.excerpt).toLowerCase();
      var matchesQuery = !state.query || haystack.indexOf(state.query.toLowerCase()) > -1;
      var matchesRegion = !state.region || d.region === state.region;
      return matchesQuery && matchesRegion;
    });

    var sorters = {
      popular: function (a, b) { return b.reviews - a.reviews; },
      price: function (a, b) { return a.price - b.price; },
      'price-desc': function (a, b) { return b.price - a.price; },
      rating: function (a, b) { return b.rating - a.rating; },
      days: function (a, b) { return a.days - b.days; }
    };
    return list.sort(sorters[state.sort] || sorters.popular);
  }

  function render() {
    var grid = document.querySelector('[data-pkg-grid]');
    var empty = document.querySelector('[data-pkg-empty]');
    var count = document.querySelector('[data-result-count]');
    if (!grid) return;

    var trips = visibleTrips();
    grid.innerHTML = trips.map(cardHtml).join('');
    if (count) count.textContent = String(trips.length);
    if (empty) empty.hidden = trips.length > 0;

    grid.querySelectorAll('[data-book]').forEach(function (btn) {
      btn.addEventListener('click', function () { openBooking(btn.getAttribute('data-book')); });
    });

    highlightDestination();
  }

  function highlightDestination() {
    if (!state.dest) return;
    var card = document.getElementById('pkg-' + state.dest);
    if (!card) return;
    card.classList.add('is-highlighted');
    var top = card.getBoundingClientRect().top + window.pageYOffset - 140;
    window.scrollTo({ top: top, behavior: U.reduceMotion ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------ trip context */
  function renderContext() {
    var bar = document.querySelector('[data-trip-context]');
    var text = document.querySelector('[data-trip-context-text]');
    if (!bar || !text) return;

    var parts = [];
    if (state.month) parts.push('Travelling in ' + (D.months[parseInt(state.month, 10)] || ''));
    if (state.people) parts.push(state.people + (state.people === '1' ? ' traveller' : ' travellers'));
    if (state.dest) {
      var trip = (D.destinations || []).filter(function (d) { return d.id === state.dest; })[0];
      if (trip) parts.unshift('Looking at ' + trip.title);
    }

    if (!parts.length) { bar.hidden = true; return; }
    bar.hidden = false;
    text.textContent = parts.join(' · ') + '.';
  }

  /* ---------------------------------------------------------------- filters */
  function initFilters() {
    var search = document.querySelector('[data-filter-search]');
    var sort = document.querySelector('[data-filter-sort]');
    var chips = document.querySelectorAll('[data-filter-region] .chip');

    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value.trim();
        render();
      });
    }
    if (sort) {
      sort.addEventListener('change', function () {
        state.sort = sort.value;
        render();
      });
    }
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener('click', function () {
        Array.prototype.forEach.call(chips, function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        state.region = chip.getAttribute('data-region') || '';
        render();
      });
    });

    var reset = document.querySelector('[data-reset-filters]');
    if (reset) {
      reset.addEventListener('click', function () {
        state.query = '';
        state.region = '';
        state.sort = 'popular';
        if (search) search.value = '';
        if (sort) sort.value = 'popular';
        Array.prototype.forEach.call(chips, function (c, i) { c.classList.toggle('is-active', i === 0); });
        render();
      });
    }

    var contextReset = document.querySelector('[data-context-reset]');
    if (contextReset) {
      contextReset.addEventListener('click', function () {
        state.dest = '';
        state.month = '';
        state.people = '';
        renderContext();
      });
    }
  }

  function readParams() {
    var params = new URLSearchParams(window.location.search);
    state.dest = params.get('dest') || '';
    state.region = params.get('region') || '';
    state.sort = params.get('sort') || 'popular';
    state.query = params.get('q') || '';
    state.month = params.get('month') || '';
    state.people = params.get('people') || '';

    var search = document.querySelector('[data-filter-search]');
    var sort = document.querySelector('[data-filter-sort]');
    if (search) search.value = state.query;
    if (sort) sort.value = state.sort;
    document.querySelectorAll('[data-filter-region] .chip').forEach(function (chip) {
      chip.classList.toggle('is-active', (chip.getAttribute('data-region') || '') === state.region);
    });
  }

  /* ---------------------------------------------------------------- articles */
  function renderArticles() {
    var wrap = document.querySelector('[data-articles]');
    if (!wrap || !D.posts) return;

    wrap.innerHTML = D.posts.map(function (post, i) {
      var url = base + 'single_blog-page/index.html?post=' + encodeURIComponent(post.id);
      var media = i === 0
        ? '<img src="' + img(post.photo) + '" alt="' + esc(post.title) + '" loading="lazy" decoding="async">'
        : '';
      return '' +
        '<article class="article-card' + (i === 0 ? ' article-card--featured' : '') + '" data-reveal style="--reveal-delay:' + (i * 110) + 'ms">' +
          media +
          '<div class="article-card__body">' +
            '<p class="article-card__meta">' + esc(post.category) + '</p>' +
            '<h3 class="article-card__title">' + esc(post.title) + '</h3>' +
            '<div class="article-card__rule"></div>' +
            '<p class="article-card__text">' + esc(post.excerpt) + '</p>' +
            '<a class="link-arrow" href="' + url + '">Read more' + U.icon('arrow-right') + '</a>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* ---------------------------------------------------------- booking modal */
  function openBooking(id) {
    var trip = (D.destinations || []).filter(function (d) { return d.id === id; })[0];
    var modal = document.getElementById('booking-modal');
    if (!trip || !modal) return;

    var summary = modal.querySelector('[data-booking-summary]');
    var form = modal.querySelector('[data-booking-form]');
    var success = modal.querySelector('[data-booking-success]');
    if (summary) {
      summary.innerHTML =
        '<img src="' + img(trip.photoSm) + '" alt="" loading="lazy">' +
        '<div><strong>' + esc(trip.title) + ', ' + esc(trip.country) + '</strong>' +
        '<span>' + trip.days + ' days · ' + esc(trip.tag) + '</span>' +
        '<span class="booking-summary__price">$' + trip.price + ' per person</span></div>';
    }
    if (form) {
      form.hidden = false;
      form.reset();
      form.setAttribute('data-trip', trip.id);
      var travellers = form.querySelector('#bk-people');
      if (travellers && state.people) travellers.value = state.people;
    }
    if (success) success.hidden = true;
    U.modal.open(modal);
  }

  function initBooking() {
    var modal = document.getElementById('booking-modal');
    if (!modal) return;

    var form = modal.querySelector('[data-booking-form]');
    var success = modal.querySelector('[data-booking-success]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#bk-name');
      var email = form.querySelector('#bk-email');
      var date = form.querySelector('#bk-date');
      var ok = true;

      if (!name.value.trim()) {
        U.setFieldError(name, 'Please tell us who is travelling.');
        ok = false;
      } else { U.setFieldError(name, ''); }

      if (!U.validateEmail(email.value)) {
        U.setFieldError(email, 'We need a valid email to send your confirmation.');
        ok = false;
      } else { U.setFieldError(email, ''); }

      if (!date.value) {
        U.setFieldError(date, 'Pick the date you would like to fly.');
        ok = false;
      } else { U.setFieldError(date, ''); }

      if (!ok) {
        U.toast('Please check the highlighted fields.', 'error');
        return;
      }

      var trip = (D.destinations || []).filter(function (d) {
        return d.id === form.getAttribute('data-trip');
      })[0];

      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.innerHTML =
          '<h3>Request sent 🎉</h3>' +
          '<p>Thanks ' + esc(name.value.trim().split(' ')[0]) + ' — we have your request for <strong>' +
          esc(trip ? trip.title : 'this trip') + '</strong> on ' + esc(date.value) +
          '. A planner will email ' + esc(email.value.trim()) + ' within 24 hours.</p>' +
          '<button class="btn btn--outline btn--block" type="button" data-modal-close>Close</button>';
        success.querySelector('[data-modal-close]').addEventListener('click', function () {
          U.modal.close(modal);
        });
      }
      U.toast('Booking request sent. We will be in touch shortly.');
    });

    [].forEach.call(form.querySelectorAll('input, select'), function (input) {
      input.addEventListener('input', function () { U.setFieldError(input, ''); });
      input.addEventListener('change', function () { U.setFieldError(input, ''); });
    });
  }

  readParams();
  renderContext();
  render();
  renderArticles();
  initFilters();
  initBooking();
})();
