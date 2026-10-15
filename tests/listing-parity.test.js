// /listing.html parity with the homepage cards: category + type, a map preview
// on the verified pin with a working "See on the map" link, "Add to route" on
// the shared hfroute:2026 route, and one shared hours formatter.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const app=read('app.js'),layout=read('layout.js'),indexHtml=read('index.html'),html=read('listing.html'),listingJs=read('listing.js'),css=read('styles.css');
const L=require('../listing.js'),F=require('../listing-format.js'),R=require('../routing.js'),S=require('../schedules.js');
const {listings,events}=L.loadListingData(app);
const real=n=>listings.find(x=>x.num===n);
const active=listings.filter(x=>!x.placeholder);

// ---- 4. Shared hours formatting ----
test('hours: one shared formatter, compact like the cards (#12 reads 6–10 PM)',()=>{
  assert.equal(F.compactTime('6:00 PM–10:00 PM'),'6–10 PM');
  assert.equal(F.compactTime('Fri–Sun 6:00 PM–12:00 AM · Mon–Thu 6:00 PM–11:00 PM'),'Fri–Sun 6 PM–12 AM · Mon–Thu 6–11 PM');
  assert.equal(F.listingHoursText(real(12)),'Weekends in October and Halloween · 6–10 PM');
  assert.equal(F.listingHoursText(real(11)),'October 31, 2026 · 2–10 PM');
});
test('hours: formatter reproduces the previous card text for every real listing, fallbacks included',()=>{
  const oldCard=x=>{const t=[x.dates,F.compactTime(x.times)].filter(Boolean).join(' · ');if(t)return t;return S.hasScheduleInfo(x)?(x.kind==='Trick-or-treat stop'?'Candy hours not specified':'Dates and hours not specified'):'Hours unknown'};
  for(const x of active)assert.equal(F.listingHoursText(x),oldCard(x),'#'+x.num);
  assert.equal(F.listingHoursText({dates:'',times:'',schedule:{weekly:[{dow:5}]}}),'Dates and hours not specified');
  assert.equal(F.listingHoursText({kind:'Trick-or-treat stop',dates:'',times:'',schedule:{startDate:'2026-10-31'}}),'Candy hours not specified');
  assert.equal(F.listingHoursText({dates:'',times:''}),'Hours unknown');
});
test('hours: cards and the listing page both call the shared formatter; no private copies remain',()=>{
  assert.equal((app.match(/safeListingText\(listingHoursText\(x\)\)/g)||[]).length,2,'display + treat cards');
  assert.equal(app.includes('function compactTime'),false,'compactTime lives only in listing-format.js');
  assert.equal(app.includes("x.dates,compactTime(x.times)"),false);
  assert.match(listingJs,/listingHoursText\(house\)/);
  assert.equal(/\$\('listing(Meta|Hours)'\)[^\n]*house\.times/.test(listingJs),false,'detail hours never use the raw unformatted times');
  assert.match(listingJs,/\$\('listingHours'\)\.textContent=fmt\.listingHoursText\(house\)/);
});
test('hours: listing-format.js loads before app.js on the homepage and before listing.js on the listing page',()=>{
  const i=s=>indexHtml.indexOf(s);
  assert.ok(i('<script src="listing-format.js"></script>')>-1&&i('<script src="listing-format.js"></script>')<i('<script src="app.js"></script>'));
  const h=s=>html.indexOf(s);
  for(const dep of ['schedules.js','listing-format.js','routing.js'])assert.ok(h(`<script src="${dep}"></script>`)>-1&&h(`<script src="${dep}"></script>`)<h('<script src="listing.js"></script>'),dep);
});

// ---- 1. Category and type ----
test('category and type: same category the homepage tabs use, same type chips as the cards',()=>{
  assert.deepEqual(L.kindSummary(real(12)),{category:'Display',types:['Drive-by','Walk-up','Walk-through']});
  assert.deepEqual(L.kindSummary(real(11)),{category:'Treat stop',types:[]});
  assert.deepEqual(L.kindSummary(real(2)),{category:'Display',types:[]});
  for(const x of active)assert.equal(F.listingCategory(x)==='Treat stop',x.kind==='Trick-or-treat stop','#'+x.num);
  assert.match(html,/id="listingCategory"/);assert.match(html,/id="listingTypes"/);
  assert.match(listingJs,/chip chip--type/,'type chips reuse the card chip style');
});

// ---- 2. Map preview + See on the map ----
test('map: preview uses the stored verified pin and the link opens the homepage map on that house',()=>{
  const t=L.mapTarget(real(12));
  assert.deepEqual(t,{lat:40.7598742,lng:-74.9764089,kind:'display',href:'/?house=12&view=map'});
  assert.equal(L.mapTarget(real(11)).kind,'treat');
  assert.equal(L.mapTarget(real(8)).href,'/?house=8&entity=drakestown-road-2026&view=map','reused slot keeps its entity gate');
  assert.equal(L.mapTarget({...real(12),geoVerified:''}),null,'no verified pin, no preview');
  assert.equal(L.mapTarget({...real(12),lat:null}),null,'no coordinates, no preview');
  assert.equal(L.mapLink(real(12)),'/?house=12&view=map','link works even without a preview');
});
test('map: listing page loads the same Leaflet build and draws the preview; See on the map uses the map link',()=>{
  const leaflet=indexHtml.match(/https:\/\/unpkg\.com\/leaflet@[\d.]+\/dist\/leaflet\.js/)[0];
  assert.ok(html.includes(`<script src="${leaflet}" crossorigin=""></script>`));
  assert.ok(html.includes(`href="${leaflet.replace('.js','.css')}"`));
  assert.match(html,/id="listingMap"/);assert.match(html,/id="listingOnMap"/);assert.match(html,/id="listingMapLink"/);
  assert.match(listingJs,/\$\('listingOnMap'\)\.href=mapLink\(house\)/);
  assert.match(css,/\.listing-map__canvas\{/);
});
test('map: homepage deep link centers the linked house, including on the first switch to map view',()=>{
  assert.match(layout,/if\(params\.get\('view'\)==='map'\)\{state\.linkedHouse=house\.num;focusLinkedHouse\(\)\}/,'only the map-view link from the listing page re-centers; plain ?house= share links are unchanged');
  assert.match(layout,/function focusLinkedHouse\(\)\{/);
  assert.match(layout,/if\(state\.linkedHouse!=null\)focusLinkedHouse\(\);else if\(state\.search/);
});

// ---- 3. Add to route: shared state/storage ----
const store=init=>{const m=new Map(Object.entries(init||{}));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m}};
test('route: listing page uses the homepage key, entry shape and loader',()=>{
  assert.equal(R.ROUTE_KEY,'hfroute:2026');assert.equal(R.ROUTE_MAX,10);
  assert.ok(app.includes("localStorage.setItem('hfroute:2026',JSON.stringify(state.route))"),'homepage key unchanged');
  const s=store();const r=R.toggleListingStop(R.loadSavedRoute(s,listings,events),real(12));
  assert.equal(r.added,true);R.saveRoute(s,r.route);
  assert.deepEqual(JSON.parse(s.getItem('hfroute:2026')),[{num:12,entityId:'harvesters-of-souls-2026'}]);
  assert.deepEqual(R.migrateRoute(s.getItem('hfroute:2026'),listings,{},events),[{num:12,entityId:'harvesters-of-souls-2026'}],'homepage loader reads it unchanged');
});
test('route: adding keeps existing listing and event stops in order; pressing again removes only this house',()=>{
  const ev=events[0];
  const s=store({'hfroute:2026':JSON.stringify([{num:1,entityId:real(1).entityId},{eventId:ev.id}])});
  let route=R.loadSavedRoute(s,listings,events);
  const add=R.toggleListingStop(route,real(12));
  assert.deepEqual(add.route,[{num:1,entityId:real(1).entityId},{eventId:ev.id},{num:12,entityId:real(12).entityId}]);
  const off=R.toggleListingStop(add.route,real(12));
  assert.equal(off.added,false);assert.deepEqual(off.route,route);
});
test('route: ten-stop cap and invalid listings match the homepage',()=>{
  const ten=Array.from({length:10},(_,i)=>({eventId:'x'+i}));
  const r=R.toggleListingStop(ten,real(12));
  assert.equal(r.error,'Routes can have up to 10 stops.');assert.equal(r.route,ten);
  assert.equal(R.toggleListingStop([],{num:99,placeholder:true}).error,'This listing cannot be added to a route.');
  assert.ok(app.includes('Routes can have up to 10 stops.'),'same copy as the homepage');
});
test('route: legacy hfentity values are honored exactly like the homepage loader',()=>{
  const s=store({'hfroute:2026':'[8]','hfentity:8':'hauntfinder:2026:listing:8:original'});
  assert.deepEqual(R.loadSavedRoute(s,listings,events),[],'stale slot-8 number dropped');
  assert.deepEqual(R.loadSavedRoute(store({'hfroute:2026':'[12]'}),listings,events),[{num:12,entityId:real(12).entityId}]);
  assert.deepEqual(R.loadSavedRoute({getItem(){throw new Error('blocked')}},listings,events),[],'blocked storage is empty, not a crash');
});
test('route: listing page renders the card button states and persists through the shared helpers',()=>{
  assert.match(html,/<button[^>]+id="listingRouteBtn"[^>]+aria-pressed="false"/);
  assert.match(listingJs,/'✓ On your route':'\+ Add to route'/);
  assert.match(listingJs,/routeStore\.toggleListingStop\(/);assert.match(listingJs,/routeStore\.saveRoute\(storage,/);assert.match(listingJs,/routeStore\.loadSavedRoute\(storage,/);
});

// ---- Live QA gate ----
test('live QA gate: verify-live hashes the new shared script and checks the parity controls on listing #12',()=>{
  const verify=read('scripts/verify-live.js');
  for(const f of ['listing-format.js','routing.js','schedules.js'])assert.ok(verify.includes(`'${f}'`),f+' hashed');
  assert.match(verify,/id="listingRouteBtn"/);assert.match(verify,/id="listingMap"/);
});

// ---- Scope guard ----
test('scope: listing page stays a dialog-free subpage with its three sections',()=>{
  assert.equal(html.includes('<dialog'),false);
  for(const id of ['feedback','report-update','share'])assert.match(html,new RegExp('<section[^>]+id="'+id+'"'));
});
