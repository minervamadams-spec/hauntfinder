(function () {
  'use strict';
  function link(className, text) {
    const a = document.createElement('a');
    a.className = className;
    a.href = 'shops.html';
    a.textContent = text;
    return a;
  }
  const tabs = document.querySelector('.filterbar .tabs');
  if (tabs && !document.querySelector('.shops-nav-link')) tabs.insertAdjacentElement('afterend', link('shops-nav-link', 'Shops & Services'));
  const primary = document.querySelector('.menu-drawer__primary');
  if (primary && !document.querySelector('.menu-drawer__shops')) primary.insertAdjacentElement('afterend', link('menu-drawer__shops', 'Shops & Services'));
  if (window.HauntfinderShopsNavBadge) return window.HauntfinderShopsNavBadge.refresh();
  fetch('shops-nav-badge.js',{credentials:'same-origin'}).then(r=>r.ok?r.text():Promise.reject()).then(source=>{Function(source)();window.HauntfinderShopsNavBadge.refresh()}).catch(()=>{});
}());
