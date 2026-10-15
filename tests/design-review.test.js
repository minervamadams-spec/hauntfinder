// Design review 2026-10-15: node-level contract for the fixes. Rendered behavior
// at 1280px is covered by scripts/e2e-single-scroll.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=read('index.html'),css=read('styles.css'),app=read('app.js'),layout=read('layout.js'),chrome=read('chrome-filters.js'),community=read('community.js');

test('P1: pins and card badges are numbered 1..N in list order while data-pin keeps the listing number',()=>{
  assert.match(app,/labelMap\.clear\(\);visible\.filter\(x=>!x\.placeholder\)\.forEach\(\(x,i\)=>labelMap\.set\(x\.num,i\+1\)\)/);
  assert.match(app,/<span class="pin__num">\$\{pinLabel\(n\)\}<\/span>/);
  assert.match(app,/relabelPins\(\)/);
});
test('P1: overlapping pins cluster in a 34px accent circle, stop clustering at zoom 15 and spiderfy',()=>{
  assert.match(html,/leaflet\.markercluster@1\.5\.3/);
  assert.match(app,/CLUSTER_STOP_ZOOM=15/);
  assert.match(app,/L\.markerClusterGroup\(/);
  assert.match(app,/iconSize:\[34,34\]/);
  assert.match(app,/spiderfy\(\)/);
  assert.match(css,/\.hf-cluster\{width:34px;height:34px/);
});
test('P1: the map caption is gone and the filter panel stretches the full row',()=>{
  assert.match(css,/#mapCategoryHint,\.map-info\{display:none!important\}/);
  assert.match(css,/html \.filter-rail\{align-self:stretch;height:100%;min-height:0;display:flex;flex-direction:column;overflow-y:auto\}/);
  assert.match(css,/\.filter-rail__links\{margin-top:auto/);
});
test('P1: tabs are unfilled with a 3px accent underline; the focus ring is keyboard-only',()=>{
  for(const c of ['#FF7A1A','#A6E22E','#B48CFF'])assert.ok(css.includes(`border-bottom-color:${c}`),c);
  assert.match(css,/\.filterbar \.tabs button:focus-visible\{outline:2px solid #B48CFF;outline-offset:2px\}/);
  assert.equal(layout.includes("'('+"),false,'badges show the number only');
});
test('P2: filter panel collapses to 44px with a ☰ toggle, a vertical label and a count badge, starting collapsed below 1100px',()=>{
  assert.match(html,/id="railToggle"/);assert.match(html,/id="railExpand"/);assert.match(html,/id="railBadge"/);
  assert.match(chrome,/railSetCollapsed\(innerWidth<1100\)/);
  assert.match(chrome,/map\.invalidateSize\(\)/);
  assert.match(css,/html\[data-rail="collapsed"\] \.app__main\.page-grid\{grid-template-columns:44px /);
});
test('P2: How to visit has all four options; When defaults to Any night; Treat Stops drop This weekend; Events drop All types',()=>{
  assert.match(chrome,/\['Drive-by','Drive-by'\],\['Walk-by','Walk-up'\],\['Walk-through','Walk-through'\],\['Drive or walk by \(both\)'/);
  assert.match(chrome,/o\.kind===''\?\(!kind\):kind===o\.kind/);
  assert.match(chrome,/state\.category==='treats'\?CHROME_WHEN_OPTIONS\.slice\(0,2\)/);
  assert.match(chrome,/CHROME_EVENT_TYPE_OPTIONS\.filter\(o=>o\.value!=='All'\)/);
  assert.match(chrome,/data-rail-clear>Clear all filters/);
});
test('P2: search bar is ZIP, 25 MI, GO, My location',()=>{
  assert.match(html,/id="zipSearchBtn" type="button" aria-label="Search this ZIP">GO<\/button>/);
  assert.equal(/Within <span class="within-dd__value"/.test(html),false);
  assert.match(html,/locbar__locate-text"> My location/);
});
test('P2: display card is compact: heart in the header, 30px auto-width Add to route on one row with the meta links, only "Rate" underlined',()=>{
  const card=app.split('function cardHTML')[1].split('\nfunction ')[0];
  assert.ok(card.indexOf('favBtn(x)')<card.indexOf('card__actions'));
  assert.match(card,/card-rating__rate">Rate<\/span>/);
  assert.match(css,/min-height:30px!important;height:30px;margin-right:auto/);
  assert.match(css,/\.card-rating__rate\{text-decoration:underline\}/);
  assert.match(css,/\.card__distance\{text-transform:none!important\}/);
});
test('P2: treat card has a lime top border, no host notes or ratings, event-style dates and the add-your-home prompt',()=>{
  const treat=app.split('function treatCardHTML')[1].split('\nfunction ')[0];
  assert.equal(treat.includes('card__notes'),false);assert.equal(treat.includes('data-rating-summary'),false);
  assert.match(app,/function treatDateText\(x\)/);
  assert.match(app,/treat-prompt__link" href="\$\{TREAT_FORM_URL\}" target="_blank"/);
  assert.match(css,/\.treat-stop-card\{border-top:3px solid #A6E22E!important\}/);
});
test('P2: event card shows the type badge after the title, address only, a 3-line description with More, and event-form tags only',()=>{
  const ev=layout.split('function eventCard(x){')[1].split('\n function ')[0];
  assert.ok(ev.indexOf('event-type-pill')<ev.indexOf('Flyer</button>'));
  assert.equal(ev.includes('x.venue'),false);
  assert.match(ev,/event-card__clamp/);assert.match(ev,/data-more/);
  assert.match(layout,/EVENT_TAGS=\['Free','Open to all','Registration required','Kid-friendly'\]/);
  assert.match(css,/-webkit-line-clamp:3/);
});
test('P2: route bar collapses to "Your route · N of 10 stops · Expand" and expands to stops, Remove, Get directions and the planner link',()=>{
  assert.match(html,/id="routeToggle"/);assert.match(html,/id="routeDirections"/);assert.match(html,/id="routeLink" href="route\.html">Plan your route →<\/a>/);
  assert.match(layout,/function renderRoutePanel\(\)/);assert.match(layout,/directionsURL\(/);
});
test('P3: empty results say "Nothing matches these filters." with Clear all filters; list scroll is kept on filter change when the selection remains',()=>{
  assert.match(layout,/textContent='Nothing matches these filters\.'/);
  assert.match(layout,/\$\('showAllBtn'\)\.textContent='Clear all filters'/);
  assert.match(layout,/function keepListScroll\(\)/);
  assert.match(css,/\.leaflet-control-zoom a\{width:30px;height:30px/);
  assert.match(css,/text-shadow:0 1px 3px #000/);
});
