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

test('≥1024px: displays/treats use a compact results-left, sticky-map-right directory; events keep week-left/cards-right',()=>{
  assert.ok(!css.includes('grid-template-columns:520px minmax(0,1fr)'),'no legacy 520px card column split');
  assert.ok(css.includes('html:not([data-category="events"]) .page-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(360px,1fr)'),'displays/treats: results-left, map-right grid');
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

test('banner: v7 uses the supplied scene strip and separate sign, with a deliberately compact fixed workspace header',()=>{
  const v7=css.split('/* ---- v7 compact workspace')[1];
  assert.match(v7,/\.hf-header\.banner\{height:112px;[^}]*scene-strip-v2\.png/,'desktop is the supplied 112px scene strip');
  assert.match(v7,/\.banner__frame\{width:auto;height:clamp\(64px,8vw,100px\)/,'transparent sign is contained rather than crop-filled');
  assert.match(v7,/\.banner__img\{width:auto;height:100%;object-fit:contain/,'sign uses contain, so its artwork cannot be cut off');
  assert.match(v7,/@media\(max-width:1023px\)\{[^}]*\.hf-header\.banner\{height:96px/,'mobile/tablet uses a shorter scene strip');
  assert.match(html,/src="assets\/sign-cutout\.png"/,'homepage uses the supplied transparent sign asset');
  assert.equal(css.includes('.hf-footer>.community-links'),false,'dead footer community-links rule removed');
});

test('app.js preamble is untouched by the hotfix',()=>{
  const crypto=require('node:crypto'),{execSync}=require('node:child_process');
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
