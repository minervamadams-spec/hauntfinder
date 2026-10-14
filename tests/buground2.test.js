// Live-bug round 2 (owner report 2026-10-14, evidence 17_39_12/17_39_44.png):
// A — count line / card list / map pins must derive from ONE shared visible
//     computation per state change, including late-arriving search data.
// B — alerts popup is a centered 540px modal at >=1024 (not an in-flow bar at
//     the page end) and its iframe actually loads (no lazy-load trap).
// C — every .site-dialog instance renders the spec scrim rgba(5,4,8,.6).
// D — breakpoint pairs: anything set inside a max-width block is reset by the
//     complementary rule when the window crosses back.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const layout=fs.readFileSync(path.join(__dirname,'../layout.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const alertsCss=fs.readFileSync(path.join(__dirname,'../alerts.css'),'utf8');
const location=fs.readFileSync(path.join(__dirname,'../location.js'),'utf8');

// ---- Bug A: one shared computation for count line, cards, and pins ----
test('Bug A: renderCards feeds the count line, card list, and marker sync from the same visible set',()=>{
 const body=app.split('function renderCards(){')[1].split('\nfunction ')[0];
 const visibleAt=body.indexOf('const visible=activeListings()');
 const countAt=body.indexOf('countLine').textContent===undefined?body.indexOf("getElementById('countLine')"):body.indexOf('countLine');
 const cardsAt=body.indexOf("cardList').innerHTML=visible.map(cardHTML)");
 const markersAt=body.indexOf('syncListingMarkers(visible)');
 assert.ok(visibleAt===0,'visible is the first thing computed');
 assert.ok(visibleAt<countAt&&countAt<cardsAt,'count line derives from visible');
 assert.ok(cardsAt<markersAt,'marker sync runs on the same visible, in the same call');
 assert.ok(app.includes('function syncListingMarkers(visible)'),'marker sync function exists');
 assert.ok(app.includes('const keep=new Set(visible.filter(x=>!x.placeholder&&Number.isFinite(x.lat)&&Number.isFinite(x.lng))'),'pins mirror the visible non-placeholder set');
 assert.ok(app.includes('if(keep.has(n)){if(!on)m.addTo(map)}else if(on)map.removeLayer(m)'),'pins are both added AND removed (two-way sync)');
 assert.ok(app.includes("document.addEventListener('hf:search-changed',e=>{state.search=e.detail;renderCards()"),'late-arriving search data re-runs the shared render');
});

test('Bug A: the one-way marker MutationObserver is gone; layout never deletes pins behind renderCards back',()=>{
 assert.ok(!layout.includes('new MutationObserver(()=>markerByNum'),'one-way pin removal observer removed');
 assert.ok(!/markerByNum\.forEach\(\(m,n\)=>\{[^}]*removeLayer/.test(layout),'layout.js has no direct removeLayer-by-filter loop');
 assert.ok(layout.includes('markerByNum.forEach(m=>map.removeLayer(m))'),'events branch still clears listing pins while viewing events');
});

test('Bug A: late-arriving centroid data changes the visible set through the shared pipeline (pure simulation)',()=>{
 const loc=require('../location.js');
 const listings=[
  {num:1,lat:40.90,lng:-74.76,placeholder:false},
  {num:2,lat:41.20,lng:-74.10,placeholder:false},
  {num:3,lat:40.88,lng:-74.75,placeholder:false},
 ];
 // Before location data: no search → everything is visible (initial render).
 const before=loc.visibleSet({items:listings,search:null,predicate:x=>!x.placeholder,keepUnlocated:true});
 assert.equal(before.length,3,'pre-data render shows all listings');
 // Centroid arrives for ZIP 07828: the same call now narrows to the radius.
 const search={mode:'zip',zip:'07828',lat:40.884959,lng:-74.755657,radius:25};
 const after=loc.visibleSet({items:listings,search,predicate:x=>!x.placeholder,keepUnlocated:true});
 assert.equal(after.length,2,'post-data render narrows to the 25 mi area');
 assert.ok(after.every(x=>loc.inSearchArea(x,search)),'every surviving item is inside the search area');
 assert.equal(after[0].num,3,'nearest-first ordering from the shared computation');
});

// ---- Bug B: alerts dialog is a centered modal, iframe loads eagerly ----
test('Bug B: dialogs carry explicit centered-modal positioning that no UA quirk can drop',()=>{
 assert.match(css,/\.site-dialog\{position:fixed;inset:0;margin:auto;width:min\(680px,calc\(100% - 28px\)\)/,'base .site-dialog is explicitly fixed+centered');
 assert.match(css,/@media\(max-width:1023px\)\{\.site-dialog\{position:fixed;inset:auto 0 0 0;margin:0;width:100%;max-width:none;border-radius:16px 16px 0 0;max-height:88dvh\}\}/,'mobile bottom sheet paired with explicit margin reset');
 assert.match(alertsCss,/\.alerts-dialog\{width:min\(540px,calc\(100vw - 24px\)\)/,'alerts dialog keeps the 540px modal width');
});

test('Bug B: alerts iframe is not lazy-loaded (blank-iframe fix)',()=>{
 const dlg=html.split('id="alertsDialog"')[1].split('</dialog>')[0];
 assert.ok(dlg.includes('<iframe'),'iframe present');
 assert.ok(!dlg.includes('loading="lazy"'),'lazy loading removed — src is set on first open and must load immediately');
});

// ---- Bug C: spec scrim for every .site-dialog instance ----
test('Bug C: all dialogs share the rgba(5,4,8,.6) backdrop; nothing overrides it transparent',()=>{
 assert.match(css,/\.site-dialog::backdrop\{background:rgba\(5,4,8,\.6\)\}/,'shared scrim rule');
 assert.match(alertsCss,/\.alerts-dialog::backdrop\{background:rgba\(5,4,8,\.6\)\}/,'alerts uses the same scrim value');
 assert.ok(!/::backdrop\{[^}]*transparent/.test(css+alertsCss),'no transparent backdrop override anywhere');
 const dialogs=[...html.matchAll(/<dialog class="([^"]*)"/g)].map(m=>m[1]);
 assert.ok(dialogs.length>=5,'dialogs found');
 dialogs.forEach(c=>assert.ok(c.includes('site-dialog')||c.includes('route-sheet'),'every dialog uses the shared skin ('+c+')'));
});

// ---- Bug D: paired set/reset across every breakpoint boundary ----
test('Bug D: events anatomy is paired at every breakpoint — single column 960–1199, D1 two-column >=1200, and the Phase H sticky scroll stays out of events',()=>{
 const band=css.split('@media(min-width:960px) and (max-width:1199px)')[1].split('@media(min-width:1200px)')[0];
 assert.ok(band.includes('html[data-category="events"] .page-grid{grid-template-columns:minmax(0,1fr)}'),'960–1199 single column');
 assert.ok(band.includes('html[data-category="events"] .list-column{display:block;grid-column:1;grid-row:auto;position:static;height:auto;max-height:none;overflow:visible;width:100%}'),'960–1199 cards stack below the week with explicit static/flow reset');
 const large=css.split('html[data-category="events"] .page-grid{grid-template-columns:minmax(0,1fr) 440px}')[1];
 assert.ok(large.includes('html[data-category="events"] .map-column{grid-column:1;grid-row:1}'),'>=1200 week takes the wide left column');
 assert.ok(large.includes('html[data-category="events"] .list-column{grid-column:2;grid-row:1/span 2}'),'>=1200 event cards take the 440px right column');
 assert.match(css,/html:not\(\[data-category="events"\]\) \.list-column\{position:sticky!important;top:16px;align-self:start;height:calc\(100dvh - 32px\)!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain\}/,'Phase H sticky scroll scoped to non-events so the events cards column never gets height-clipped');
});

test('Bug D: >=1200 internal list scroll excludes the events category',()=>{
 assert.match(css,/html:not\(\[data-category="events"\]\) \.list-column\{position:sticky!important;top:16px;align-self:start;height:calc\(100dvh - 32px\)!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain\}/,'sticky scroll scoped to non-events');
});

test('Bug D: pinned mobile route bar cannot survive into the desktop band',()=>{
 assert.match(css,/\.mobile-route-bar\{display:none!important\}/,'desktop force-hide rule exists');
 const desk=css.split('@media(min-width:1024px){').slice(1).join('');
 assert.ok(desk.includes('.mobile-route-bar{display:none!important}'),'force-hide lives inside the >=1024 block');
 assert.ok(css.includes('body:has(.mobile-route-bar:not(.is-hidden)){padding-bottom:100px}'),'mobile body padding pairs with the bar');
 assert.ok(css.includes('.mobile-route-bar:not(.is-hidden){position:fixed;display:flex;'),'base rule shows the bar only when it has route stops (.is-hidden toggled by JS)');
});

test('Bug D: map popup peek has no stale translateX(-50%) residue from the retired centered variant',()=>{
 const peekRules=[...css.matchAll(/\.map-peek\{[^}]*\}/g)].map(m=>m[0]);
 assert.ok(peekRules.length>=1,'peek rule exists');
 peekRules.forEach(r=>assert.ok(!r.includes('transform'),'no transform residue on .map-peek: '+r));
});

test('Bug D: view toggle and full-map float button are desktop-safe pairs',()=>{
 assert.match(css,/\.view-toggle\{display:none\}/,'view toggle hidden by default');
 assert.match(css,/@media\(max-width:1023px\)\{[^}]*\.view-toggle\{display:flex;/,'view toggle only appears below 1024');
 assert.match(css,/@media\(min-width:1024px\)\{[^}]*\.map-float-btn--full\{display:none\}/,'full-map button hidden at desktop');
});

test('Bug D: data-view and data-fullmap states restore automatically (attribute-scoped rules only)',()=>{
 ['html[data-view="map"] .page-grid>.list-column{display:none}','html[data-view="list"] .map-key,html[data-view="list"] .map-note{display:none}','html[data-fullmap] .map-key,html[data-fullmap] .map-note{display:none}','html:not([data-fullmap]) .map-full-head{display:none!important}'].forEach(s=>assert.ok(css.includes(s),'attribute-scoped (self-restoring) rule: '+s.slice(0,70)));
});
