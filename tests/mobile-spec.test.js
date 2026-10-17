// v7 mobile pass (design/Hauntfinder Mobile Spec.dc.html). Rendered behavior at 390px and 820px
// is covered by scripts/e2e-single-scroll.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=read('index.html'),css=read('styles.css'),mobile=read('mobile.js'),app=read('app.js'),layout=read('layout.js'),chrome=read('chrome-filters.js');
const mobileCss=css.split('/* ---- v7 mobile pass (below 1024px)')[1]||'';

test('mobile markup: menu button, Filters button, bottom bar, filter sheet head/foot, route sheet head, menu drawer, no <dialog>',()=>{
  for(const id of ['menuBtn','filtersBtn','mobileBar','viewToggle','routeBarBtn','routeBarCount','sheetClose','sheetClear','sheetShow','routeClose','menuDrawer'])assert.ok(html.includes(`id="${id}"`),id);
  assert.equal(html.includes('<dialog'),false);
  assert.ok(html.includes('<script src="mobile.js"></script>'));
  assert.ok(html.indexOf('mobile.js')<html.indexOf('url-state.js'),'mobile.js loads before url-state.js');
});
test('mobile: one view at a time (data-mview), the bottom bar switches views, FULL DETAILS returns to the list',()=>{
  assert.match(mobile,/root\.dataset\.mview='list'/);
  assert.match(mobile,/function setView\(v,opts=\{\}\)/);
  assert.match(mobile,/data-peek-full/);
  assert.match(app,/data-peek-full="\$\{n\}">Full details ▸/);
  assert.match(mobileCss,/html\[data-mview="map"\] \.hf-header\{display:none\}/,'header hidden in map view');
  assert.match(mobileCss,/html\[data-mview="map"\]\[data-category\] \.list-column\{display:none\}/);
});
test('mobile: header 56px with the menu button; tagline moves into the drawer; search row and tabs stick',()=>{
  assert.match(mobileCss,/html body \.hf-header\.banner\{height:56px;/);
  assert.match(mobileCss,/html body \.filterbar\{position:sticky;top:0;/);
  assert.match(mobileCss,/\.menu-drawer__panel\{position:absolute;top:0;right:0;bottom:0/);
  assert.match(html,/menu-drawer__tag">Find decorated homes/);
});
test('mobile: filters live in a full-screen sheet (same chip groups as desktop); Show N applies and closes; Clear all',()=>{
  assert.match(chrome,/const desktopRail=\(\)=>true/);
  assert.match(mobile,/Show \$\{n\} \$\{n===1\?one:many\}/);
  assert.match(mobileCss,/html\[data-sheet="filters"\] .filter-rail\{display:flex;flex-direction:column;position:fixed;inset:0/);
  assert.match(chrome,/fb\.classList\.toggle\('is-active',n>0\)/,'Filters button gets the orange outline when any filter is on');
});
test('mobile: Your route opens an in-page bottom sheet (not a dialog); empty copy per spec; badge is muted at 0',()=>{
  assert.match(mobile,/openSheet\('route'\)/);
  assert.match(mobileCss,/html\[data-sheet="route"\] \.route-panel\{display:block;width:100%;max-width:760px;max-height:80vh/);
  assert.ok(html.includes('Add up to 10 stops from any tab. Directions open in Google Maps.'));
  assert.match(app,/rc\.classList\.toggle\('is-zero',!n\)/);
  assert.match(css,/\.mobile-bar__count\.is-zero\{background:#3A3046/);
});
test('mobile route sheet: header-only pointer drag has a grab handle, threshold, velocity and reduced-motion snap',()=>{
  assert.match(html,/class="route-panel__handle" aria-hidden="true"/,'visible grab handle');
  assert.match(mobileCss,/\.route-panel__handle\{[^}]*width:36px;[^}]*height:4px/,'36px grab handle');
  assert.match(mobileCss,/\.route-panel__head\{[^}]*touch-action:none/,'only the non-scrolling header owns the gesture');
  assert.match(mobile,/routeHead\.addEventListener\('pointerdown'/,'pointer handling is attached to the route header only');
  assert.match(mobile,/dy>panel\.getBoundingClientRect\(\)\.height\*\.25/,'dragging beyond one quarter closes');
  assert.match(mobile,/velocity>\.5/,'fast downward releases close');
  assert.match(mobile,/prefers-reduced-motion: reduce/,'reduced motion snaps without a spring');
  assert.match(mobile,/closeSheet\(\)/,'the existing close path keeps route state and aria in sync');
});
test('mobile cards: body is not a tap target; ◉ Map opens the map with that pin; ⋯ reveals Host notes, Rate, Report and Share',()=>{
  assert.match(app,/if\(matchMedia\('\(max-width:1023px\)'\)\.matches\)return;selectListing\(n,true\)/);
  assert.match(app,/data-card-map="\$\{x\.num\}"/);assert.match(app,/data-card-more="\$\{x\.num\}"/);
  assert.match(mobile,/classList\.toggle\('is-more-open'\)/);
  assert.match(mobileCss,/html body \.card__actions \.card__meta,html body \.event-card__meta\{display:none!important\}/);
  assert.match(mobileCss,/\.is-more-open \.card__actions \.card__meta/);
});
test('mobile: 44px minimum touch targets, zoom buttons 44px top right, tablet shows 2 card columns from 768px',()=>{
  assert.match(mobileCss,/\.mobile-bar button\{flex:1 1 0;height:44px;min-height:44px/);
  assert.match(mobileCss,/html body \.leaflet-control-zoom a\{width:44px!important;height:44px!important/);
  assert.match(mobileCss,/html body \.leaflet-top\.leaflet-left\{left:auto;right:10px\}/);
  assert.match(mobileCss,/@media\(min-width:768px\) and \(max-width:1023px\)\{[\s\S]*?grid-template-columns:1fr 1fr/);
  assert.match(mobileCss,/max-width:760px;margin:0 auto/);
});
test('mobile: Events day list follows the selected week and the map stays hidden',()=>{
  assert.match(layout,/\$\('eventsMobileList'\)\.innerHTML=viewDays\.map/);
  assert.match(layout,/mday--today/);
  assert.match(css,/html\[data-category="events"\] body #eventCalendar\{display:block!important\}/);
  assert.match(css,/html\[data-category="events"\] body \.map-frame\{display:none!important\}/);
  assert.match(app,/if\(state\.category==='events'\)\{matchingEvents\(\)/);
});
test('mobile: ZIP searches automatically at five digits (there is no GO button in the mobile search row)',()=>{
  assert.match(mobile,/\/\^\\d\{5\}\$\/\.test\(i\.value\.trim\(\)\)/);
  assert.match(mobileCss,/html body \.nav-search \.locbar__go\{display:none\}/);
});
