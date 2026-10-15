// Compact directory homepage (layout brief 2026-10-15).
// Node-level checks: pagination logic and the responsive CSS contract.
// Rendered behavior at 1280px and 390px is covered by scripts/e2e-single-scroll.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const html=read('index.html'),css=read('styles.css'),app=read('app.js'),layout=read('layout.js'),urlState=read('url-state.js'),chromeFilters=read('chrome-filters.js');
const block=css.split('/* ---- Compact directory layout homepage')[1]||'';

test('v7 continuous rail renders every matching card and retires visible pager controls',()=>{
  const fn=app.split('function renderCards(){')[1].split('\nfunction ')[0];
  assert.match(fn,/visible\.map\(cardHTML\)/);
  assert.equal(fn.includes('resolveResultsPage('),false);
  assert.match(fn,/syncListingMarkers\(visible\)/);
  assert.equal(html.includes('id="pagePrev"'),false);
  assert.equal(html.includes('id="pageNext"'),false);
});

// ---- Continuous results rail (replaces pagination) ----
test('results rail: every matching card renders, with no page slicing or page helpers in the render path',()=>{
  const fn=app.split('function renderCards(){')[1].split('\nfunction ')[0];
  assert.match(fn,/cardList'\)\.innerHTML=visible\.map\(cardHTML\)\.join\(''\)/);
  assert.equal(/\.slice\(pg\./.test(fn),false,'no page slice');
  assert.equal(/state\.page\b/.test(fn),false,'no page state');
});
test('results rail: pins and the count line cover the full result set',()=>{
  const fn=app.split('function renderCards(){')[1].split('\nfunction ')[0];
  assert.match(fn,/syncListingMarkers\(visible\)/,'every matching pin stays on the map');
  assert.match(fn,/nonPlaceholder\.length/,'count line counts all results');
});
test('results rail: pin click scrolls its card into view inside the scrolling rail on desktop, and the page on narrow screens',()=>{
  const fn=app.split('function selectListing(n,scroll=false){')[1].split('\n')[0];
  assert.match(fn,/if\(scroll\)\{/,'selection scroll is not limited to narrow screens');
  assert.equal(fn.includes('innerWidth<1024){const card'),false);
  assert.match(fn,/closest\('\.list-column'\)/);
  assert.match(fn,/panel\.scrollTo\(/,'desktop scrolls the rail');
  assert.match(fn,/else if\(innerWidth<1024\)window\.scrollTo\(/,'narrow screens scroll the page');
  assert.match(fn,/cb\.top>=pb\.top&&cb\.bottom<=pb\.bottom\)return/,'a card already in view is not re-scrolled');
});
test('results rail: no pagination controls or page-jump state remain in markup or selection',()=>{
  assert.equal(html.includes('resultsPager'),false,'hidden pager element removed');
  assert.equal(require('../listing-format.js').resolveResultsPage,undefined);
  assert.equal(require('../listing-format.js').RESULTS_PAGE_SIZE,undefined);
  for(const id of ['pagePrev','pageNext','pageStatus'])assert.equal(html.includes(`id="${id}"`),false,id);
  assert.equal(app.includes('function goToPage('),false);
  assert.equal(/state\.page\b/.test(app+layout),false);
});
test('results rail: ?house= deep links select their card without any page jump',()=>{
  assert.match(layout,/selectListing\(linked,innerWidth>=1024\);if\(innerWidth>=1024\)\[0,300,900,1800\]\.forEach\(t=>setTimeout\(\(\)=>showCardInRail\(linked\),t\)\);if\(params\.get\('view'\)==='map'\)\{state\.linkedHouse=house\.num/);
  assert.match(layout,/selectListing=function\(n,scroll=false\)\{[^\n]*renderCards\(\)\}originalSelect\(n,scroll\)/);
  assert.equal(layout.includes('pageFor'),false,'no page-jump state');
});

// ---- Page order ----
test('markup order keeps the header, controls, filters, map and results in the compact workspace flow',()=>{
  const at=s=>{const i=html.indexOf(s);assert.ok(i>-1,s);return i};
  const seq=['class="hf-header banner"','class="intro-strip__copy"','class="filterbar"','id="filterRail"','class="map-frame"','id="countLine"','id="cardList"','id="routeSection"'];
  for(let i=1;i<seq.length;i++)assert.ok(at(seq[i-1])<at(seq[i]),seq[i-1]+' before '+seq[i]);
  const mapColumn=html.split('<section class="map-column"')[1].split('<aside class="list-column">')[0];
  assert.equal(mapColumn.includes('id="routeSection"'),false,'route planner is no longer wedged between the map and the cards');
});
test('map/list switch removed: no split-layout toggle and no stored view preference',()=>{
  for(const id of ['viewMapBtn','viewListBtn'])assert.equal(html.includes(`id="${id}"`),false,id);
  assert.equal(html.includes('class="view-toggle"'),false);
  assert.equal(layout.includes('applyViewMode(loadView(localStorage))'),false,'old Map/List preference is not restored');
  assert.equal(layout.includes('saveView('),false,'no view preference is written');
  assert.match(layout,/window\.hfApplyView=applyViewMode/,'?view=map still brings the map into view');
  assert.match(urlState,/window\.hfApplyView/);
});

// ---- CSS contract ----
test('v7 header uses the supplied scene strip, contained sign, and hides the intro on narrow screens',()=>{
  const v7=css.split('/* ---- v7 compact workspace')[1]||'';
  assert.match(v7,/\.hf-header\.banner\{height:112px;[^}]*scene-strip-v3\.png/);
  assert.match(v7,/\.banner__frame\{width:auto;height:clamp\(64px,8vw,100px\)/);
  assert.match(v7,/\.banner__img\{width:auto;height:100%;object-fit:contain/);
  assert.match(v7,/@media\(max-width:1023px\)\{[\s\S]*?\.intro-strip__copy\{display:none\}/);
  assert.match(html,/<p class="intro-strip__copy">Find decorated homes/);
});
test('map is a compact 240px mobile surface and fills the desktop workspace rail; full map overlay keeps working',()=>{
  const v7=css.split('/* ---- v7 compact workspace')[1]||'';
  assert.match(block,/html:not\(\[data-category="events"\]\):not\(\[data-fullmap\]\) \.map-frame\{height:240px/);
  assert.match(v7,/html:not\(\[data-hf-rail="off"\]\):not\(\[data-fullmap\]\) \.map-frame\{height:100%;min-height:0;position:static/);
  assert.match(css,/html\[data-fullmap\] \.map-frame\{position:fixed;inset:0;height:100dvh/,'full map overlay rule intact');
});
test('desktop uses the designed filters, results and map workspace rails',()=>{
  assert.match(html,/<aside class="filter-rail" id="filterRail"/,'filter rail is real page structure');
  assert.match(html,/class="filterbar__rail-head" id="railToggle"/,'desktop rail heading shares the control row');
  const v7=css.split('/* ---- v7 compact workspace')[1]||'';
  assert.match(v7,/height:100%!important;min-height:0;padding:0;gap:0;display:grid;grid-template-columns:260px minmax\(300px,440px\) minmax\(320px,1fr\)/);
  assert.match(v7,/\.filter-rail\{grid-column:1;grid-row:1;display:flex;flex-direction:column;min-height:0;padding:14px;overflow-y:auto/);
  assert.match(v7,/\.list-column\{grid-column:2;grid-row:1;display:block;min-height:0;height:auto!important;max-height:none!important;padding:0;overflow-y:auto!important/);
  assert.match(v7,/\.map-column\{grid-column:3;grid-row:1;display:block;min-width:0;min-height:0;width:auto;position:relative/);
  assert.match(v7,/\.route-wrap\{grid-column:3;grid-row:1;z-index:700;align-self:end/);
  assert.match(v7,/\.filterbar \.tabs\{grid-column:2/,'tabs begin above the results rail, not above filters');
  assert.match(v7,/\.filterbar \.nav-search\{grid-column:3/,'search controls align with the map rail');
  assert.equal(css.includes('html[data-view='),false,'no Map/List view states left in the stylesheet');
});
test('desktop rail exposes direct filter chips and the Leaflet canvas resizes after its grid cell changes',()=>{
  assert.match(chromeFilters,/const desktopRail=\(\)=>true/,'the chip rail renders on every tab and width (mobile shows it in the Filters sheet)');
  assert.match(chromeFilters,/railChip\('event-type'/);
  assert.match(chromeFilters,/railChip\('event-feature'/);
  assert.match(chromeFilters,/function railFiltersHTML\(\)/,'rail renders working controls rather than decorative labels');
  assert.match(chromeFilters,/railChip\('when'/,'time filters are direct buttons');
  assert.match(chromeFilters,/railChip\('feature'/,'feature filters are direct buttons');
  assert.match(layout,/new ResizeObserver\(\(\)=>\{if\(resizeQueued\)return;resizeQueued=true;requestAnimationFrame/,'map remeasures after its desktop grid cell settles');
});
test('map key and distance note stay hidden as in the default view (they would cover the map and its attribution)',()=>{
  assert.match(block,/\.map-key,\.map-note\{display:none\}/);
});
test('cards stay a compact single column in the results rail and mobile flow',()=>{
  assert.match(block,/html:not\(\[data-category="events"\]\) #cardList\{display:flex;flex-direction:column/);
  assert.equal(block.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),false);
  assert.match(block,/\.card--compact\{padding:12px 14px;gap:8px;min-height:0\}/);
  const v7=css.split('/* ---- v7 compact workspace')[1]||'';
  assert.match(v7,/\.card--compact \.card__route-btn\{min-height:36px!important/,'desktop cards use compact route actions');
  assert.match(v7,/\.card--compact \.card__address\{min-height:26px/,'desktop cards do not waste a 44px address target row');
});
test('events (v7): map with event pins fills the right rail; day blocks replace the desktop week grid; route planner keeps its place',()=>{
  assert.match(layout,/if\(mf\)mf\.hidden=false/,'events show the map');
  assert.match(block,/html\[data-category="events"\] \.route-wrap\{order:1;width:100%;margin-top:0\}/);
  assert.match(block,/html\[data-category="events"\] \.list-column\{order:2\}/);
  assert.match(block.split('@media(min-width:1200px){')[1]||'',/^[^@]*html\[data-category="events"\] \.route-wrap\{grid-column:1;grid-row:2/,'>=1200: route planner under the week, left column');
  assert.equal(layout.includes('resultsPager'),false,'no pager element is referenced');
});

// ---- Deep link ----
test('deep link: ?house=N&view=map centers the pin and brings the map under the filters',()=>{
  assert.match(layout,/if\(params\.get\('view'\)==='map'\)\{state\.linkedHouse=house\.num;focusLinkedHouse\(\)/);
  assert.match(layout,/function focusLinkedHouse\(\)\{/);
  assert.match(layout,/function bringMapIntoView\(\)\{/);
});

// ---- Live QA gate ----
test('live QA gate: verify-live checks the compact directory homepage and hashes url-state.js',()=>{
  const verify=read('scripts/verify-live.js');
  assert.ok(verify.includes("'url-state.js'"));
  assert.match(verify,/homepage has the compact directory map, continuous result rail and no Map\/List switch/);
});

// ---- Events tab (v7): list rail with day blocks + map with event pins ----
test('events v7: rail lists Open all week, then one block per day of Halloween week, then the type key',()=>{
  const fn=layout.split('function eventsRailHTML(items){')[1].split('\n renderCards=')[0];
  assert.match(fn,/ev-open__label">Open all week/);
  assert.match(fn,/Halloween week · /);
  assert.match(fn,/ev-day__empty">No events yet/);
  assert.match(fn,/Trick-or-treat night/);
  assert.match(fn,/class="ev-key"/);
  assert.match(layout,/\$\('cardList'\)\.innerHTML=eventsRailHTML\(items\)/);
  assert.equal(layout.includes("''}}</p>`"),false,'no stray } after event details');
});
test('events v7: count line carries Add all events to your calendar and proxies the existing handler',()=>{
  assert.match(html,/id="railAddAll"[^>]*>[\s\S]*?Add all events to your calendar/);
  assert.match(layout,/\$\('railAddAll'\)\.addEventListener\('click',\(\)=>\$\('addAllToCalendar'\)\.click\(\)\)/);
});
test('events v7: the map and event pins show at every width, and the week grid is gone on desktop; event pins select their card in the rail',()=>{
  assert.match(css,/#eventCalendar\{display:none!important\}/);
  assert.match(css,/html\[data-category="events"\] \.map-column\{align-self:stretch;height:100%\}/);
  assert.match(layout,/mf\.hidden=false/);
  assert.match(app,/function syncEventPins\(\)\{[^\n]*state\.category==='events'\)\{matchingEvents\(\)[^\n]*eventSquareIcon\(i\+1\)[^\n]*selectEventCard\(ev\.id\)/);
  assert.match(app,/function selectEventCard\(id\)\{/);
  assert.equal(/L\.circle\(/.test(app),false,'v7: no radius circle at any width');
});
