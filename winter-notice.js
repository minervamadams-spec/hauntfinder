// Site-wide hand-off notice: Nov 1 through Feb 21 (America/New_York), Hauntfinder points visitors to Glowfinder.
(function (root) {
  'use strict';
  var URL_GLOWFINDER = 'https://glowfinder-map.vercel.app';
  var KEY = 'hf-glowfinder-notice-dismissed';
  var TZ = 'America/New_York';

  // Eastern calendar parts for an instant, so the window flips at Eastern midnight wherever the visitor is.
  function easternParts(date) {
    var p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
    var out = {};
    p.forEach(function (x) { if (x.type !== 'literal') out[x.type] = +x.value; });
    return out;
  }
  function inWindow(date) {
    var d = easternParts(date || new Date());
    return d.month >= 11 || d.month === 1 || (d.month === 2 && d.day <= 21);
  }
  // A winter season is named for the year it starts in, so a dismissal lasts one winter and not forever.
  function seasonKey(date) {
    var d = easternParts(date || new Date());
    return String(d.month >= 11 ? d.year : d.year - 1);
  }
  function isDismissed(storage, date) {
    try { return storage.getItem(KEY) === seasonKey(date); } catch (e) { return false; }
  }
  function dismiss(storage, date) {
    try { storage.setItem(KEY, seasonKey(date)); } catch (e) { /* private mode: dismissal just lasts this page */ }
  }

  var HTML = '<p class="gf-notice__text">Halloween is over. Winter lights, giving drives and events are on Glowfinder.</p>' +
    '<a class="gf-notice__link" href="' + URL_GLOWFINDER + '" rel="noopener">Open Glowfinder</a>' +
    '<button type="button" class="gf-notice__close" aria-label="Dismiss the Glowfinder notice"><span aria-hidden="true">×</span></button>';

  // The notice changes the page height after the Leaflet map has sized itself. Leaflet only re-measures on a
  // window resize, so announce one; otherwise tiles never load for the area the notice frees or covers.
  function relayout(win) {
    try {
      var fire = function () { win.dispatchEvent(new win.Event('resize')); };
      if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(fire); else fire();
    } catch (e) { /* older browsers: the map's own delayed invalidateSize still runs */ }
  }

  function show(doc, win) {
    if (!doc || !doc.body || doc.querySelector('.gf-notice')) return null;
    var storage = null;
    try { storage = win.localStorage; } catch (e) { storage = null; }
    var now = new Date();
    if (!inWindow(now) || (storage && isDismissed(storage, now))) return null;
    var el = doc.createElement('aside');
    el.className = 'gf-notice';
    el.setAttribute('aria-label', 'Glowfinder');
    el.innerHTML = HTML;
    doc.body.insertBefore(el, doc.body.firstChild);
    var html = doc.documentElement;
    // Pages with a fixed-height app shell subtract this so the notice never pushes content off screen.
    function measure() { html.style.setProperty('--gf-notice-h', el.offsetHeight + 'px'); }
    measure();
    html.setAttribute('data-gf-notice', '');
    relayout(win);
    if (typeof win.ResizeObserver === 'function') new win.ResizeObserver(measure).observe(el);
    else win.addEventListener('resize', measure);
    el.querySelector('.gf-notice__close').addEventListener('click', function () {
      if (storage) dismiss(storage, now);
      el.remove();
      html.style.removeProperty('--gf-notice-h');
      html.removeAttribute('data-gf-notice');
      relayout(win);
      var target = doc.querySelector('h1, main, [tabindex]') || doc.body;
      if (target.focus) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    });
    return el;
  }

  var api = { inWindow: inWindow, seasonKey: seasonKey, isDismissed: isDismissed, dismiss: dismiss, show: show, KEY: KEY, URL: URL_GLOWFINDER };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { show(root.document, root); });
    else show(root.document, root);
  }
})(typeof window !== 'undefined' ? window : null);
