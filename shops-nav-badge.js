(function () {
  'use strict';

  var loading = false;
  // The accessible name follows the visible label, which is longer at 1280px and wider.
  var wide = window.matchMedia ? window.matchMedia('(min-width:1280px)') : null;
  if (wide) {
    var onWide = function () { render(); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  function links() {
    return Array.prototype.slice.call(document.querySelectorAll('.shops-nav-link, .menu-drawer__shops'));
  }

  function clear() {
    links().forEach(function (link) {
      var badge = link.querySelector('.shops-nav-badge');
      if (badge) badge.remove();
      link.removeAttribute('aria-label');
    });
  }

  function render() {
    var eligibility = window.HauntfinderShopsEligibility;
    var ads = window.HAUNTFINDER_SHOPS_ADS;
    if (!eligibility || !Array.isArray(ads)) return clear();
    var count = ads.filter(eligibility.isActive).length;
    clear();
    if (!count) return;
    links().forEach(function (link) {
      var badge = document.createElement('span');
      badge.className = 'tabs__badge tabs__badge--shops shops-nav-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = count;
      link.appendChild(badge);
      var name = link.classList.contains('shops-nav-link') && wide && wide.matches ? 'Shops, Makers & Services' : 'Shops & Services';
      link.setAttribute('aria-label', name + ', ' + count + (count === 1 ? ' listing' : ' listings'));
    });
  }

  function loadSource(name) {
    return fetch(name, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('Unavailable');
      return response.text();
    }).then(function (source) {
      Function(source)();
    });
  }

  function refresh() {
    render();
    if (loading || (window.HauntfinderShopsEligibility && Array.isArray(window.HAUNTFINDER_SHOPS_ADS))) return;
    loading = true;
    var eligibility = window.HauntfinderShopsEligibility ? Promise.resolve() : loadSource('shops-eligibility.js');
    eligibility.then(function () {
      return Array.isArray(window.HAUNTFINDER_SHOPS_ADS) ? undefined : loadSource('shops-ads.js');
    }).then(render).catch(clear).finally(function () {
      loading = false;
    });
  }

  window.HauntfinderShopsNavBadge = { refresh: refresh, render: render };
}());
