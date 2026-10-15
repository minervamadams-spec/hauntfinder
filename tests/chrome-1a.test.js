const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const chrome=fs.readFileSync(path.join(ROOT,'chrome-filters.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const m=require('../chrome-filters.js');

const INTRO_COPY='Find decorated homes, spooky displays, treat stops, and Halloween events near you. Check visiting details, plan your route, or submit a listing for free.';

test('intro strip: band background, verbatim copy, no buttons',()=>{
  const block=html.split('<section class="intro-strip">')[1].split('</section>')[0];
  assert.ok(block.includes(INTRO_COPY),'verbatim spec 6.2 copy');
  assert.equal(/<button|<a /.test(block),false,'no buttons in the strip');
  assert.ok(css.includes('.intro-strip{background:var(--band)'),'band background token');
  assert.ok(css.includes('.intro-strip__copy'),'Barlow 17px text-2 copy style');
});

test('header keeps only the banner art; alerts CTA lives in the footer',()=>{
  const header=html.split('<header class="hf-header banner">')[1].split('</header>')[0];
  assert.ok(header.includes('banner__frame'),'banner art kept');
  assert.equal(header.includes('alerts-cta'),false,'alerts CTA removed from header');
  assert.equal(header.includes('shareBtn'),false,'share button moved to the filter row');
  assert.ok(html.includes('<a class="alerts-footer-link" href="alerts.html">Get alerts</a>'),'footer alerts link is a plain same-tab link to the standalone page');
});

test('nav row: tablist with ids and accent badges sits beside the search cluster',()=>{
  const bar=html.split('<section class="filterbar"')[1].split('</section>')[0];
  assert.ok(bar.includes('role="tablist"'),'tablist in the chrome');
  assert.match(bar,/id="displayTabCount" class="tabs__badge tabs__badge--displays"/);
  assert.match(bar,/id="treatStopCount" class="tabs__badge tabs__badge--treats"/);
  assert.match(bar,/id="eventCount" class="tabs__badge tabs__badge--events"/);
  assert.ok(bar.indexOf('class="tabs"')<bar.indexOf('id="zipInput"'),'tabs left of search');
  assert.ok(bar.includes('placeholder="Budd Lake, NJ 07828"'),'spec search placeholder');
  assert.ok(bar.includes('◎ Use my location'),'purple location affordance');
  assert.ok(html.indexOf('id="countLine"')>html.indexOf('id="displaysPanel"'),'count line stays in the listings column');
});

test('search wiring ids survive the restructure',()=>{
  for(const id of ['zipInput','zipSearchBtn','locateBtn','locStatus','backToZipBtn','shareBtn','viewMapBtn','viewListBtn'])
    assert.ok(html.includes(`id="${id}"`),id+' present');
  assert.ok(html.includes('class="view-toggle"'),'view toggle class preserved for layout.js sync');
  assert.match(html,/class="locbar__radius" role="radiogroup" aria-label="Search radius"/,'radius radiogroup intact');
  assert.deepEqual([...html.matchAll(/data-radius="(\d+)"/g)].map(x=>+x[1]).slice(0,4),[5,10,25,50],'radii 5/10/25/50');
  assert.ok(html.includes('<details class="within-dd">'),'Within dropdown wraps the radiogroup');
  assert.ok(html.indexOf('<details class="within-dd">')<html.indexOf('class="locbar__radius" role="radiogroup"'),'wrap order');
  assert.equal(/id="locStatus"[^>]*>Within/.test(html.split('<section class="filterbar"')[1].split('</section>')[0]),false,'locStatus starts empty');
});

test('chrome-filters.js loads after layout.js and before url-state.js (alerts-link.js retired)',()=>{
  assert.ok(html.indexOf('chrome-filters.js')>html.indexOf('layout.js'),'after layout.js');
  assert.ok(html.indexOf('chrome-filters.js')<html.indexOf('url-state.js'),'before url-state.js');
  assert.ok(html.indexOf('alerts-link.js')===-1,'alerts-link.js stays deleted (page-first alerts)');
});

test('Show options: spec labels, single select, Walk-up maps to Walk-by data',()=>{
  assert.deepEqual(m.CHROME_SHOW_OPTIONS.map(o=>o.label),['All types','Family Friendly','Spooky','Scary','Walk-through','Drive-by','Walk-up']);
  assert.equal(m.chromeValueForShowLabel('Walk-up'),'Walk-by');
  assert.equal(m.chromeShowLabelForValue('Walk-by'),'Walk-up');
  assert.equal(m.chromeValueForShowLabel('All types'),'All');
  assert.equal(m.chromeShowLabelForValue('All'),'All types');
});

test('Features options: spec 7.1 wording, multi-select with canonical data keys',()=>{
  assert.deepEqual(m.CHROME_FEATURE_OPTIONS.map(o=>o.label),['Animatronics','Fog','Music / Sound','Photo opportunities','Lights','Live Actors','Costumes Available']);
  assert.equal(m.chromeFeatureValue('Live Actors'),'Actors');
  assert.equal(m.chromeFeatureValue('Music / Sound'),'Music/Sound');
  assert.equal(m.chromeFeatureValue('Photo opportunities'),'Photo Opportunities');
  assert.equal(m.chromeFeatureLabelForValue('Actors'),'Live Actors');
  assert.ok(chrome.includes(' selected`'),'"N selected" button label template');
  assert.deepEqual(m.CHROME_TREAT_FEATURE_OPTIONS.map(o=>o.label),['Stroller friendly','Porch light on'],'treat Features pair per spec 7.2');
});

test('matchFilter: multi-feature AND check, treats lose the Town filter, both-type fallback kept',()=>{
  assert.ok(app.includes("state.features.every(f=>(x.features||[]).some(xf=>featureKey(xf)===f))"),'multi-select AND semantics');
  const treatsBranch=app.split("if(state.category==='treats')return ")[1].split(';')[0];
  assert.equal(treatsBranch.includes('x.town'),false,'no Town matching in the treats branch');
  assert.equal(treatsBranch.includes('state.filter'),false,'treats branch no longer depends on the Show value');
  assert.ok(app.includes("x.type.includes('Drive or walk by (both)')&&['Drive-by','Walk-by'].includes(state.filter)"),'Drive or walk by (both) still matches both');
  assert.ok(app.includes("const state={filter:'All',features:[]"),'state.features multi-select array');
});

test('dropdown anatomy: aria-expanded, fieldset/legend, staging hooks, live count',()=>{
  assert.ok(chrome.includes('aria-expanded='),'aria-expanded on dropdown buttons');
  assert.ok(chrome.includes('<fieldset class="dd__group"><legend>'),'fieldset/legend for option groups');
  assert.ok(chrome.includes('data-dd-apply'),'Apply/Show N commit hook');
  assert.ok(chrome.includes('data-dd-cancel'),'Cancel hook');
  assert.ok(chrome.includes('data-dd-clear-all'),'mobile Clear all hook');
  assert.ok(chrome.includes('data-dd-clear>Clear</button>'),'Features footer Clear');
  assert.ok(chrome.includes('`Show ${chromePreviewCount(session)} ${noun()}`'),'Show N live result count');
  assert.equal(typeof m.chromePreviewCount,'function','preview-count hook exported');
  assert.ok(chrome.includes("renderFilters=function(){"),'renderFilters override installed');
  assert.ok(chrome.includes("ddHTML('type','Type',chromeEventTypeLabelForValue(session.filter)"),'events branch renders the Type dropdown (spec 7.3)');
  assert.ok(chrome.includes("ddHTML('efeatures','Features'"),'events branch renders the Features dropdown');
  assert.ok(chrome.includes("if(t.name==='chrome-etype'){session.filter=chromeValueForEventTypeLabel(t.value)"),'Type radio commits the canonical value');
  assert.ok(chrome.includes("'Donation drive/Community collection'"),'donation type option present');
  assert.ok(chrome.includes("state.category==='events'&&typeof matchingEvents==='function'?matchingEvents().length"),'live count uses the events pipeline');
  assert.ok(chrome.includes("'Stroller friendly',value:'Stroller friendly'"),'treat feature values canonical');
});

test('mobile: bottom-sheet chrome at the 768 breakpoint with Rubik Dirt title',()=>{
  assert.ok(css.includes('@media(max-width:767px)'),'mobile breakpoint block');
  assert.ok(css.includes('position:fixed;left:0;right:0;bottom:0'),'sheet positioning');
  assert.ok(css.includes('var(--f-display)'),'Rubik Dirt sheet title');
  assert.ok(css.includes('.dd__handle'),'sheet handle');
  assert.ok(css.includes('.dd__clear-all'),'Clear all control');
});

test('segmented toggle: cream selected half, mobile 42x44 icon halves',()=>{
  assert.ok(css.includes('.view-toggle button[aria-pressed="true"]{background:#F6EBD3;color:#0B0910}'),'cream selected half');
  assert.ok(css.includes('.view-toggle button{width:42px;height:44px;padding:0}'),'mobile half size');
  assert.ok(html.includes('aria-label="Map view"')&&html.includes('aria-label="List view"'),'mobile aria labels');
  assert.ok(html.includes('assets/icons/icon-map.svg')&&html.includes('assets/icons/icon-list.svg'),'toggle icons');
  assert.ok(layout.includes("applyViewMode(loadView(localStorage))"),'toggle wiring untouched');
});

test('events chrome and legacy listeners stay delegated, not deleted',()=>{
  assert.ok(layout.includes("state.eventDay='';renderFilters();renderCards();return"),'events reset path intact');
  assert.ok(layout.includes("data-date-filter")&&layout.includes("dateFilterInput"),'legacy date chip hooks kept for events');
  assert.ok(app.includes('data-reset-filters')&&layout.includes('data-reset-filters'),'legacy reset hooks kept in sources');
  assert.ok(app.includes("saveDateFilter({kind:null,date:null},localStorage)"),'reset saves the cleared date filter');
  for(const legacy of ["closest('[data-filter]')","closest('[data-category-filter]')","closest('[data-reset-filters]')","closest('[data-date-filter]')"])
    assert.ok(!chrome.includes(legacy),'chrome never delegates to legacy attributes: '+legacy);
  for(const hook of ["closest('[data-dd-apply]')","closest('[data-dd-cancel]')","closest('[data-dd-clear-all]')","closest('[data-dd-clear]')"])
    assert.ok(chrome.includes(hook),'chrome delegates via '+hook);
});

test('app.js public-data preamble hash is untouched by the chrome edits',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
