const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const routeJs=fs.readFileSync(path.join(ROOT,'route.js'),'utf8');
const routing=require('../routing');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const {suggestRouteOrder,routeLink,parseRouteParam,parseOutingParam,outingLink}=routing;

/* ---- Desktop panel chrome (spec 8.6 D1/D2/D3) ---- */
test('route panel: panel background, 4px orange top border, 24/28 padding',()=>{
  const rule=css.split('\n').find(l=>l.startsWith('.route-wrap{')&&l.includes('border-top:4px solid var(--orange)'));
  assert.ok(rule,'route-wrap restyled with an orange top border');
  assert.ok(rule.includes('background:var(--panel)'),'panel background');
  assert.ok(rule.includes('padding:24px 28px'),'24/28 padding');
  assert.ok(rule.includes('border-radius:8px'),'8px radius');
});

test('route header row: "Your route" 26 condensed uppercase, "N of 10 stops" text-3, link hint right',()=>{
  assert.ok(html.includes('id="routeHeading"'),'heading id preserved for aria-labelledby');
  assert.ok(html.includes('<span class="route-toggle__title" id="routeHeading">Your route</span>'),'title is the in-link header');
  assert.ok(html.includes('class="route-toggle__count" id="routeBadge">0 of 10 stops<'),'count placeholder reads "of 10 stops"');
  assert.ok(html.includes('<span class="route-toggle__hint">Plan your route →</span>'),'hint is the planner link');
  assert.ok(layout.includes("$('routeBadge').textContent=state.route.length+' of 10 stops'"),'badge syncs as "N of 10 stops"');
  const title=css.split('\n').find(l=>l.startsWith('.route-toggle__title{')&&l.includes('font:600 26px'));
  assert.ok(title&&title.includes('26px')&&title.includes('var(--f-cond)')&&title.includes('uppercase'),'26px condensed uppercase title');
  const count=css.split('\n').find(l=>l.startsWith('.route-toggle__count{'));
  assert.ok(count.includes('var(--text-3)'),'count in text-3');
  const hint=css.split('\n').find(l=>l.startsWith('.route-toggle__hint{')&&l.includes('var(--purple)'));
  assert.ok(hint,'link hint in purple');
});

test('starting row (/route.html): summary line with Change; edit block with input, locate button, mode seg',()=>{
  ['route__start-summary','route__start-label','route__start-loc','id="startEditBtn"','>Change</button>','route__start-edit','route__start-row','id="startAddr"','data-locate','>◎</button>','aria-label="Use my current location"','data-mode="current"','data-mode="address"'].forEach(x=>assert.ok(routeJs.includes(x),'planner template lost '+x));
  assert.ok(routeJs.includes('function startLabel()'),'starting summary label helper exists');
  assert.ok(routeJs.includes('${esc(startLabel())}'),'summary renders the resolved label');
});

test('stops (/route.html): numbered timeline, 32px orange circles, 2px line-2 connector, drag + move buttons + Remove',()=>{
  ['route__timeline','<ol class="route__timeline" id="routeStops">','draggable="true"','data-stop-key=','route-stop__num','route-stop__meta','route-stop__remove','route-stop__remove-label','route-stop__remove-x','route-stop__grip','route-stop__icon','assets/icons/${s.icon}.svg','data-move-stop=','data-remove-stop='].forEach(x=>assert.ok(routeJs.includes(x),'timeline template lost '+x));
  const num=css.split('\n').find(l=>l.startsWith('.route-stop__num{'));
  assert.ok(num.includes('width:32px')&&num.includes('height:32px')&&num.includes('border-radius:50%')&&num.includes('background:var(--orange)'),'32px orange circle');
  const connector=css.split('\n').find(l=>l.startsWith('.route-stop::after{'));
  assert.ok(connector.includes('width:2px')&&connector.includes('background:var(--line-2)'),'2px line-2 connector');
  const name=css.split('\n').find(l=>l.startsWith('.route-stop__name{'));
  assert.ok(name.includes('21px'),'stop name 21px');
  const small=css.split('\n').find(l=>l.startsWith('.route-stop__meta small{'));
  assert.ok(small.includes('15px'),'sub-line 15px');
  assert.ok(css.includes('.route-stop.is-dragover'),'drag-over affordance styled');
});

test('footer (/route.html): divider, 52px primary, Get directions, Suggest order + Copy route link',()=>{
  const foot=css.split('\n').find(l=>l.startsWith('.route__foot{'));
  assert.ok(foot.includes('border-top:1px solid var(--line-2)'),'divider above the footer');
  assert.ok(css.includes('.route__directions{min-height:52px}'),'primary button 52px');
  assert.ok(routeJs.includes('id="routeOrderStatus"'),'status line preserved');
  assert.ok(routeJs.includes('Get directions ↗'),'directions label');
  assert.ok(routeJs.includes('Suggest order')&&routeJs.includes('Copy route link'),'text links present');
});

/* ---- Mobile bar + sheet (spec 8.6 M6) ---- */
test('mobile bar: 74px pinned, 2px orange top, "Your route · N stops" and a link to /route.html',()=>{
  assert.ok(html.includes('<strong>Your route</strong><span id="mobileRouteCount" aria-live="polite">0 stops</span>'),'bar copy');
  assert.ok(html.includes('<a class="btn btn--map-route" id="mobileMapRouteBtn" href="route.html">Plan route</a>'),'bar CTA is a link to the planner page');
  const bar=css.split('\n').map(l=>l.trim()).find(l=>l.startsWith('.mobile-route-bar:not(.is-hidden){min-height:74px'));
  assert.ok(bar,'bar restyled to 74px');
  assert.ok(bar.includes('border-top:2px solid var(--orange)'),'2px orange top border');
  assert.ok(bar.includes('position:fixed')||css.includes('.mobile-route-bar:not(.is-hidden){position:fixed'),'bar stays pinned');
});

test('route sheet retired: no sheet markup, styles or opener (page-first step 4)',()=>{
  assert.equal(html.includes('routeSheet'),false,'no sheet markup');
  assert.equal(/\.route-sheet[{ .:>]/.test(css),false,'no sheet styles');
  assert.equal(app.includes('openRouteSheet')||app.includes('showModal'),false,'no sheet opener');
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

test('suggest-order wiring (/route.html): the page uses the pure helper and persists',()=>{
  assert.ok(routeJs.includes("$('optimizeRouteBtn').onclick="),'footer link wired');
  assert.ok(routeJs.includes('commit(lib.suggestRouteOrder(route,data.listings,data.events,origin)'),'handler delegates to the pure function and commits (storage + URL)');
});

test('share outing builds ?route=d10,e2 and the link loads the route; legacy ?outing= untouched',()=>{
  const LIST=[{num:8,entityId:'y'},{num:10,entityId:'x'},{num:9,entityId:'p',placeholder:true}];
  const EVTS=[{id:'2',lat:40.89,lng:-74.75}];
  const stops=[{num:10,entityId:'x'},{eventId:'2'},{num:8,entityId:'y'}];
  const link=routeLink(stops,'https://hauntfinder.vercel.app/');
  assert.equal(link,'https://hauntfinder.vercel.app/?route=d10,e2,d8','route link format');
  assert.deepEqual(parseRouteParam(link.split('?route=')[1],LIST,EVTS),stops,'round-trips to verified entries');
  assert.deepEqual(parseRouteParam('d9,d10,d10,e9,x1,e2',LIST,EVTS),[{num:10,entityId:'x'},{eventId:'2'}],'placeholders, duplicates, unknown events and bad prefixes dropped');
  assert.ok(read('route.js').includes('lib.routeLink(route,location.origin+\'/\'+PAGE)'),'route page shares the ?route= format');
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
  const r=read('routing.js');
  assert.ok(r.includes("travelmode:'driving'"),'driving directions');
  assert.ok(r.includes("p.set('waypoints',wps)"),'stops become waypoints in order');
  assert.ok(r.includes('destination:last.address'),'last stop is the destination');
  assert.ok(r.includes("p.set('origin',String(st.startAddr).trim())")&&r.includes("p.set('origin',st.startCoords.lat+','+st.startCoords.lng)"),'address or geolocated origin');
});

test('cap message is the spec copy on the add path and the directions path',()=>{
  assert.equal((app.match(/Routes can have up to 10 stops\./g)||[]).length,2,'toggleRoute and toggleEventRoute carry the exact copy');
  assert.ok(read('routing.js').includes("{error:'Routes can have up to 10 stops.'}"),'directions guard carries it too');
  assert.equal(app.includes('Google Maps supports up to 10 stops'),false,'old cap copy removed');
});

test('app.js public-data preamble hash is untouched by the route edits',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
