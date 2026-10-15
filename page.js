// Shared shell behavior for Hauntfinder subpages (submit, about, later
// listing and route pages). Part of the page-first plan: every interactive
// flow gets an addressable route, and each route validates itself.
// The pages are fully usable with JavaScript disabled; this only enhances.
(function () {
  'use strict';
  // Route parser/validator: the canonical set of addressable subpages.
  const ROUTES = ['submit', 'about', 'listing'];
  const page = document.body && document.body.dataset ? document.body.dataset.page : null;
  if (!ROUTES.includes(page)) {
    console.error('Hauntfinder: unknown subpage route "' + page + '". Expected one of: ' + ROUTES.join(', '));
    return;
  }
  document.documentElement.classList.add('js-subpage');
  // Mark the current route in every in-page nav (header + footer copies).
  document.querySelectorAll('a[data-subnav="' + page + '"]').forEach(function (a) {
    a.setAttribute('aria-current', 'page');
  });
  document.title = document.title.replace(/\s*· Hauntfinder$/, '') + ' · Hauntfinder';
})();
