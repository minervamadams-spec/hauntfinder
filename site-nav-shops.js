(function () {
  'use strict';
  function link(className, text) {
    const a = document.createElement('a');
    a.className = className;
    a.href = 'shops.html';
    a.textContent = text;
    return a;
  }
  // Round 3 nav: "Shops & Services" below 1280px, "Shops, Makers & Services" at 1280px and wider.
  function navLink() {
    const a = link('shops-nav-link', '');
    [['short', 'Shops & Services'], ['long', 'Shops, Makers & Services']].forEach(function (label) {
      const span = document.createElement('span');
      span.className = 'shops-nav-link__label shops-nav-link__label--' + label[0];
      span.textContent = label[1];
      a.appendChild(span);
    });
    return a;
  }
  const tabs = document.querySelector('.filterbar .tabs');
  if (tabs && !document.querySelector('.shops-nav-link')) tabs.insertAdjacentElement('afterend', navLink());
  const primary = document.querySelector('.menu-drawer__primary');
  if (primary && !document.querySelector('.menu-drawer__shops')) primary.insertAdjacentElement('afterend', link('menu-drawer__shops', 'Shops & Services'));
  if (window.HauntfinderShopsNavBadge) return window.HauntfinderShopsNavBadge.refresh();
  fetch('shops-nav-badge.js',{credentials:'same-origin'}).then(r=>r.ok?r.text():Promise.reject()).then(source=>{Function(source)();window.HauntfinderShopsNavBadge.refresh()}).catch(()=>{});
}());
