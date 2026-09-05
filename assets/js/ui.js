/* ==========================================================================
   Travosca — shared UI behaviour
   Header, mobile menu, search overlay, carousels, modals, toasts, lightbox,
   scroll reveals, counters and newsletter forms.  No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.TRAVOSCA || {};
  var base = D.base || '../';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="' +
      base + 'assets/img/icons.svg#i-' + name + '"></use></svg>';
  }

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapFocus(container, event) {
    var items = $$(FOCUSABLE, container).filter(function (el) {
      return el.offsetWidth || el.offsetHeight || el.getClientRects().length > 0;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function go(url) {
    window.location.assign(url);
  }

  function lockScroll(locked) {
    document.body.classList.toggle('is-locked', locked);
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, wait || 150);
    };
  }

  /* ------------------------------------------------------------------ toast */
  function toast(message, type) {
    var stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'success');
    el.innerHTML = icon(type === 'error' ? 'alert' : 'check') + '<span>' + message + '</span>';
    stack.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.remove(); }, 400);
    }, 4200);
  }

  /* ------------------------------------------------------------ mobile menu */
  function initMenu() {
    var toggle = $('[data-menu-toggle]');
    var panel = $('#mobile-nav');
    var scrim = $('.scrim');
    if (!toggle || !panel) return;

    var open = false;
    var lastFocus = null;

    function setOpen(next) {
      open = next;
      panel.classList.toggle('is-open', open);
      if (scrim) scrim.classList.toggle('is-visible', open);
      toggle.setAttribute('aria-expanded', String(open));
      lockScroll(open);
      if (open) {
        lastFocus = document.activeElement;
        var first = $(FOCUSABLE, panel);
        if (first) first.focus();
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }

    toggle.addEventListener('click', function () { setOpen(!open); });
    $$('[data-menu-close]', panel).forEach(function (btn) {
      btn.addEventListener('click', function () { setOpen(false); });
    });
    $$('a', panel).forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') trapFocus(panel, e);
    });

    // accordion for the "Packages" group inside the mobile menu
    $$('[data-submenu-toggle]', panel).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sub = document.getElementById(btn.getAttribute('aria-controls'));
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        if (sub) sub.classList.toggle('is-open', !expanded);
      });
    });
  }

  /* --------------------------------------------------------- desktop dropdown */
  function initDropdowns() {
    $$('[data-dropdown-toggle]').forEach(function (btn) {
      var item = btn.closest('.nav__item');
      if (!item) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function (e) {
        if (!item.contains(e.target)) {
          item.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      item.addEventListener('mouseleave', function () {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------------------------------------------------------- search overlay */
  function initSearch() {
    var openers = $$('[data-search-open]');
    var overlay = $('#search-overlay');
    if (!overlay || !openers.length) return;

    var input = $('.search-box__input', overlay);
    var results = $('.search-results', overlay);
    var lastFocus = null;
    var pool = D.destinations || [];

    function render(query) {
      var q = query.trim().toLowerCase();
      var matches = pool.filter(function (d) {
        if (!q) return true;
        return (d.title + ' ' + d.country + ' ' + d.region + ' ' + d.tag).toLowerCase().indexOf(q) > -1;
      });
      if (!matches.length) {
        results.innerHTML = '<p class="search-results__empty">No destination matches “' +
          query.replace(/</g, '&lt;') + '”. Try Bali, Paris or Swiss.</p>';
        return;
      }
      results.innerHTML = matches.map(function (d) {
        var url = base + 'package-page/index.html?dest=' + encodeURIComponent(d.id);
        return '<a href="' + url + '">' +
          '<img src="' + base + 'assets/img/' + d.photoSm + '" alt="" loading="lazy">' +
          '<span><strong>' + d.title + ', ' + d.country + '</strong>' +
          '<small>' + d.tag + ' · from $' + d.price + ' · ' + d.days + ' days</small></span>' +
          icon('arrow-right') + '</a>';
      }).join('');
    }

    function setOpen(next) {
      overlay.classList.toggle('is-open', next);
      lockScroll(next);
      if (next) {
        lastFocus = document.activeElement;
        render('');
        setTimeout(function () { if (input) input.focus(); }, 60);
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }

    openers.forEach(function (btn) {
      btn.addEventListener('click', function () { setOpen(true); });
    });
    $$('[data-search-close]', overlay).forEach(function (btn) {
      btn.addEventListener('click', function () { setOpen(false); });
    });
    if (input) {
      input.addEventListener('input', function () { render(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var first = $('a', results);
          if (first) { e.preventDefault(); first.click(); }
        }
      });
    }
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') trapFocus(overlay, e);
    });
  }

  /* ----------------------------------------------------------------- header */
  function initHeader() {
    var header = $('[data-header]');
    if (!header) return;
    var lastY = window.pageYOffset;
    var ticking = false;

    function update() {
      var y = window.pageYOffset;
      header.classList.toggle('is-stuck', y > 40);
      if (y > lastY && y > 460 && !document.body.classList.contains('is-locked')) {
        header.classList.add('is-hidden');
      } else {
        header.classList.remove('is-hidden');
      }
      lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------ back to top */
  function initToTop() {
    var btn = $('[data-to-top]');
    if (!btn) return;
    var ticking = false;
    function update() {
      btn.classList.toggle('is-visible', window.pageYOffset > 600);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* --------------------------------------------------------------- reveals */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------- newsletter */
  function initNewsletter() {
    $$('form[data-newsletter]').forEach(function (form) {
      var input = $('input[type="email"]', form);
      var note = $('[data-newsletter-note]', form.parentElement) || $('[data-newsletter-note]');
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!input) return;
        var value = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          if (note) {
            note.textContent = 'Please enter a valid email address.';
            note.style.color = '#ff9a9a';
          }
          input.focus();
          toast('That email address does not look right.', 'error');
          return;
        }
        input.value = '';
        if (note) {
          note.textContent = 'Thanks! Check your inbox — your first deal is on the way.';
          note.style.color = '';
        }
        toast('You are subscribed. Welcome aboard!');
      });
    });
  }

  /* --------------------------------------------------------------- counters */
  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;
    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-count-suffix') || '';
      var duration = 1400;
      var start = null;
      if (reduceMotion) { el.textContent = target + suffix; return; }
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (!('IntersectionObserver' in window)) {
      counters.forEach(run);
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { observer.observe(el); });
  }

  /* --------------------------------------------------------------- carousel */
  function initCarousel(root) {
    var track = $('[data-carousel-track]', root);
    if (!track) return null;
    var prev = $('[data-carousel-prev]', root);
    var next = $('[data-carousel-next]', root);
    var dotsWrap = $('[data-carousel-dots]', root);
    var autoplay = parseInt(root.getAttribute('data-autoplay') || '0', 10);
    var timer = null;
    var index = 0;

    function step() {
      var first = track.children[0];
      if (!first) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      return first.getBoundingClientRect().width + gap;
    }
    function perView() {
      var s = step();
      return s ? Math.max(1, Math.round(track.clientWidth / s)) : 1;
    }
    function pages() {
      return Math.max(1, track.children.length - perView() + 1);
    }
    function currentIndex() {
      var s = step();
      return s ? Math.round(track.scrollLeft / s) : 0;
    }

    function sync() {
      index = currentIndex();
      var max = pages();
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      if (dotsWrap) {
        if (max <= 1) { dotsWrap.innerHTML = ''; return; }
        if (dotsWrap.children.length !== max) {
          dotsWrap.innerHTML = '';
          for (var i = 0; i < max; i++) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'carousel__dot';
            dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
            dot.addEventListener('click', (function (n) {
              return function () { goTo(n); };
            })(i));
            dotsWrap.appendChild(dot);
          }
        }
        $$('.carousel__dot', dotsWrap).forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === index);
          dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
      }
    }

    function goTo(i) {
      var max = pages();
      var target = Math.max(0, Math.min(i, max - 1));
      track.scrollTo({
        left: target * step(),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    if (prev) prev.addEventListener('click', function () { goTo(currentIndex() - 1); });
    if (next) next.addEventListener('click', function () {
      if (currentIndex() >= pages() - 1) goTo(0); else goTo(currentIndex() + 1);
    });

    track.addEventListener('scroll', debounce(sync, 60), { passive: true });
    window.addEventListener('resize', debounce(function () {
      sync();
      if (track.scrollLeft > (pages() - 1) * step()) goTo(pages() - 1);
    }, 180));

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex() - 1); }
    });

    function startAuto() {
      if (!autoplay || reduceMotion) return;
      stopAuto();
      timer = setInterval(function () {
        if (document.hidden) return;
        if (currentIndex() >= pages() - 1) goTo(0); else goTo(currentIndex() + 1);
      }, autoplay);
    }
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }

    if (autoplay) {
      root.addEventListener('mouseenter', stopAuto);
      root.addEventListener('mouseleave', startAuto);
      root.addEventListener('focusin', stopAuto);
      root.addEventListener('focusout', startAuto);
      startAuto();
    }

    // touch users can swipe natively thanks to scroll-snap
    requestAnimationFrame(sync);
    window.addEventListener('load', sync);
    return { goTo: goTo, sync: sync };
  }

  function initCarousels(scope) {
    $$('[data-carousel]', scope).forEach(initCarousel);
  }

  /* ------------------------------------------------------------------ modal */
  var activeModal = null;

  function openModal(selector) {
    var modal = typeof selector === 'string' ? $(selector) : selector;
    if (!modal) return;
    activeModal = modal;
    modal.classList.add('is-open');
    lockScroll(true);
    var first = $(FOCUSABLE, modal);
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeModal(modal) {
    modal = modal || activeModal;
    if (!modal) return;
    modal.classList.remove('is-open');
    lockScroll(false);
    activeModal = null;
  }

  function initModals() {
    $$('[data-modal]').forEach(function (modal) {
      $$('[data-modal-close]', modal).forEach(function (btn) {
        btn.addEventListener('click', function () { closeModal(modal); });
      });
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal(modal);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (!activeModal) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') trapFocus(activeModal, e);
    });
  }

  /* --------------------------------------------------------------- lightbox */
  var lightbox = (function () {
    var el, figure, caption, items = [], current = 0, opener = null;

    function build() {
      el = document.createElement('div');
      el.className = 'lightbox';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Image gallery');
      el.innerHTML =
        '<div class="lightbox__figure">' +
          '<button type="button" class="lightbox__close" data-lb-close aria-label="Close gallery">' + icon('close') + '</button>' +
          '<button type="button" class="lightbox__btn lightbox__btn--prev" data-lb-prev aria-label="Previous image">' + icon('arrow-left') + '</button>' +
          '<img src="" alt="">' +
          '<button type="button" class="lightbox__btn lightbox__btn--next" data-lb-next aria-label="Next image">' + icon('arrow-right') + '</button>' +
          '<p class="lightbox__caption"></p>' +
        '</div>';
      document.body.appendChild(el);
      figure = $('.lightbox__figure', el);
      caption = $('.lightbox__caption', el);
      $('[data-lb-close]', el).addEventListener('click', close);
      $('[data-lb-prev]', el).addEventListener('click', function () { show(current - 1); });
      $('[data-lb-next]', el).addEventListener('click', function () { show(current + 1); });
      el.addEventListener('click', function (e) { if (e.target === el) close(); });
    }

    function show(i) {
      current = (i + items.length) % items.length;
      var item = items[current];
      var image = $('img', el);
      image.src = base + 'assets/img/' + item.photo;
      image.alt = item.title + (item.place ? ', ' + item.place : '');
      caption.textContent = item.title + (item.place ? ' — ' + item.place : '');
    }

    function open(list, index) {
      if (!el) build();
      items = list;
      opener = document.activeElement;
      show(index || 0);
      el.classList.add('is-open');
      lockScroll(true);
      $('[data-lb-close]', el).focus();
    }

    function close() {
      if (!el) return;
      el.classList.remove('is-open');
      lockScroll(false);
      if (opener) opener.focus();
    }

    document.addEventListener('keydown', function (e) {
      if (!el || !el.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'Tab') trapFocus(el, e);
    });

    return { open: open, close: close };
  })();

  /* ------------------------------------------------------------ form helpers */
  function setFieldError(input, message) {
    var field = input.closest('.field');
    if (!field) return;
    var slot = $('.field__error', field);
    if (message) {
      field.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      if (slot) slot.textContent = message;
    } else {
      field.classList.remove('has-error');
      input.removeAttribute('aria-invalid');
      if (slot) slot.textContent = '';
    }
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }

  /* ------------------------------------------------------------------ misc */
  function initMisc() {
    var page = document.body.getAttribute('data-page');
    if (page) {
      $$('[data-nav="' + page + '"]').forEach(function (link) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      });
    }
    $$('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
    // smooth anchor scrolling inside the page
    $$('a[href^="#"]:not([href="#"])').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /* ------------------------------------------------------------------ boot */
  function init() {
    initHeader();
    initMenu();
    initDropdowns();
    initSearch();
    initToTop();
    initModals();
    initNewsletter();
    initCounters();
    initCarousels(document);
    initReveal();
    initMisc();
  }

  window.TravoscaUI = {
    go: go,
    icon: icon,
    toast: toast,
    carousel: initCarousel,
    carousels: initCarousels,
    modal: { open: openModal, close: closeModal },
    lightbox: lightbox,
    reveal: initReveal,
    setFieldError: setFieldError,
    validateEmail: validateEmail,
    lockScroll: lockScroll,
    reduceMotion: reduceMotion,
    $: $,
    $$: $$
  };

  // Always wait for DOMContentLoaded: page scripts (loaded after this file)
  // render their markup during parse-time, and the shared behaviour has to
  // pick up the finished DOM.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }
})();
