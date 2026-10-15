// Compact directory homepage (layout brief 2026-10-15).
// Node-level checks: pagination logic and the responsive CSS contract.
// Rendered behavior at 1280px and 390px is covered by scripts/e2e-single-scroll.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const html=read('index.html'),css=read('styles.css'),app=read('app.js'),layout=read('layout.js'),urlState=read('url-state.js'),chromeFilters=read('chrome-filters.js');
const F=require('../listing-format.js');
const block=css.split('/* ---- Compact directory layout homepage')[1]||'';

// ---- Pagination (8 per page) ----
test('pagination: eight cards per page with page position',()=>{
  assert.equal(F.RESULTS_PAGE_SIZE,8);
  assert.deepEqual(F.resolveResultsPage({prevKey:'a',key:'a',page:0,total:13}),{page:0,pages:2,start:0,end:8});
  assert.deepEqual(F.resolveResultsPage({prevKey:'a',key:'a',page:1,total:13}),{page:1,pages:2,start:8,end:13});
  assert.deepEqual(F.resolveResultsPage({prevKey:'a',key:'a',page:0,total:8}),{page:0,pages:1,start:0,end:8});
  assert.deepEqual(F.resolveResultsPage({prevKey:'a',key:'a',page:0,total:1}),{page:0,pages:1,start:0,end:1});
  assert.deepEqual(F.resolveResultsPage({prevKey:'a',key:'a',page:0,total:0}),{page:0,pages:1,start:0,end:0});
});
test('pagination: filter, category or search changes reset to page 1; same results keep the page; out-of-range pages clamp',()=>{
  assert.equal(F.resolveResultsPage({prevKey:'displays|All',key:'displays|Spooky',page:1,total:13}).page,0,'filter change');
  assert.equal(F.resolveResultsPage({prevKey:'displays|All',key:'treats|All',page:1,total:13}).page,0,'category change');
  assert.equal(F.resolveResultsPage({prevKey:'k',key:'k',page:1,total:13}).page,1,'route toggle / re-render keeps the page');
  assert.equal(F.resolveResultsPage({prevKey:'k',key:'k',page:5,total:13}).page,1,'clamped to the last page');
  assert.equal(F.resolveResultsPage({prevKey:'k',key:'k',page:-3,total:13}).page,0,'clamped to the first page');
});
test('pagination: selecting a listing opens the page that holds its card, even after a filter reset',()=>{
  assert.equal(F.resolveResultsPage({prevKey:'k',key:'k',page:0,total:13,focusIndex:11}).page,1);
  assert.equal(F.resolveResultsPage({prevKey:'k',key:'changed',page:0,total:13,focusIndex:9}).page,1,'focus wins over the reset');
  assert.equal(F.resolveResultsPage({prevKey:'k',key:'k',page:1,total:13,focusIndex:-1}).page,1,'not in results: page unchanged');
});
test('pagination: cards render one page; pins and the count line use the full result set',()=>{
  const fn=app.split('function renderCards(){')[1].split('\nfunction ')[0];
  assert.match(fn,/resolveResultsPage\(/);
  assert.match(fn,/visible\.slice\(pg\.start,pg\.end\)\.map\(cardHTML\)/,'only the current page renders as cards');
  assert.match(fn,/syncListingMarkers\(visible\)/,'every matching pin stays on the map');
  assert.match(fn,/nonPlaceholder\.length/,'count line counts all results, not the page');
  assert.match(layout,/state\.pageFor=n;/,'pin/card selection jumps to the card page');
  assert.match(fn,/state\.dateFilter&&state\.dateFilter\.kind\?\[state\.dateFilter\.kind,state\.dateFilter\.date\|\|null\]:null/,'page key compares the date filter by meaning: an empty filter normalized from null to {kind:null} is not a filter change (it reset ?house= deep links to page 1)');
});
test('pagination controls: Previous/Next buttons and a live page position under the cards',()=>{
  const nav=html.match(/<nav id="resultsPager"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(nav,'pager present');
  assert.match(nav[0],/aria-label="Result pages"/);
  assert.match(nav[0],/<button type="button" class="btn btn--outline" id="pagePrev">Previous<\/button>/);
  assert.match(nav[0],/<span id="pageStatus" aria-live="polite"><\/span>/);
  assert.match(nav[0],/<button type="button" class="btn btn--outline" id="pageNext">Next<\/button>/);
  assert.ok(html.indexOf('id="cardList"')<html.indexOf('id="resultsPager"'),'pager follows the cards');
  assert.match(html,/id="countLine" class="count-line" tabindex="-1"/,'count line takes focus after a page change');
  assert.match(app,/function goToPage\(p\)\{/);
});

// ---- Page order ----
test('markup order keeps the map before results for the compact mobile flow',()=>{
  const at=s=>{const i=html.indexOf(s);assert.ok(i>-1,s);return i};
  const seq=['class="hf-header banner"','class="intro-strip"','class="filterbar"','class="map-frame"','id="countLine"','id="cardList"','id="resultsPager"','id="routeSection"'];
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
test('banner caps: 180px desktop, 140px mobile; intro stays and is compact',()=>{
  assert.match(block,/\.banner__frame\{max-height:180px\}/);
  assert.match(block,/@media\(max-width:767px\)\{[^}]*\.banner__frame\{max-height:140px\}/);
  assert.match(html,/<p class="intro-strip__copy">Find decorated homes/);
});
test('map is a compact 240px mobile surface and a sticky desktop side panel; full map overlay keeps working',()=>{
  assert.match(block,/html:not\(\[data-category="events"\]\):not\(\[data-fullmap\]\) \.map-frame\{height:240px/);
  assert.match(block,/\.map-frame\{height:clamp\(360px,calc\(100dvh - var\(--filterbar-h,0px\) - 32px\),620px\);position:sticky/);
  assert.match(css,/html\[data-fullmap\] \.map-frame\{position:fixed;inset:0;height:100dvh/,'full map overlay rule intact');
});
test('desktop uses the designed filters, results and map workspace rails',()=>{
  assert.match(html,/<aside class="filter-rail" id="filterRail"/,'filter rail is real page structure');
  assert.match(block,/html:not\(\[data-category="events"\]\) \.page-grid\{width:100%;max-width:none;padding:0;gap:0;display:grid;grid-template-columns:minmax\(250px,\.58fr\) minmax\(420px,1fr\) minmax\(520px,1\.8fr\)/);
  assert.match(block,/html:not\(\[data-category="events"\]\) \.filter-rail\{display:block;grid-column:1;grid-row:1\/span 2;min-width:0;overflow-y:auto/);
  assert.match(block,/html:not\(\[data-category="events"\]\) \.list-column\{display:block;grid-column:2;grid-row:1\/span 2;min-width:0;min-height:0;height:auto!important;max-height:none!important;overflow-y:auto!important/);
  assert.match(block,/html:not\(\[data-category="events"\]\) \.map-column\{display:block;grid-column:3;grid-row:1;min-width:0;min-height:0;width:auto\}/);
  assert.match(block,/html:not\(\[data-category="events"\]\) \.route-wrap\{grid-column:3;grid-row:2/);
  assert.equal(css.includes('html[data-view='),false,'no Map/List view states left in the stylesheet');
});
test('desktop rail exposes direct filter chips and the Leaflet canvas resizes after its grid cell changes',()=>{
  assert.match(chromeFilters,/const desktopRail=.*state\.category!=='events'/,'direct rail is limited to directory categories');
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
});
test('events: calendar presentation kept, no map fabricated, route planner keeps its place beside the week',()=>{
  assert.match(layout,/if\(mf\)mf\.hidden=event/,'events still hide the map');
  assert.match(block,/html\[data-category="events"\] \.route-wrap\{order:1;width:100%;margin-top:0\}/);
  assert.match(block,/html\[data-category="events"\] \.list-column\{order:2\}/);
  assert.match(block.split('@media(min-width:1200px){')[1]||'',/^[^@]*html\[data-category="events"\] \.route-wrap\{grid-column:1;grid-row:2/,'>=1200: route planner under the week, left column');
  assert.match(layout,/\$\('resultsPager'\)\.hidden=true/,'events never show the listing pager');
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
  assert.match(verify,/homepage has the compact directory map, card pager and no Map\/List switch/);
});
