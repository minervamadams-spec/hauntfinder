// Design review 2026-10-15: node-level contract for the fixes. Rendered behavior
// at 1280px is covered by scripts/e2e-single-scroll.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=read('index.html'),css=read('styles.css'),app=read('app.js'),layout=read('layout.js'),chrome=read('chrome-filters.js'),community=read('community.js');

test('P1 (reversed by owner): pins and card badges keep the stable listing number, so shared links and what hosts were told stay correct',()=>{
  assert.equal(/labelMap\.set\(/.test(app),false,'no renumbering');
  assert.match(app,/<span class="pin__num">\$\{pinLabel\(n\)\}<\/span>/);
  assert.match(app,/relabelPins\(\)/);
});
test('P1: overlapping pins cluster as a stacked-ring group marker, stop clustering at zoom 15 and spiderfy',()=>{
  assert.match(html,/leaflet\.markercluster@1\.5\.3/);
  assert.match(app,/CLUSTER_STOP_ZOOM=15/);
  assert.match(app,/L\.markerClusterGroup\(/);
  assert.match(app,/iconSize:\[36,36\]/);assert.match(app,/click to zoom/);
  assert.match(app,/spiderfy\(\)/);
  assert.match(css,/\.hf-cluster\{width:36px;height:36px;background:#1C1626!important/);
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

// ---- Round 2 ----
test('round 2: map fits leave room for the route bar; one pin centres at zoom 14',()=>{
  assert.match(app,/function mapFitOptions\(extra\)\{return Object\.assign\(\{paddingTopLeft:\[60,60\],paddingBottomRight:\[60,routePad\(\)\]\}/);
  assert.match(app,/map\.setView\(pts\[0\],14,\{animate:false\}\)/);
  assert.match(layout,/if\(category!=='events'\)fitVisiblePins\(\)/);
});
test('round 2: scare dots only when a level is set; all-week events show hours; empty days merge; Sat 31 always shows',()=>{
  assert.match(app,/x\.levels\.length\?`<p class="card__scare-row">/);
  assert.match(layout,/x\.ongoing\?\(x\.hours\?compactTime\(x\.hours\):'Open all week'\)/);
  assert.match(layout,/if\(!list\.length&&!halloween\)\{run\.push\(date\);return\}/);
});
test('round 2: tab row is 48px with the underline on the row line; Search this area is a top-centre pill; empty route bar is compact',()=>{
  assert.match(css,/\.filterbar \.nav-row\{height:48px!important/);
  assert.match(css,/map-float-btn--search\{top:12px;bottom:auto!important;min-height:32px/);
  assert.match(css,/\.route-wrap\.is-empty \.route-toggle\{height:40px/);
  assert.match(html,/route-toggle__empty">Add stops from the list/);
});

// ---- Codex QA defects (c87977e) ----
test('QA fix: the selected card keeps its on-screen position when the list re-renders; a hovered card also lights its cluster',()=>{
  assert.match(layout,/function listAnchor\(\)/);assert.match(layout,/function restoreAnchor\(a\)/);
  assert.match(layout,/const anchor=listAnchor\(\);originalCards\(\);if\(!restoreAnchor\(anchor\)\)keepListScroll\(\)/);
  assert.match(app,/getVisibleParent\(lm\)/);
  assert.match(css,/\.leaflet-marker-icon\.is-linked \.hf-cluster\{transform:scale\(1\.1\)\}/);
});

test('QA fix 2: card hover links its pin regardless of the pointer media query (Codex probe had no fine pointer)',()=>{
  const fn=app.split('function linkPair(n,on){')[1].split('\nfunction ')[0];
  assert.equal(fn.includes('pointer:fine'),false);
  assert.match(fn,/is-linked/);
  assert.match(css,/\.pin\.is-linked\{transform:scale\(1\.08\)\}/);
});

test('v7: the intro line shows from 760px up and is hidden only below 760px',()=>{
  assert.match(css,/@media\(min-width:760px\) and \(max-width:1023px\)\{\s*\.hf-header\.banner\{grid-template-columns:clamp\(215px,28vw,260px\) minmax\(0,1fr\)/);
  assert.match(css,/\.intro-strip__copy\{display:block;font-size:13px/);
  assert.match(css,/@media\(max-width:1023px\)\{[\s\S]*?\.intro-strip__copy\{display:none\}/,'the base rule still hides it on phones; the 760+ band overrides it');
});
