// /route.html replaces the homepage route sheet (page-first plan step 4).
// Node-level checks: link compatibility and entity gating, route operations,
// storage sync, stop presentation, and the page/homepage markup contract.
// Rendered behavior at 1280px and 390px is covered by scripts/e2e-route.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const R=require('../routing.js'),P=require('../route.js');
const app=read('app.js'),index=read('index.html'),routeHtml=read('route.html'),routeJs=read('route.js'),css=read('styles.css'),pageJs=read('page.js'),layout=read('layout.js'),community=read('community.js');
const {listings,events}=P.loadRouteData(app);
const real=n=>listings.find(x=>x.num===n);
const ev=id=>events.find(x=>x.id===id);
const store=init=>{const m=new Map(Object.entries(init||{}));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m}};
const SKULLY='skullys-costume-closet',BUDDIES='best-buddies-safe-trick-or-treat-2026-10-29';

// ---- Link compatibility ----
test('?route= links round-trip through the established encoder/parser, listings and events mixed',()=>{
  const stops=[{num:12,entityId:real(12).entityId},{eventId:BUDDIES},{num:1,entityId:real(1).entityId}];
  const link=R.routeLink(stops,'https://hauntfinder.vercel.app/route.html');
  assert.equal(link,'https://hauntfinder.vercel.app/route.html?route=d12,e'+BUDDIES+',d1');
  assert.deepEqual(R.parseRouteParam(link.split('?route=')[1],listings,events),stops);
});
test('legacy ?outing= links still resolve by entity id',()=>{
  const out=R.outingLink([{num:12,entityId:real(12).entityId},{eventId:SKULLY}]);
  assert.deepEqual(R.parseOutingParam(new URL(out).searchParams.get('outing'),listings,events),[{num:12,entityId:real(12).entityId},{eventId:SKULLY}]);
});
test('reused slot #8 keeps its entity guard: links carry the entity and a bare d8 never resolves',()=>{
  const eight={num:8,entityId:real(8).entityId};
  const link=R.routeLink([eight],'route.html');
  assert.equal(link,'route.html?route=d8~drakestown-road-2026');
  assert.deepEqual(R.parseRouteParam('d8~drakestown-road-2026',listings,events),[eight]);
  assert.deepEqual(R.parseRouteParam('d8',listings,events),[],'old/bare slot 8 never resolves to the new listing');
  assert.deepEqual(R.parseRouteParam('d8~skullys-display',listings,events),[],'wrong entity rejected');
  assert.deepEqual(R.parseRouteParam('d12~'+encodeURIComponent(real(12).entityId),listings,events),[{num:12,entityId:real(12).entityId}],'matching entity accepted on any slot');
  assert.deepEqual(R.parseRouteParam('d12~someone-else',listings,events),[],'mismatched entity rejected on any slot');
});
test('direct links rebuild the route without prior storage; links win and are saved; invalid links fall back to storage',()=>{
  const s=store();
  const r=P.resolveInitialRoute('?route=d12,e'+BUDDIES,s,listings,events);
  assert.deepEqual(r.route,[{num:12,entityId:real(12).entityId},{eventId:BUDDIES}]);
  assert.equal(r.fromLink,true);assert.equal(r.message,'Shared route loaded.');
  assert.deepEqual(JSON.parse(s.getItem('hfroute:2026')),r.route,'shared route becomes the saved route');
  const outing=P.resolveInitialRoute('?outing='+encodeURIComponent(real(1).entityId),store(),listings,events);
  assert.deepEqual(outing.route,[{num:1,entityId:real(1).entityId}]);
  const saved=store({'hfroute:2026':JSON.stringify([{num:2,entityId:real(2).entityId}])});
  const bad=P.resolveInitialRoute('?route=d8,x1',saved,listings,events);
  assert.deepEqual(bad.route,[{num:2,entityId:real(2).entityId}],'unusable link keeps the saved route');
  assert.match(bad.message,/could not find/i);
});
test('stored route loads when no route query is supplied; empty storage is an empty route',()=>{
  const s=store({'hfroute:2026':JSON.stringify([{num:12,entityId:real(12).entityId},{eventId:SKULLY}])});
  const r=P.resolveInitialRoute('',s,listings,events);
  assert.deepEqual(r.route,[{num:12,entityId:real(12).entityId},{eventId:SKULLY}]);assert.equal(r.fromLink,false);
  assert.deepEqual(P.resolveInitialRoute('',store(),listings,events).route,[]);
  assert.deepEqual(P.resolveInitialRoute('',{getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}},listings,events).route,[],'blocked storage is empty, not a crash');
});
test('a shared link longer than ten stops loads the first ten with the cap message',()=>{
  const twelve=listings.filter(x=>!x.placeholder&&!R.isReusedSlot(x)).slice(0,12).map(x=>'d'+x.num).join(',');
  const r=P.resolveInitialRoute('?route='+twelve,store(),listings,events);
  assert.equal(r.route.length,10);assert.match(r.message,/up to 10 stops/);
});

// ---- Operations ----
const A={num:1,entityId:'hauntfinder:2026:listing:1:original'},B={eventId:BUDDIES},C={num:12,entityId:'harvesters-of-souls-2026'};
test('remove, reorder (buttons and drag) and clear are pure and keep entry shapes',()=>{
  assert.deepEqual(R.removeRouteEntry([A,B,C],'e:'+BUDDIES),[A,C]);
  assert.deepEqual(R.moveRouteEntry([A,B,C],'n:12',-1),[A,C,B]);
  assert.deepEqual(R.moveRouteEntry([A,B,C],'n:1',-1),[A,B,C],'first stop cannot move earlier');
  assert.deepEqual(R.moveRouteEntry([A,B,C],'n:12',1),[A,B,C],'last stop cannot move later');
  assert.deepEqual(R.dropRouteEntry([A,B,C],'n:12','n:1'),[C,A,B]);
  assert.deepEqual(R.dropRouteEntry([A,B,C],'n:1','n:1'),[A,B,C]);
  const before=[A,B,C];R.moveRouteEntry(before,'n:12',-1);assert.deepEqual(before,[A,B,C],'input not mutated');
});
test('add keeps the ten-stop cap with the homepage copy',()=>{
  const ten=Array.from({length:10},(_,i)=>({eventId:'x'+i}));
  assert.equal(R.toggleListingStop(ten,real(12)).error,'Routes can have up to 10 stops.');
  assert.ok(app.includes('Routes can have up to 10 stops.'));
});
test('storage and URL stay in step: the page URL mirrors the route, empty routes drop the query',()=>{
  assert.equal(P.routePageURL([A,C]),'route.html?route=d1,d12');
  assert.equal(P.routePageURL([{num:8,entityId:'drakestown-road-2026'}]),'route.html?route=d8~drakestown-road-2026');
  assert.equal(P.routePageURL([]),'route.html');
  const s=store();assert.equal(R.saveRoute(s,[A,C]),true);
  assert.deepEqual(R.loadSavedRoute(s,listings,events),[A,C],'what the page saves is what the homepage loads');
});
test('Google Maps directions keep the homepage behavior: waypoints, destination, optional origin, ten-stop guard',()=>{
  const stops=[real(1),ev(BUDDIES),real(12)];
  const u=new URL(R.directionsURL(stops,{startMode:'current'}).url);
  assert.equal(u.origin+u.pathname,'https://www.google.com/maps/dir/');
  assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('travelmode'),'driving');
  assert.equal(u.searchParams.get('destination'),real(12).address);
  assert.equal(u.searchParams.get('waypoints'),[real(1).address,ev(BUDDIES).address].join('|'));
  assert.equal(u.searchParams.get('origin'),null,'"My location" lets Google Maps use the device location');
  assert.equal(new URL(R.directionsURL(stops,{startMode:'address',startAddr:' 1 Main St '}).url).searchParams.get('origin'),'1 Main St');
  assert.equal(R.directionsURL([],{}).error,'Add a stop to get directions.');
  assert.equal(R.directionsURL(Array(11).fill(real(1)),{}).error,'Routes can have up to 10 stops.');
});

// ---- Stop presentation ----
test('stops show title, category, address or event date, and link back to the item',()=>{
  const ctx={listings,events,search:null};
  assert.deepEqual(P.stopView(C,ctx),{key:'n:12',name:'Harvesters of Souls',category:'Display',detail:'11 Jackson Ave, Washington, NJ 07882',href:'listing.html?id=12',icon:'v2/icon-display',outOfArea:false});
  assert.equal(P.stopView({num:8,entityId:'drakestown-road-2026'},ctx).href,'listing.html?id=8&entity=drakestown-road-2026','reused slot links keep the entity');
  assert.equal(P.stopView({num:11,entityId:real(11).entityId},ctx).category,'Treat stop');
  assert.equal(P.stopView({num:11,entityId:real(11).entityId},ctx).icon,'v2/icon-treat-stop');
  const b=P.stopView(B,ctx);
  assert.equal(b.category,'Event');assert.equal(b.href,'/?event='+BUDDIES);assert.equal(b.icon,'v2/icon-event');
  assert.equal(b.detail,'Thu, Oct 29 · 5:30–7 PM · MOHS Track');
  assert.match(P.stopView({eventId:SKULLY},ctx).detail,/^Open all season/);
  assert.equal(P.stopView({num:99,entityId:'gone'},ctx),null,'unknown stops are skipped');
  const far=P.stopView(C,{...ctx,search:{mode:'zip',zip:'07828',lat:40.884959,lng:-74.755657,radius:5}});
  assert.equal(far.outOfArea,true,'stops outside the current search area are flagged');
});

// ---- Page markup ----
test('route.html: complete subpage, one h1, empty state, planner, clear confirmation without a dialog',()=>{
  assert.match(routeHtml,/<body data-page="route" class="subpage">/);
  assert.equal((routeHtml.match(/<h1[ >]/g)||[]).length,1);
  assert.match(routeHtml,/id="siteChrome" data-chrome-active="route"/);assert.match(routeHtml,/<script src="site-chrome\.js"><\/script>/);assert.match(routeHtml,/<footer class="subpage-foot">/);
  assert.equal(routeHtml.includes('<dialog'),false);
  assert.match(routeHtml,/id="routeEmpty"[^>]*hidden/);
  assert.match(routeHtml,/No stops on your route yet/);
  assert.match(routeHtml,/<a[^>]+id="backToMap"[^>]+href="\/"/);
  assert.match(routeHtml,/id="clearConfirm"[^>]*role="group"[^>]*hidden/);
  assert.match(routeHtml,/id="clearYes"/);assert.match(routeHtml,/id="clearNo"/);
  assert.match(routeHtml,/<noscript>/);
  for(const dep of ['routing.js','listing-format.js','location.js'])assert.ok(routeHtml.indexOf(`<script src="${dep}"></script>`)<routeHtml.indexOf('<script src="route.js"></script>'),dep+' before route.js');
  assert.match(pageJs,/const ROUTES = \['submit', 'about', 'listing', 'route'\]/);
});
test('route.js: replaceState keeps the URL in step without filling history; Escape closes the open inline panel',()=>{
  assert.match(routeJs,/history\.replaceState\(null,'',routePageURL\(/);
  assert.match(routeJs,/e\.key!=='Escape'\)return;\s*if\(!\$\('clearConfirm'\)\.hidden\)/,'Escape closes the clear confirmation first');
  assert.match(routeJs,/addEventListener\('storage'/,'other tabs update the page');
  assert.match(routeJs,/window\.open\(/,'directions open in a new tab, as before');
});

// ---- Homepage ----
test('homepage: route entry points are same-tab links to /route.html; the route sheet is gone',()=>{
  assert.equal(index.includes('id="routeSheet"'),false);assert.equal(index.includes('route-sheet'),false);
  assert.match(index,/<a class="route-panel__plan" id="routeLink" href="route\.html">Plan your route →<\/a>/);
  for(const s of [index.match(/id="routeLink"[^>]*>/)[0]])assert.equal(s.includes('target='),false,'same tab');
  assert.equal(app.includes('openRouteSheet'),false);assert.equal(community.includes('openRouteSheet'),false);
  assert.equal(/\.route-sheet[{ .]/.test(css),false,'sheet styles removed');
  assert.equal(index.includes('id="routePlanner"'),false,'the planner lives on /route.html only');
  assert.match(app,/addEventListener\('pageshow'/,'Back from /route.html shows the current route');
});

// ---- Live QA gate ----
test('live QA gate: verify-live hashes route.html/route.js and checks the page and the homepage CTA',()=>{
  const verify=read('scripts/verify-live.js');
  assert.ok(verify.includes("'route.html', 'route.js'"));
  assert.match(verify,/route page serves the planner with one h1 and no dialog/);
  assert.match(verify,/homepage route CTA links to \/route\.html and the route sheet is gone/);
});
