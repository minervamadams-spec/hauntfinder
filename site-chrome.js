// Shared banner + category nav for every page that is not the map shell.
// SITE_BANNER_HTML is the map page banner. tests/site-chrome.test.js fails if
// it diverges from index.html. Secondary pages render the title as a div so
// the page keeps a single h1.
// Category counts stay on the map because they depend on the search area. The
// Shops badge is global and loads its small ad list asynchronously instead.
(function () {
  'use strict';
  var INTRO = 'Find decorated homes, spooky displays, treat stops, and Halloween events near you. Check visiting details, plan your route, or submit a listing for free.';
  var SITE_BANNER_HTML = `<header class="hf-header banner">
  <h1 class="banner__title"><picture class="banner__frame">
    <img class="banner__img" src="assets/sign-cutout.png" width="960" height="345" alt="Hauntfinder Halloween Guide" fetchpriority="high" decoding="async">
  </picture></h1>
  <button type="button" class="hf-menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="menuDrawer"><span aria-hidden="true">☰</span></button>
  <p class="intro-strip__copy">${INTRO}</p>
</header>`;
  var CATEGORIES = [
    ['displays', 'Displays', 'index.html?category=displays'],
    ['treats', 'Treat Stops', 'index.html?category=treats'],
    ['events', 'Events', 'index.html?category=events']
  ];

  function attr(active, name) {
    return active === name ? ' aria-current="page"' : '';
  }

  function bannerHTML() {
    return SITE_BANNER_HTML
      .replace('<h1 class="banner__title">', '<div class="banner__title">')
      .replace('</h1>', '</div>');
  }

  function navHTML(active) {
    var tabs = CATEGORIES.map(function (tab) {
      return '<a class="site-tab" id="' + tab[0] + 'Tab" href="' + tab[2] + '"' + attr(active, tab[0]) + '>' + tab[1] + '</a>';
    }).join('');
    return '<nav class="filterbar site-nav" aria-label="Site"><div class="nav-row"><div class="tabs">' + tabs +
      '<a class="shops-nav-link" href="shops.html"' + attr(active, 'shops') + '>Shops &amp; Services</a></div></div></nav>';
  }

  function drawerHTML(active) {
    return '<div class="menu-drawer" id="menuDrawer" hidden><div class="menu-drawer__scrim" data-close-menu></div>' +
      '<nav class="menu-drawer__panel" aria-label="Menu">' +
      '<button type="button" class="sheet-close" data-close-menu aria-label="Close menu">×</button>' +
      '<a class="menu-drawer__primary" href="submit.html" data-subnav="submit"' + attr(active, 'submit') + '>+ Submit a listing</a>' +
      '<a class="menu-drawer__shops" href="shops.html" data-subnav="shops"' + attr(active, 'shops') + '>Shops &amp; Services</a>' +
      '<button type="button" id="menuShare">Share this site</button>' +
      '<a href="about.html" data-subnav="about"' + attr(active, 'about') + '>About</a>' +
      '<a href="alerts.html" data-subnav="alerts"' + attr(active, 'alerts') + '>Get alerts</a>' +
      '<a href="mailto:mtocommunityfinder@gmail.com">Contact us</a>' +
      '<p class="menu-drawer__tag">' + INTRO + '</p></nav></div>';
  }

  function wireMenu() {
    var btn = document.getElementById('menuBtn');
    var drawer = document.getElementById('menuDrawer');
    if (!btn || !drawer || btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    function close() { drawer.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    function open() { drawer.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    btn.addEventListener('click', open);
    drawer.addEventListener('click', function (e) { if (e.target.closest('[data-close-menu]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) close(); });
    var share = document.getElementById('menuShare');
    if (!share) return;
    share.addEventListener('click', function () {
      close();
      var shareData = { title: 'Hauntfinder', text: 'Find Halloween displays, treat stops, and events near you.', url: 'https://hauntfinder.vercel.app/' };
      if (navigator.share) {
        navigator.share(shareData).catch(function (e) { if (!e || e.name !== 'AbortError') copy(); });
        return;
      }
      copy();
      function copy() {
        var done = function () { share.textContent = 'Link copied'; setTimeout(function () { share.textContent = 'Share this site'; }, 3000); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareData.url).then(done).catch(function () { window.prompt('Copy this link:', shareData.url); });
        else window.prompt('Copy this link:', shareData.url);
      }
    });
  }

  function mount() {
    var slot = document.getElementById('siteChrome');
    if (!slot) return;
    var active = slot.getAttribute('data-chrome-active') || '';
    slot.outerHTML = bannerHTML() + navHTML(active) + drawerHTML(active);
    wireMenu();
    loadShopsBadge();
  }

  function loadShopsBadge() {
    if (window.HauntfinderShopsNavBadge) return window.HauntfinderShopsNavBadge.refresh();
    fetch('shops-nav-badge.js', { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('Unavailable');
      return response.text();
    }).then(function (source) {
      Function(source)();
      window.HauntfinderShopsNavBadge.refresh();
    }).catch(function () {});
  }

  mount();
}());
