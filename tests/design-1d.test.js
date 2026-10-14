const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const routing=require('../routing');
const {suggestRouteOrder,routeLink,parseRouteParam,parseOutingParam,outingLink}=routing;

/* ---- Desktop panel chrome (spec 8.6 D1/D2/D3) ---- */
test('route panel: panel background, 4px orange top border, 24/28 padding',()=>{
  const rule=css.split('\n').find(l=>l.startsWith('.route-wrap{')&&l.includes('border-top:4px solid var(--orange)'));
  assert.ok(rule,'route-wrap restyled with an orange top border');
  assert.ok(rule.includes('background:var(--panel)'),'panel background');
  assert.ok(rule.includes('padding:24px 28px'),'24/28 padding');
  assert.ok(rule.includes('border-radius:8px'),'8px radius');
});

test('route header row: "Your route" 26 condensed uppercase, "N of 10 stops" text-3, Hide right',()=>{
  assert.ok(html.includes('id="routeHeading"'),'heading id preserved for aria-labelledby');
  assert.ok(html.includes('<span class="route-toggle__title" id="routeHeading">Your route</span>'),'title is the in-toggle header');
  assert.ok(html.includes('class="route-toggle__count" id="routeBadge">0 of 10 stops<'),'count placeholder reads "of 10 stops"');
  assert.ok(html.includes('class="route-toggle__hint" id="routeToggleHint">Expand ▴<'),'hint starts at Expand');
  assert.ok(layout.includes("$('routeBadge').textContent=state.route.length+' of 10 stops'"),'badge syncs as "N of 10 stops"');
  assert.ok(app.includes("hint.textContent=open?'Hide ▾':'Expand ▴'"),'hint swaps Hide/Expand with arrows');
  const title=css.split('\n').find(l=>l.startsWith('.route-toggle__title{')&&l.includes('font:600 26px'));
  assert.ok(title&&title.includes('26px')&&title.includes('var(--f-cond)')&&title.includes('uppercase'),'26px condensed uppercase title');
  const count=css.split('\n').find(l=>l.startsWith('.route-toggle__count{'));
  assert.ok(count.includes('var(--text-3)'),'count in text-3');
  const hint=css.split('\n').find(l=>l.startsWith('.route-toggle__hint{')&&l.includes('var(--purple)'));
  assert.ok(hint,'Hide/Expand in purple');
});

test('starting row: summary line with Change link; edit block with input, locate button, mode seg',()=>{
  ['route__start-summary','route__start-label','route__start-loc','data-start-edit','>Change</button>','route__start-edit','route__start-row','id="startAddr"','data-locate','>◎</button>','aria-label="Use my current location"','data-mode="current"','data-mode="address"'].forEach(s=>assert.ok(app.includes(s),'planner template lost '+s));
  assert.ok(app.includes('function routeStartLabel()'),'starting summary label helper exists');
  assert.ok(app.includes('routeStartLabel())}'),'summary renders the resolved label');
});

test('stops: numbered timeline, 32px orange circles, 2px line-2 connector, drag + move buttons + Remove',()=>{
  ['route__timeline','<ol class="route__timeline">','draggable="true"','data-stop-key=','route-stop__num','route-stop__meta','route-stop__remove','route-stop__remove-label','route-stop__remove-x','route-stop__grip','route-stop__icon',"assets/icons/${s.isEvent?'pin-event':'pin-display'}.svg"].forEach(s=>assert.ok(app.includes(s),'timeline template lost '+s));
  const num=css.split('\n').find(l=>l.startsWith('.route-stop__num{'));
  assert.ok(num.includes('width:32px')&&num.includes('height:32px')&&num.includes('border-radius:50%')&&num.includes('background:var(--orange)'),'32px orange circle');
  const connector=css.split('\n').find(l=>l.startsWith('.route-stop::after{'));
  assert.ok(connector.includes('width:2px')&&connector.includes('background:var(--line-2)'),'2px line-2 connector');
  const name=css.split('\n').find(l=>l.startsWith('.route-stop__meta strong{'));
  assert.ok(name.includes('21px'),'stop name 21px');
  const small=css.split('\n').find(l=>l.startsWith('.route-stop__meta small{'));
  assert.ok(small.includes('15px'),'sub-line 15px');
  assert.ok(css.includes('.route-stop.is-dragover'),'drag-over affordance styled');
  assert.ok(css.includes('.route-sheet .route-stop__grip{display:block}')&&css.includes('.route-sheet .route-stop__icon{display:block}'),'grip + pin icons in the sheet');
  assert.ok(css.includes('.route-sheet .route-stop__num{display:none}'),'number circles rest for the sheet');
});

test('footer: divider, 52px primary, panel/sheet direction labels, Suggest order + Share outing + Displays nearby',()=>{
  const foot=css.split('\n').find(l=>l.startsWith('.route__foot{'));
  assert.ok(foot.includes('border-top:1px solid var(--line-2)'),'divider above the footer');
  assert.ok(css.includes('.route__directions{min-height:52px}'),'primary button 52px');
  assert.ok(app.includes('id="routeOrderStatus"'),'status line preserved');
  assert.ok(app.includes('Get directions ↗')&&app.includes('Directions for this route ↗'),'both direction labels present');
  assert.ok(css.includes('.route-sheet .route__dir-panel{display:none}')&&css.includes('.route-sheet .route__dir-sheet{display:inline}'),'sheet shows the full-width label');
  assert.ok(app.includes('Suggest order')&&app.includes('Share outing'),'text links present');
  assert.ok(app.includes('data-nearby-displays>Displays nearby →</button>'),'Displays nearby link on events');
  assert.ok(app.includes("state.category==='events'"),' Displays nearby only renders on the events tab');
  assert.ok(app.includes("document.getElementById('displaysTab');if(tab)tab.click()"),'Displays nearby switches tabs through the existing tab control');
  assert.ok(css.includes('.route-sheet .route__links{order:1;display:grid;grid-template-columns:1fr 1fr'),'sheet outline pair is half-width');
  assert.ok(css.includes('.route-sheet .route__directions{order:2;width:100%}'),'sheet directions full-width');
  assert.ok(css.includes('.route-sheet .route__links .route__linkbtn{min-height:52px;padding:0 10px;border:2px solid var(--cream)'),'sheet links are outline buttons');
});

/* ---- Mobile bar + sheet (spec 8.6 M6) ---- */
test('mobile bar: 74px pinned, 2px orange top, "Your route · N stops" and Open',()=>{
  assert.ok(html.includes('<strong>Your route</strong><span id="mobileRouteCount" aria-live="polite">0 stops</span>'),'bar copy');
  assert.ok(html.includes('id="mobileMapRouteBtn" disabled>Open ▴</button>'),'bar button reads Open');
  const bar=css.split('\n').map(l=>l.trim()).find(l=>l.startsWith('.mobile-route-bar:not(.is-hidden){min-height:74px'));
  assert.ok(bar,'bar restyled to 74px');
  assert.ok(bar.includes('border-top:2px solid var(--orange)'),'2px orange top border');
  assert.ok(bar.includes('position:fixed')||css.includes('.mobile-route-bar:not(.is-hidden){position:fixed'),'bar stays pinned');
});

test('route sheet: orange top border, 16px top corners, YOUR ROUTE heading with count, editable starting row',()=>{
  assert.ok(html.includes('class="route-sheet" id="routeSheet" aria-labelledby="routeSheetHeading"'),'sheet labelled and classed');
  assert.ok(html.includes('<h2 id="routeSheetHeading" class="route-sheet__title">Your route <span class="route-sheet__count" id="routeSheetBadge">0</span></h2>'),'sheet heading with count span');
  const sheet=css.split('\n').find(l=>l.startsWith('.route-sheet{border-top:4px solid var(--orange)'));
  assert.ok(sheet,'sheet top border orange');
  assert.ok(sheet.includes('border-radius:16px 16px 0 0'),'16px top corners');
  const title=css.split('\n').find(l=>l.startsWith('.route-sheet__title{'));
  assert.ok(title.includes('26px')&&title.includes('uppercase'),'sheet title styling');
  assert.ok(css.includes('.route-sheet .route__start-summary{display:none}'),'sheet skips the summary row and stays editable');
  assert.ok(css.includes('.route-sheet .seg,.route-sheet .current-note{display:none}'),'sheet shows the input row only');
  assert.ok(app.includes("if(sheetBadge)sheetBadge.textContent=`${state.route.length} stop${state.route.length===1?'':'s'}`"),'sheet count badge syncs');
  assert.ok(app.includes('Up to 10 stops. Drag to reorder.'),'sheet helper copy');
});

/* ---- Behavior (spec 9.5) ---- */
test('suggest order: nearest-first from the origin, events keep time order, stable merge',()=>{
  const LIST=[{num:1,entityId:'a',lat:40.90,lng:-74.76},{num:2,entityId:'b',lat:40.88,lng:-74.75},{num:3,entityId:'c',lat:40.87,lng:-74.74}];
  const EVTS=[{id:'e2',startAt:'2026-10-29T17:30:00',lat:40.89,lng:-74.755},{id:'e1',startAt:'2026-10-28T18:00:00',lat:40.885,lng:-74.745}];
  const origin={lat:40.885,lng:-74.755};
  const route=[{num:3,entityId:'c'},{eventId:'e2'},{num:1,entityId:'a'},{num:2,entityId:'b'},{eventId:'e1'}];
  const suggested=suggestRouteOrder(route,LIST,EVTS,origin);
  assert.deepEqual(suggested,[{num:2,entityId:'b'},{eventId:'e1'},{num:1,entityId:'a'},{num:3,entityId:'c'},{eventId:'e2'}],'non-events nearest-first, events time-ordered, interleave preserved');
  assert.deepEqual(route,[{num:3,entityId:'c'},{eventId:'e2'},{num:1,entityId:'a'},{num:2,entityId:'b'},{eventId:'e1'}],'input route not mutated');
});

test('suggest order: no origin keeps listing order and still time-sorts events; ties are stable',()=>{
  const LIST=[{num:1,entityId:'a',lat:40.9,lng:-74.7},{num:2,entityId:'b',lat:41.0,lng:-74.8}];
  const EVTS=[{id:'late',startAt:'2026-10-30T18:00:00'},{id:'early',startAt:'2026-10-28T18:00:00'}];
  const route=[{num:1,entityId:'a'},{eventId:'late'},{num:2,entityId:'b'},{eventId:'early'}];
  assert.deepEqual(suggestRouteOrder(route,LIST,EVTS,null),[{num:1,entityId:'a'},{eventId:'early'},{num:2,entityId:'b'},{eventId:'late'}],'events time-ordered even without an origin');
  const tiesList=[{num:1,entityId:'a',lat:41.0,lng:-74.8},{num:2,entityId:'b',lat:41.0,lng:-74.8}];
  const ties=[{num:1,entityId:'a'},{num:2,entityId:'b'}];
  assert.deepEqual(suggestRouteOrder(ties,tiesList,EVTS,{lat:42,lng:-75}).map(s=>s.num),[1,2],'equal distances keep input order');
  assert.deepEqual(suggestRouteOrder([],LIST,EVTS,origin0()),[],'empty route stays empty');
  function origin0(){return{lat:0,lng:0}}
});

test('suggest-order wiring: app handler uses the pure helper and persists',()=>{
  assert.ok(app.includes('function suggestOrder(){'),'app handler exists');
  assert.ok(app.includes('state.route=suggestRouteOrder(state.route,listings,events,origin)'),'handler delegates to the pure function');
  assert.ok(app.includes('state.startCoords||'),'geolocated start wins as the origin');
  assert.ok(app.includes("planner.querySelector('#optimizeRouteBtn').onclick=suggestOrder"),'footer link wired');
});

test('share outing builds ?route=d10,e2 and the link loads the route; legacy ?outing= untouched',()=>{
  const LIST=[{num:8,entityId:'y'},{num:10,entityId:'x'},{num:9,entityId:'p',placeholder:true}];
  const EVTS=[{id:'2',lat:40.89,lng:-74.75}];
  const stops=[{num:10,entityId:'x'},{eventId:'2'},{num:8,entityId:'y'}];
  const link=routeLink(stops,'https://hauntfinder.vercel.app/');
  assert.equal(link,'https://hauntfinder.vercel.app/?route=d10,e2,d8','route link format');
  assert.deepEqual(parseRouteParam(link.split('?route=')[1],LIST,EVTS),stops,'round-trips to verified entries');
  assert.deepEqual(parseRouteParam('d9,d10,d10,e9,x1,e2',LIST,EVTS),[{num:10,entityId:'x'},{eventId:'2'}],'placeholders, duplicates, unknown events and bad prefixes dropped');
  assert.ok(app.includes('routeLink(state.route)'),'shareOuting uses the new format');
  // legacy outing format still parses byte-for-byte
  const old=outingLink([{num:1,entityId:'a'}],'https://hauntfinder.vercel.app/');
  assert.ok(old.includes('?outing='),'legacy link builder intact');
  assert.deepEqual(parseOutingParam(old.split('?outing=')[1],[{num:1,entityId:'a'}]),[{num:1,entityId:'a'}],'legacy parser intact');
});

test('deep link: ?route= loads like ?outing=, which stays byte-identical',()=>{
  assert.ok(layout.includes("const routeParam=params.get('route');"),'route param branch');
  assert.ok(layout.includes('parseRouteParam(routeParam,listings,events)'),'route param verified against listings + events');
  assert.ok(layout.includes("state.routeMessage='Shared route loaded.'"),'route load message');
  assert.ok(layout.includes("params.get('outing')")&&layout.includes('parseOutingParam(outingParam,listings,events)'),'legacy outing branch intact');
  assert.ok(layout.includes("localStorage.setItem('hfroute:2026',JSON.stringify(state.route))"),'shared routes persist under the existing key');
  assert.ok(app.includes("localStorage.setItem('hfroute:2026',JSON.stringify(state.route))"),'app still persists under hfroute:2026');
});

test('directions handoff keeps origin + ordered waypoints + destination',()=>{
  assert.ok(app.includes("travelmode:'driving'"),'driving directions');
  assert.ok(app.includes("p.set('waypoints',wps)"),'stops become waypoints in order');
  assert.ok(app.includes('destination:last.address'),'last stop is the destination');
  assert.ok(app.includes("p.set('origin',state.startAddr.trim())")&&app.includes("p.set('origin',state.startCoords.lat+','+state.startCoords.lng)"),'address or geolocated origin');
});

test('cap message is the spec copy on the add path and the directions path',()=>{
  const count=(app.match(/Routes can have up to 10 stops\./g)||[]).length;
  assert.equal(count,3,'toggleRoute, toggleEventRoute and buildRoute all carry the exact copy');
  assert.equal(app.includes('Google Maps supports up to 10 stops'),false,'old cap copy removed');
});

test('app.js public-data preamble hash is untouched by the route edits',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
