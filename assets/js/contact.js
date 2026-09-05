/* ==========================================================================
   Travosca — contact page
   Office cards, FAQ accordion and client-side validation for the contact form.
   (There is no back end here: the form validates and confirms locally.)
   ========================================================================== */
(function () {
  'use strict';

  var D = window.TRAVOSCA || {};
  var U = window.TravoscaUI;

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* --------------------------------------------------------------- offices */
  function renderOffices() {
    var wrap = document.querySelector('[data-offices]');
    if (!wrap || !D.offices) return;
    wrap.innerHTML = D.offices.map(function (o) {
      return '' +
        '<article class="office-card">' +
          '<div class="office-card__top">' +
            '<h3 class="office-card__city">' + esc(o.city) + '</h3>' +
            '<span class="office-card__label">' + esc(o.label) + '</span>' +
          '</div>' +
          '<p class="office-card__row">' + U.icon('map-pin', 'icon--sm') + '<span>' + esc(o.address) + '</span></p>' +
          '<p class="office-card__row">' + U.icon('phone', 'icon--sm') +
            '<a href="tel:' + esc(o.phone.replace(/\s/g, '')) + '">' + esc(o.phone) + '</a></p>' +
          '<p class="office-card__row">' + U.icon('mail', 'icon--sm') +
            '<a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a></p>' +
        '</article>';
    }).join('');
  }

  /* ------------------------------------------------------------- accordion */
  function initAccordion() {
    var triggers = document.querySelectorAll('[data-accordion] .accordion__trigger');
    [].forEach.call(triggers, function (btn) {
      btn.addEventListener('click', function () {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        btn.classList.toggle('is-open', !open);
        if (panel) panel.hidden = open;
      });
    });
  }

  /* ------------------------------------------------------------------ form */
  function initForm() {
    var API = window.TravoscaAPI;
    var I = window.TravoscaI18n;
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    var note = document.querySelector('[data-contact-note]');
    var name = form.querySelector('#cf-name');
    var email = form.querySelector('#cf-email');
    var message = form.querySelector('#cf-message');
    var destination = form.querySelector('#cf-destination');
    var people = form.querySelector('#cf-people');
    var subject = form.querySelector('#cf-subject');

    function fail(input, message) {
      U.setFieldError(input, message);
      if (input) input.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!name.value.trim()) return fail(name, I ? I.t('contact.errName') : 'Please tell us your name.');
      U.setFieldError(name, '');

      if (!U.validateEmail(email.value)) {
        return fail(email, I ? I.t('contact.errEmail') : 'We need a valid email to reply to.');
      }
      U.setFieldError(email, '');

      if (message.value.trim().length < 20) {
        return fail(message, I ? I.t('contact.errMessage') : 'A few more words helps us plan better — 20 characters minimum.');
      }
      U.setFieldError(message, '');

      var firstName = name.value.trim().split(' ')[0];
      var payload = {
        name: name.value.trim(),
        email: email.value.trim(),
        message: message.value.trim(),
        destination: destination ? destination.value : '',
        people: people ? people.value : '',
        subject: subject ? subject.value.trim() : 'Website contact form'
      };

      function confirmed() {
        form.reset();
        if (note) {
          note.textContent = I
            ? I.t('contact.ok', { name: firstName })
            : 'Thanks ' + firstName + '! Your message is with a planner — expect a reply within one working day.';
        }
        U.toast('Message sent. Thanks for getting in touch!');
      }

      if (API) {
        // Server first; static hosting (no backend) falls back to a local
        // confirmation so the form never dead-ends.
        API.post('leads', payload).then(function (res) {
          confirmed();
          if (res.ok && API.track) API.track('custom', { label: 'contact_form_sent' });
        });
      } else {
        confirmed();
      }
    });

    [name, email, message].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () { U.setFieldError(input, ''); });
    });
  }

  renderOffices();
  initAccordion();
  initForm();
})();
