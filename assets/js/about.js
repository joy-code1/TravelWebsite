/* ==========================================================================
   Travosca — about page
   Wires the gallery up to the shared lightbox (keyboard + swipe friendly).
   ========================================================================== */
(function () {
  'use strict';

  var U = window.TravoscaUI;
  var gallery = document.querySelector('[data-gallery]');
  if (!gallery) return;

  var items = [].map.call(gallery.querySelectorAll('[data-photo]'), function (btn) {
    return {
      photo: btn.getAttribute('data-photo'),
      title: btn.getAttribute('data-title') || '',
      place: btn.getAttribute('data-place') || ''
    };
  });

  [].forEach.call(gallery.querySelectorAll('[data-photo]'), function (btn, index) {
    btn.addEventListener('click', function () {
      U.lightbox.open(items, index);
    });
  });
})();
