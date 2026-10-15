// Regression: category tabs must switch visible content AND state, from every
// entry path (click, keyboard, direct URL). Fails if a tab can be visually
// active while content/state disagree.
//
// Root cause of the 2026-10-14 production incident (owner report via Codex):
// layout.js declared `const root=document.documentElement` AFTER the IIFE's
// first render calls — but URL-driven init (selectTab from ?category=events /
// ?event= / ?outing= / ?route=) reaches sync()'s events branch, which reads
// `root`. The TDZ throw killed the rest of init AND left `root` uninitialized
// for the whole page lifetime, so every later Events tab click threw and the
// tab appeared dead. Displays/Treats still worked — "unreliable" switching.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

// The first top-level statement that can render or select a category during
// IIFE init: `renderFilters();renderCards();` (initial paint) and the
// `selectTab(params.get('category'))` deep-link restore below it.
const firstRenderCall=Math.min(
  layout.indexOf('renderFilters();renderCards();'),
  layout.indexOf("selectTab(params.get('category'))")
);
const rootDecl=layout.indexOf('const root=document.documentElement');

test('TDZ guard: root is declared before any init render/selectTab call can run',()=>{
  assert.ok(firstRenderCall>0,'init render call found');
  assert.ok(rootDecl>0,'root declaration found');
  assert.ok(rootDecl<firstRenderCall,'`const root` precedes the first render path — sync() reads root on the events branch, and a later declaration threw on every events deep-link load, killing all later Events tab clicks');
});

test('tab wiring: all three tabs get click and keyboard handlers',()=>{
  assert.match(layout,/tabs\.forEach\(\(\[id,name\],i\)=>\{\$\(id\)\.onclick=\(\)=>selectTab\(name\)/,'click switches category through selectTab');
  assert.match(layout,/\$\(id\)\.onkeydown=e=>\{if\(\['ArrowLeft','ArrowRight','Home','End'\]\.includes\(e\.key\)\)/,'arrow/Home/End keys switch tabs');
  assert.match(layout,/selectTab\(tabs\[next\]\[1\],true\)/,'keyboard switch also moves focus');
  assert.match(layout,/aria-selected',String\(name===category\)\)/,'active tab state is exposed');
  assert.match(layout,/tabIndex=name===category\?0:-1/,'roving tabindex follows the active tab');
});

test('content/state agreement: every category branch ends in sync()',()=>{
  const body=layout.split('renderCards=function(){if(state.category')[1].split('renderRoute=function')[0];
  assert.ok(body.includes('sync();return'),'events branch syncs chrome (badges, count, calendar visibility)');
  assert.ok(body.includes('originalCards();sync()'),'displays/treats branch syncs after the base render');
  assert.match(layout,/document\.documentElement\.dataset\.category=state\.category/,'data-category mirrors state for CSS scoping');
  assert.match(layout,/\$\('eventsColumnHead'\)\.hidden=!event/,'events column heading toggles with the tab');
  assert.match(layout,/\$\('eventCalendar'\)\.hidden=!event/,'calendar visibility toggles with the tab');
});

test('markup: three tabs with stable ids, roles, and badges',()=>{
  for(const id of ['displaysTab','treatStopsTab','eventsTab']){
    assert.ok(html.includes(`id="${id}"`),id+' present');
    assert.ok(html.includes(`id="${id}" role="tab"`)||html.includes(`role="tab" id="${id}"`),id+' is a tab');
  }
  assert.match(html,/id="displayTabCount"/,'displays badge');
  assert.match(html,/id="treatStopCount"/,'treat stops badge');
  assert.match(html,/id="eventCount"/,'events badge');
});

test('deep-link restore: category param reaches selectTab for all three values',()=>{
  assert.match(layout,/\['events','treats','displays'\]\.includes\(params\.get\('category'\)\)\)selectTab\(params\.get\('category'\)\)/,'?category=events|treats|displays restores through the same selectTab as clicks');
});
