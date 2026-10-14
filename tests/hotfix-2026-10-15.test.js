// Hotfix 2026-10-15 — live issues on the 1A redesign (commit 2f04e79).
// Regression tests for: When-filter default, ≥1200px D1 anatomy, the
// 768–1199 events band, and banner no-clip rules. (The tile-provider
// regression lives in design-1a.test.js.)
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const sch=require('../schedules.js');

test('When filter defaults to Any night on every load; no stale persisted date',()=>{
  assert.match(layout,/state\.dateFilter=\{kind:null,date:null\}/,'initial state is Any night');
  assert.match(layout,/localStorage\.removeItem\(DATE_FILTER_KEY\)/,'stale hfdate:v1 cleared at load');
  assert.equal(layout.includes('state.dateFilter=loadDateFilter(localStorage)'),false,'load no longer restores the persisted filter');
  assert.equal(sch.dateFilterLabel({kind:null,date:null}),null,'count line shows no date label by default');
  assert.ok(sch.schedulesDateMatch({schedule:null},{kind:null,date:null}),'null filter matches listings with no schedule info');
  assert.ok(sch.schedulesDateMatch({schedule:{'2026-10-29':[[0,0]]}},{kind:null,date:null}),'null filter matches scheduled listings');
  assert.match(app,/state\.dateFilter&&state\.dateFilter\.kind&&typeof schedulesDateMatch/, 'matching only applies a date filter when one is active');
  assert.match(layout,/data-date-filter/,'Tonight/Weekend/Choose-a-date hooks still wired');
  assert.match(css,/\.event-day\{/, 'when chips remain styled');
});

test('≥1200px default desktop anatomy is D1: 520px listings LEFT, map + route RIGHT, 24px gap',()=>{
  const block=css.split('Issue 3 — spec D1')[1].split('Issue 5 — banner')[0];
  assert.match(block,/grid-template-columns:520px minmax\(0,1fr\);gap:24px/);
  assert.match(block,/\.list-column\{grid-column:1;grid-row:1\/span 2\}/,'cards take the left column');
  assert.match(block,/\.map-column\{grid-column:2;grid-row:1\}/,'map takes the right column');
  assert.match(block,/\.route-wrap\{grid-column:2;grid-row:2;width:100%\}/,'route panel sits under the map');
  assert.match(block,/html\[data-view="map"\] \.map-column\{grid-column:1/,'map view keeps a single full-width column (no implicit sliver track)');
  const eventsLarge=css.split('@media(min-width:1200px)')[1].split('/* ---- Hotfix')[0];
  assert.match(eventsLarge,/html\[data-category="events"\] \.page-grid\{grid-template-columns:minmax\(0,1fr\) 440px\}/,'events keep week-left/cards-right at ≥1200');
  assert.match(eventsLarge,/html\[data-category="events"\] \.map-column\{grid-column:1;grid-row:1\}/);
  assert.match(eventsLarge,/html\[data-category="events"\] \.list-column\{grid-column:2;grid-row:1\/span 2\}/);
});

test('events 768–1199: single column, cards stacked below the week, 7 columns with a 120px floor',()=>{
  const band=css.split('@media(min-width:960px) and (max-width:1199px)')[1].split('@media(min-width:1200px)')[0];
  assert.match(band,/html\[data-category="events"\] \.page-grid\{grid-template-columns:minmax\(0,1fr\)\}/,'single column');
  assert.match(band,/html\[data-category="events"\] \.map-column\{grid-column:1;grid-row:auto\}/,'week section takes the column');
  assert.match(band,/html\[data-category="events"\] \.list-column\{display:block;grid-column:1;grid-row:auto/,'event cards stack below the week, full width');
  assert.match(band,/repeat\(7,minmax\(120px,1fr\)\)/,'week grid can never sliver');
  assert.match(band,/\.event-week\{overflow-x:auto\}/,'safety scroll if the band ever narrows');
  const small=css.split('@media(max-width:959px)')[1].split('/* Hotfix 2026-10-15')[0];
  assert.match(small,/html\[data-category="events"\] \.list-column\{display:none\}/,'below 960 the mobile day list carries the page without the cards column');
  assert.match(css,/\@media\(min-width:960px\)\{[^}]*\.event-week\{display:grid\}[^}]*\.events-mobile-list\{display:none\}/,'week grid ↔ mobile day list switch at 960 intact');
});

test('banner: no fixed height can clip the art; frame/img stay viewport-relative at every width',()=>{
  const art=css.split('/* v6 Phase A: 1A banner')[1].split('/* v6 Phase B')[0];
  assert.match(art,/\.banner__frame\{display:block;width:100%;aspect-ratio:5\.5\/1;overflow:hidden\}/,'desktop crop is aspect-ratio driven');
  assert.match(art,/\.banner__img\{width:100%;height:100%;object-fit:cover;object-position:center 60%/,'img fills the frame, wordmark anchor at center 60%');
  assert.match(art,/\@media\(max-width:767px\)\{[^}]*aspect-ratio:4\.2\/1/,'mobile crop ratio');
  const hotfix=css.split('/* Issue 5 — banner')[1];
  assert.match(hotfix,/\.hf-header\.banner\{height:auto;min-height:0;flex:0 0 auto;overflow:hidden\}/,'retired 145px/200px header heights can no longer clip the banner');
  const fixedPxHeights=[...css.matchAll(/\.banner[^{]*\{[^}]*\bheight:\s*\d+px/g)];
  assert.deepEqual(fixedPxHeights,[],'no fixed px height on any .banner wrapper');
  const bannerWidths=[...css.matchAll(/\.banner[^{]*\{[^}]*\bwidth:\s*(\d+(?:\.\d+)?)%/g)].map(m=>parseFloat(m[1]));
  assert.ok(bannerWidths.every(w=>w<=100),'no .banner wrapper wider than 100% ('+bannerWidths.join(',')+')');
  assert.equal(css.includes('.hf-footer>.community-links'),false,'dead footer community-links rule removed');
});

test('app.js preamble is untouched by the hotfix',()=>{
  const crypto=require('node:crypto'),{execSync}=require('node:child_process');
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
