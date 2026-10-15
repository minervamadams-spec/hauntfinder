// Phase H structural tests: mirror the 1A acceptance checklist (spec §13) so a
// regression in the final polish pass fails loudly in CI. Everything here is a
// source-level contract — the suite runs in Node without a browser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const layout=fs.readFileSync(path.join(__dirname,'../layout.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const chrome=fs.readFileSync(path.join(__dirname,'../chrome-filters.js'),'utf8');
const flip=fs.readFileSync(path.join(__dirname,'../card-flip.js'),'utf8');
const photos=fs.readFileSync(path.join(__dirname,'../photos-ui.js'),'utf8');
const urlState=fs.readFileSync(path.join(__dirname,'../url-state.js'),'utf8');
const schedules=fs.readFileSync(path.join(__dirname,'../schedules.js'),'utf8');
// The Phase H tail block, split between its two banner comments.
const phaseH=css.split('Phase H: continuous list')[1];

test('URL filter state module exists, loads after chrome-filters, and only owns its keys',()=>{
 assert.ok(html.includes('src="url-state.js"'),'script tag present');
 assert.ok(html.indexOf('chrome-filters.js')<html.indexOf('url-state.js'),'loaded after chrome-filters.js');
 assert.ok(html.indexOf('url-state.js')<html.indexOf('card-flip.js'),'loaded before card-flip.js');
 assert.match(urlState,/history\.replaceState\(null,'',u\)/,'writes are silent replaceState');
 const owned=urlState.match(/HF_URL_OWNED=\[([^\]]+)\]/)[1];
 ['category','show','features','when','zip','mi','view','day'].forEach(k=>assert.ok(owned.includes("'"+k+"'"),'owned key '+k));
 assert.ok(urlState.includes('HF_URL_OWNED.forEach(k=>u.searchParams.delete(k))'),'writer clears only owned keys before re-writing');
 assert.ok(!/searchParams\.delete\('(?:house|event|route|outing)'\)/.test(urlState),'deep-link params never deleted');
 assert.ok(urlState.includes("u.searchParams.set('category',state.category)"),'category always written');
 assert.ok(urlState.includes("u.searchParams.set('show',state.filter)"),'non-default show written');
 assert.ok(urlState.includes("state.features.join(',')"),'features comma-joined');
 assert.ok(!urlState.includes("u.searchParams.set('view','map')"),'view=map is a one-shot instruction, never written back (no Map/List state)');
 assert.ok(urlState.includes("window.hfApplyView"),'view restore goes through the exposed applyViewMode');
 assert.ok(layout.includes('window.hfApplyView=applyViewMode'),'layout.js exposes applyViewMode');
 assert.ok(urlState.includes("new CustomEvent('hf:expand-radius',{detail:{radius:mi}})"),'mi restore reuses the radius event');
 assert.ok(urlState.includes("/^\\d{5}$/.test(zip)"),'zip param shape-validated');
});

test('url-state when param round-trips through the exported helpers',()=>{
 const m=require('../url-state.js');
 assert.deepEqual(m.hfParseWhen('tonight'),{kind:'tonight',date:null});
 assert.deepEqual(m.hfParseWhen('weekend'),{kind:'weekend',date:null});
 assert.deepEqual(m.hfParseWhen('date:2026-10-31'),{kind:'date',date:'2026-10-31'});
 assert.equal(m.hfParseWhen('date:not-a-date'),null,'garbage date rejected');
 assert.equal(m.hfParseWhen('tonight,weekend'),null,'joined junk rejected');
 assert.equal(m.hfFormatWhen({kind:'tonight',date:null}),'tonight');
 assert.equal(m.hfFormatWhen({kind:'weekend',date:null}),'weekend');
 assert.equal(m.hfFormatWhen({kind:'date',date:'2026-10-31'}),'date:2026-10-31');
 assert.equal(m.hfFormatWhen({kind:'date',date:null}),null,'date kind without a date is not shared');
 assert.equal(m.hfFormatWhen({kind:null,date:null}),null);
 assert.deepEqual(m.HF_URL_RADII,[5,10,25,50]);
});

test('card pages (v7): the pager is retired for a continuous result rail',()=>{
 ['listingPages','previousListings','nextListings','listingPageSummary'].forEach(s=>assert.ok(!html.includes(s),'index.html drops '+s));
 assert.ok(!layout.includes('function pages('),'old pages() stays removed');
 assert.ok(!chrome.includes('state.page'),'chrome-filters.js keeps no page state');
 assert.ok(app.includes('visible.map(cardHTML)'),'all matching cards render in the rail');
 assert.ok(!html.includes('id="pagePrev"'),'previous control is removed');
 assert.ok(!html.includes('id="pageNext"'),'next control is removed');
});

test('counts agree: the active tab badge mirrors the count line (filtered visible, non-placeholder)',()=>{
 assert.ok(layout.includes("event?matchingEvents().length:activeListings().filter(x=>!x.placeholder).length"),'active badge uses the filtered visible pipeline');
 assert.ok(layout.includes("event?'eventCount':treats?'treatStopCount':'displayTabCount'"),'badge overwrite targets the active tab only');
 assert.ok(layout.includes("$('displayTabCount').textContent=String(counts.displays)"),'inactive tabs keep area totals');
 assert.ok(app.includes('nonPlaceholder=visible.filter(x=>!x.placeholder)'),'count line counts non-placeholder cards');
});

test('focus rules: 2px cream ring, no outline:none survivors, all:unset compensated',()=>{
 assert.match(css,/:focus-visible\{outline:2px solid #F6EBD3;outline-offset:2px\}/,'global rule is 2px cream');
 assert.match(phaseH,/:focus-visible\{outline:2px solid #F6EBD3!important;outline-offset:2px!important\}/,'tail block re-asserts over all:unset');
 assert.ok(!/(^|[;\s{])outline:none/.test(css),'no outline:none remains anywhere');
});

test('clickable photo pill meets the 44px target',()=>{
 assert.match(css,/\.card__photo-pill\{[^}]*min-height:44px/,'photo/flyer pill is 44px tall');
});

test('reduced motion: universal guard covers the float button and key toggle too',()=>{
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation-duration:\.01ms!important;animation-iteration-count:1!important;transition-duration:\.01ms!important;scroll-behavior:auto!important\}\}/,'global guard');
 assert.match(css,/\.map-float-btn\{[^}]*transition:[^;}]*\}/,'float button transition exists (now guarded)');
 assert.match(css,/\.map-key__toggle span\{[^}]*transition:[^;}]*\}/,'key toggle transition exists (now guarded)');
});

test('week grid: seven day columns and the Halloween-night tint class',()=>{
 assert.ok(layout.includes('event-col--halloween'),'Halloween column tint class rendered');
 assert.ok(layout.includes("date===weekEnd"),'tint keyed to the week-end day');
 assert.ok(layout.includes("days.slice(i,Math.min(i+3,days.length))"),'3-day window still derived from the 7-day week');
 const fn=schedules.split('function eventWeekDays(')[1].split('\nfunction ')[0];
 assert.ok(fn.includes('days')||fn.includes('push'),'eventWeekDays builds the 7-day window');
 assert.ok(schedules.includes('function eventWeekDays('),'week source exists');
});

test('no chrome element carries a fixed width above 520px (breakpoints exempt)',()=>{
 const hits=css.split('\n').flatMap(line=>[...line.matchAll(/(^|[^-.\w])width:(\d+)px/g)].filter(m=>+m[2]>520&&!line.includes('@media')).map(m=>line.slice(0,80)));
 assert.deepEqual(hits,[],'fixed widths >520px only inside @media breakpoints');
});

test('map pins expose aria-labels alongside their titles',()=>{
 assert.ok(app.includes("m.getElement()?.setAttribute('aria-label',`Event: ${ev.name}`)"),'event route pins labelled');
 assert.ok(app.includes("m.getElement()?.setAttribute('aria-label',`${isTreatStop(x)?'Treat stop':'Display'} ${x.num}: ${x.name}`)"),'listing pins labelled');
});

test('card flips sync aria-pressed on every flip trigger',()=>{
 assert.ok(flip.includes("card.querySelectorAll('[data-flip-open]').forEach(b=>b.setAttribute('aria-pressed',String(flipped)))"),'toggle syncs aria-pressed');
 assert.ok(flip.includes("nameBtn.setAttribute('aria-pressed','false')"),'listing name button starts unpressed');
 assert.ok(flip.includes("pill.setAttribute('aria-pressed','false')"),'listing pill starts unpressed');
 assert.ok(layout.includes('class="card__namebtn" data-flip-open="${safeListingText(x.id)}" aria-pressed="false"'),'event name button starts unpressed');
 assert.ok(layout.includes('class="card__photo-pill" data-flip-open="${safeListingText(x.id)}" aria-pressed="false"'),'event flyer pill starts unpressed');
});

test('Escape closes a dropdown and hands focus back to its summary',()=>{
 assert.ok(chrome.includes('if(open){const summary=open.querySelector(\'summary\');open.open=false;if(summary)summary.focus()}'),'focus return on Esc');
});

test('photos decode off the main thread',()=>{
 assert.ok(flip.includes("img.decoding='async'"),'flip photo async-decoded');
 assert.ok(photos.includes("img.decoding='async'"),'peek photo async-decoded');
 assert.ok(flip.includes("img.loading='lazy'")&&photos.includes("img.loading='lazy'"),'lazy loading kept');
});

test('list column never scrolls internally (single-scroll layout)',()=>{
 assert.ok(!phaseH.includes('.list-column{position:sticky!important'),'Phase H internal scroll rule removed');
 assert.match(css,/@media\(max-width:1023px\)\{[^}]*\.list-column\{max-height:none;height:auto;overflow:visible\}/,'mobile keeps natural document flow');
});
