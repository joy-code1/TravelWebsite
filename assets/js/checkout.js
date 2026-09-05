/* ==========================================================================
   Travosca — checkout page behaviour
   Loads the booking (URL ?ref=&session= / ?ref=&email= / last remembered
   booking), shows a summary and runs the test-mode card payment through
   POST /api/payments/confirm.  Without the backend the page explains that
   payment needs the Node server (nothing pretends to be charged).
   ========================================================================== */
(function () {
  'use strict';

  var API = window.TravoscaAPI;
  var I = window.TravoscaI18n;

  function t(key, vars) { return I ? I.t(key, vars) : key; }
  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var state = {
    ref: '',
    email: '',
    session: '',
    booking: null
  };

  function $(sel) { return document.querySelector(sel); }

  // Minimal field-error helper (ui.js is not loaded on this page).
  function setFieldError(input, message) {
    if (!input) return;
    var field = input.closest('.field');
    if (!field) return;
    var slot = field.querySelector('.field__error');
    field.classList.toggle('has-error', Boolean(message));
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (slot) slot.textContent = message || '';
  }

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ rendering */
  function statusBadge(status) {
    var cls = status === 'paid' ? 'is-paid' : (status === 'cancelled' ? 'is-cancelled' : 'is-pending');
    return '<span class="status-badge ' + cls + '">' + esc(t('status.' + status)) + '</span>';
  }

  function renderSummary(booking) {
    if (!booking) return;
    state.booking = booking;
    $('[data-sum-ref]').textContent = booking.ref || '—';
    $('[data-sum-trip]').textContent = booking.tripTitle || booking.tripId || '—';
    $('[data-sum-date]').textContent = booking.date || '—';
    $('[data-sum-people]').textContent = booking.people || '—';
    $('[data-sum-total]').textContent = '$' + booking.total;
    $('[data-sum-status]').innerHTML = statusBadge(booking.status);
    if (state.session) $('[data-sum-session]').textContent = state.session;
    var submit = $('[data-pay-submit]');
    if (submit) {
      submit.textContent = t('checkout.pay', { total: booking.total });
      submit.disabled = booking.status === 'paid' || booking.status === 'cancelled';
    }
  }

  function showError(message) {
    var el = $('[data-checkout-error]');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function clearError() {
    var el = $('[data-checkout-error]');
    if (el) el.hidden = true;
  }

  /* --------------------------------------------------------- data loading */
  function lookup(ref, email) {
    return API.get('bookings/lookup?ref=' + encodeURIComponent(ref) + '&email=' + encodeURIComponent(email))
      .then(function (res) {
        if (res.ok && res.data && res.data.booking) {
          clearError();
          renderSummary(res.data.booking);
          return true;
        }
        showError(t('checkout.notFound'));
        return false;
      });
  }

  function load() {
    var p = params();
    state.ref = (p && p.get('ref')) || '';
    state.session = (p && p.get('session')) || '';
    var remembered = API ? API.lastBooking() : null;

    if (!state.ref && remembered && remembered.ref) state.ref = remembered.ref;
    state.email = (p && p.get('email')) || (API ? API.lastEmail() : '') ||
      (remembered && remembered.email) || '';
    var emailInput = $('#lk-email');
    if (emailInput && state.email) emailInput.value = state.email;

    if (!state.ref) {
      if (remembered) {
        renderSummary(remembered);
      } else {
        showError(t('checkout.notFound'));
      }
      return;
    }

    if (state.email) {
      lookup(state.ref, state.email);
    } else if (remembered && remembered.ref === state.ref) {
      renderSummary(remembered);
    }

    // Enrich with the payment session record when ?session= is present.
    if (state.session) {
      API.get('payments/session?id=' + encodeURIComponent(state.session)).then(function (res) {
        if (res.ok && res.data && res.data.session) {
          var s = res.data.session;
          $('[data-sum-session]').textContent = s.id + ' · ' + (s.status || 'open');
        }
      });
    }
  }

  /* ------------------------------------------------------------- payment */
  function payResult(kind, title, text) {
    var el = $('[data-pay-result]');
    if (!el) return;
    el.className = 'pay-result ' + (kind === 'success' ? 'is-success' : 'is-declined');
    el.hidden = false;
    el.innerHTML = '<strong>' + esc(title) + '</strong>' + (text ? '<p>' + esc(text) + '</p>' : '');
  }

  function initTestChips() {
    document.querySelectorAll('[data-test-card]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var number = chip.getAttribute('data-test-card') || '';
        var input = $('#cc-number');
        if (input) {
          input.value = number.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
          input.focus();
        }
        clearError();
      });
    });
  }

  function initPayForm() {
    var form = $('[data-pay-form]');
    if (!form) return;
    var number = form.querySelector('#cc-number');

    number.addEventListener('input', function () {
      // Group digits in fours while typing: 4242 4242 4242 4242
      var digits = number.value.replace(/\D/g, '').slice(0, 16);
      number.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      setFieldError(number, '');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var digits = number.value.replace(/\D/g, '');
      if (digits.length !== 16) {
        setFieldError(number, t('checkout.invalidCard'));
        showError(t('checkout.invalidCard'));
        return;
      }
      setFieldError(number, '');
      clearError();

      if (!state.ref) {
        showError(t('checkout.notFound'));
        return;
      }

      var submit = form.querySelector('[data-pay-submit]');
      if (submit) submit.disabled = true;

      API.post('payments/confirm', {
        ref: state.ref,
        sessionId: state.session || undefined,
        card: digits,
        expiry: (form.querySelector('#cc-expiry') || {}).value || '',
        cvc: (form.querySelector('#cc-cvc') || {}).value || '',
        name: (form.querySelector('#cc-name') || {}).value || ''
      }).then(function (res) {
        if (submit) submit.disabled = false;
        var booking = res.data && res.data.booking;

        if (res.ok && booking) {
          payResult('success', t('checkout.successTitle'),
            t('checkout.successText', { ref: booking.ref, email: booking.email }));
          renderSummary(booking);
          API.rememberBooking(Object.assign({}, API.lastBooking() || {}, {
            ref: booking.ref,
            total: booking.total,
            status: booking.status
          }));
          API.track('custom', { label: 'payment_success' });
          return;
        }

        if (res.status === 402) {
          payResult('declined', t('checkout.declinedTitle'), t('checkout.declinedText'));
          if (booking) renderSummary(booking);
          API.track('custom', { label: 'payment_declined' });
          return;
        }

        if (res.status === 400) {
          setFieldError(number, t('checkout.invalidCard'));
          showError((res.data && res.data.error === 'unsupported_test_card')
            ? t('checkout.declinedText')
            : t('checkout.invalidCard'));
          return;
        }

        if (res.offline || res.status === 0) {
          showError(t('checkout.offline'));
          return;
        }

        showError((res.data && res.data.error) || 'Payment failed.');
      });
    });
  }

  function initLookupForm() {
    var form = $('[data-lookup-form]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('#lk-email').value.trim();
      if (!state.ref || !email) {
        showError(t('checkout.notFound'));
        return;
      }
      state.email = email;
      lookup(state.ref, email);
    });
  }

  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function boot() {
    if (!API || !API.hasFetch) {
      showError(t('checkout.offline'));
    } else {
      API.ready().then(function (online) {
        if (!online) showError(t('checkout.offline'));
      });
    }
    initTestChips();
    initPayForm();
    initLookupForm();
    initYear();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
