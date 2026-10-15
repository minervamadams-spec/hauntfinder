const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {storageKeys}=require('../lib/keys');
function appData(){const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];return vm.runInNewContext(code+';({listings,events,CURRENT_SEASON,inCurrentSeason})')}
test('key builder returns the exact frozen legacy keys for Halloween 2026',()=>{
 for(let num=1;num<=11;num++){
  const {review,identity}=storageKeys({season:'halloween',year:2026,num});
  assert.equal(review,`hauntfinder:2026:reviews:${num}`);
  assert.equal(identity,`hauntfinder:2026:listing:${num}:original`);
 }
 const reused=storageKeys({season:'halloween',year:2026,num:8,entityId:'drakestown-road-2026'});
 assert.equal(reused.review,'hauntfinder:2026:reviews:8:drakestown-road-2026');
 assert.equal(reused.identity,'drakestown-road-2026');
});
test('key builder uses the season-scoped form only for non-Halloween-2026 seasons',()=>{
 const {review,identity}=storageKeys({season:'holiday',year:2026,num:5});
 assert.equal(review,'hauntfinder:holiday:2026:reviews:5');
 assert.equal(identity,'hauntfinder:holiday:2026:listing:5');
 const withEntity=storageKeys({season:'holiday',year:2027,num:3,entityId:'some-entity'});
 assert.equal(withEntity.review,'hauntfinder:holiday:2027:reviews:3:some-entity');
 assert.equal(withEntity.identity,'hauntfinder:holiday:2027:listing:3:some-entity');
});
test('current-season rule excludes wrong season, year or participation and includes confirmed records',()=>{
 const {listings,events,CURRENT_SEASON,inCurrentSeason}=appData();
 assert.equal(CURRENT_SEASON.season,'halloween');
 assert.equal(CURRENT_SEASON.year,2026);
 assert.ok(inCurrentSeason({season:'halloween',year:2026,participation:'confirmed'}));
 assert.ok(inCurrentSeason({season:'halloween',year:2026}));
 assert.ok(!inCurrentSeason({season:'holiday',year:2026,participation:'confirmed'}));
 assert.ok(!inCurrentSeason({season:'halloween',year:2025,participation:'confirmed'}));
 assert.ok(!inCurrentSeason({season:'halloween',year:2026,participation:'pending_renewal'}));
 assert.ok(!inCurrentSeason({season:'halloween',year:2026,participation:'unconfirmed'}));
 const activeListings=listings.filter(inCurrentSeason),activeEvents=events.filter(inCurrentSeason);
 assert.equal(activeListings.length,12);
 assert.equal(activeEvents.length,2);
 assert.ok(activeListings.every(x=>x.season==='halloween'&&x.year===2026&&x.participation==='confirmed'));
 assert.ok(activeEvents.every(x=>x.season==='halloween'&&x.year===2026&&x.participation==='confirmed'));
});
test('public-data pipeline sees only active-season confirmed records with coordinates',()=>{
 const data=JSON.parse(require('node:child_process').execFileSync('node',[path.join(__dirname,'../scripts/public-data.cjs')],{encoding:'utf8'}));
 assert.equal(data.listings.length,12);
 assert.equal(data.events.length,2);
 assert.deepEqual(Object.keys(data).sort(),['date','events','listings']);
 for(const x of [...data.listings,...data.events]){
  assert.ok(Number.isFinite(x.lat)&&Number.isFinite(x.lng),x.name);
  assert.ok(typeof x.geoVerified==='string'&&x.geoVerified.length>0,x.name);
 }
});
test('haversine sanity: 07828 centroid to listing 1 is between 1 and 3 miles',()=>{
 const {listings}=appData();
 const one=listings.find(x=>x.num===1);
 const rad=d=>d*Math.PI/180;
 const a={lat:40.884959,lng:-74.755657},b={lat:one.lat,lng:one.lng};
 const v=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
 const miles=3958.8*2*Math.asin(Math.sqrt(Math.min(1,v)));
 assert.ok(miles>1&&miles<3,`distance was ${miles}`);
});
const loc=require('../location');
const zipTable=require('../data/zip-centroids.json');
test('haversine matches Gazetteer-derived reference distances within 0.5 mi',()=>{
 const z07828={lat:zipTable['07828'][0],lng:zipTable['07828'][1]};
 const d18301=loc.haversineMi(z07828,{lat:zipTable['18301'][0],lng:zipTable['18301'][1]});
 const d10001=loc.haversineMi(z07828,{lat:zipTable['10001'][0],lng:zipTable['10001'][1]});
 assert.ok(Math.abs(d18301-24.47)<=0.5,`07828->18301 was ${d18301}`);
 assert.ok(Math.abs(d10001-40.73)<=0.5,`07828->10001 was ${d10001}`);
});
test('radius boundary is inclusive; just over is excluded',()=>{
 assert.equal(loc.inRadius(10,10),true);
 assert.equal(loc.inRadius(9.99,10),true);
 assert.equal(loc.inRadius(10.01,10),false);
});
test('parseZip accepts trimmed 5-digit ZIPs and rejects everything else',()=>{
 assert.equal(loc.parseZip('07828'),'07828');
 assert.equal(loc.parseZip(' 07828 '),'07828');
 for(const bad of ['7828','078281','0782a','abc','','   ','07828-1234','10 72'])assert.equal(loc.parseZip(bad),null,bad);
 assert.equal(loc.parseZip(7828),null);
});
test('launch-state check by prefix accepts NJ/NY/PA and rejects CT',()=>{
 for(const zip of ['08989','10001','18301','07001','14999','19699'])assert.equal(loc.isLaunchStateZip(zip),true,zip);
 for(const zip of ['06901','19999','55001','7828','abcde'])assert.equal(loc.isLaunchStateZip(zip),false,zip);
});
test('nextRadius climbs 5 to 10 to 25 to 50 then stops',()=>{
 assert.equal(loc.nextRadius(5),10);
 assert.equal(loc.nextRadius(10),25);
 assert.equal(loc.nextRadius(25),50);
 assert.equal(loc.nextRadius(50),null);
});
function mockStorage(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),_map:m}}
test('search state persists round-trip; device coords round to 2 decimals; corrupt JSON falls back to default',()=>{
 const storage=mockStorage();
 const saved=loc.saveSearch({mode:'zip',zip:' 18301 ',lat:41.0424,lng:-75.1758,radius:10},storage);
 assert.deepEqual(saved,{mode:'zip',zip:'18301',lat:41.0424,lng:-75.1758,radius:10});
 assert.deepEqual(loc.loadSearch(storage),saved);
 const device=loc.saveSearch({mode:'device',zip:'07828',lat:40.123456,lng:-74.654321,radius:25},storage);
 assert.equal(device.lat,40.12);
 assert.equal(device.lng,-74.65);
 const reloaded=loc.loadSearch(storage);
 assert.equal(reloaded.mode,'device');
 assert.equal(reloaded.lat,40.12);
 const broken=mockStorage({'hfsearch:v1':'{not json'});
 assert.deepEqual(loc.loadSearch(broken),loc.DEFAULT_SEARCH);
 const weird=mockStorage({'hfsearch:v1':JSON.stringify({mode:'mars',zip:'1',radius:7})});
 assert.deepEqual(loc.loadSearch(weird),{mode:'zip',zip:'07828',lat:40.884959,lng:-74.755657,radius:25});
 assert.equal(loc.describeSearch(loc.DEFAULT_SEARCH),'Within 25 mi of 07828');
 assert.equal(loc.describeSearch({mode:'device',radius:10}),'Near your location · within 10 mi');
});
test('ZIP table integrity: 5-digit keys, launch-state bounding box, 07828 present, 4000-4500 entries',()=>{
 const keys=Object.keys(zipTable).filter(k=>k!=='_meta');
 assert.ok(keys.length>=4000&&keys.length<=4500,`count was ${keys.length}`);
 assert.ok(keys.every(k=>/^\d{5}$/.test(k)));
 for(const k of keys){const [lat,lng]=zipTable[k];assert.ok(lat>=38.5&&lat<=45.2,`${k} lat ${lat}`);assert.ok(lng>=-80.7&&lng<=-71.7,`${k} lng ${lng}`)}
 assert.deepEqual(zipTable['07828'],[40.885,-74.7557]);
 assert.equal(zipTable['_meta'].vintage,'2023');
 assert.deepEqual(zipTable['_meta'].states,['NJ','NY','PA']);
});
const GEO_SEARCH={mode:'zip',zip:'07828',lat:40.885,lng:-74.7557,radius:5};
const GEO_ITEMS=[
 {num:2,name:'B',kind:'Home display',lat:40.885,lng:-74.7557},
 {num:1,name:'A',kind:'Home display',lat:40.885,lng:-74.7557},
 {num:3,name:'C',kind:'Trick-or-treat stop',lat:40.985,lng:-74.7557},
 {num:4,name:'D',kind:'Home display',placeholder:true},
];
test('formatDistance shows one decimal under 10 mi and whole miles at 10+',()=>{
 assert.equal(loc.formatDistance(2.44),'2.4');
 assert.equal(loc.formatDistance(9.94),'9.9');
 assert.equal(loc.formatDistance(10.4),'10');
 assert.equal(loc.isDefaultArea({mode:'zip',zip:'07828',lat:40.885,lng:-74.7557,radius:25}),true);
 assert.equal(loc.isDefaultArea({mode:'zip',zip:'07828',lat:40.885,lng:-74.7557,radius:50}),false);
 assert.equal(loc.isDefaultArea({mode:'device',zip:'07828',radius:25}),false);
 assert.equal(loc.isDefaultArea(null),false);
});
test('inSearchArea requires finite coords on both sides and includes the boundary',()=>{
 assert.equal(loc.inSearchArea({lat:40.885,lng:-74.7557},{...GEO_SEARCH,radius:0}),true);
 assert.equal(loc.inSearchArea({lat:40.88501,lng:-74.7557},{...GEO_SEARCH,radius:0}),false);
 assert.equal(loc.inSearchArea({lat:40.885},GEO_SEARCH),false);
 assert.equal(loc.inSearchArea(GEO_ITEMS[0],null),false);
});
test('visibleSet is the single visible source: predicate + area + nearest-first with num ties',()=>{
 const all=loc.visibleSet({items:GEO_ITEMS,search:GEO_SEARCH,predicate:()=>true});
 assert.deepEqual(all.map(x=>x.num),[1,2]);
 const treats=loc.visibleSet({items:GEO_ITEMS,search:GEO_SEARCH,predicate:x=>x.kind==='Trick-or-treat stop'});
 assert.deepEqual(treats.map(x=>x.num),[]);
 const wide=loc.visibleSet({items:GEO_ITEMS,search:{...GEO_SEARCH,radius:25},predicate:()=>true});
 assert.deepEqual(wide.map(x=>x.num),[1,2,3]);
 const kept=loc.visibleSet({items:GEO_ITEMS,search:GEO_SEARCH,predicate:()=>true,keepUnlocated:true});
 assert.deepEqual(kept.map(x=>x.num),[1,2,4]);
 const noSearch=loc.visibleSet({items:GEO_ITEMS,search:null,predicate:()=>true});
 assert.deepEqual(noSearch.map(x=>x.num),[1,2,3,4]);
});
test('orderByDistance sorts nearest-first, ties by the custom tiebreak, unlocated last',()=>{
 const early={id:'early',lat:40.885,lng:-74.7557,startAt:'2026-10-29T10:00:00-04:00'};
 const late={id:'late',lat:40.885,lng:-74.7557,startAt:'2026-10-29T17:30:00-04:00'};
 const far={id:'far',startAt:'2026-10-29T12:00:00-04:00'};
 const byStart=(a,b)=>new Date(a.startAt)-new Date(b.startAt);
 assert.deepEqual(loc.orderByDistance([late,early,far],GEO_SEARCH,byStart).map(x=>x.id),['early','late','far']);
 assert.deepEqual(loc.orderByDistance([far,late,early],null,byStart).map(x=>x.id),['early','far','late']);
});
test('events are geo-filtered through the shared visible-set path',()=>{
 const evs=[{id:'in',lat:40.885,lng:-74.7557},{id:'out',lat:40.985,lng:-74.7557},{id:'nocoords'}];
 const visible=loc.visibleSet({items:evs,search:GEO_SEARCH,predicate:()=>true});
 assert.deepEqual(visible.map(x=>x.id),['in']);
});
test('areaCounts splits displays, treat stops and upcoming events inside the search area',()=>{
 const now=Date.parse('2026-10-26T12:00:00-04:00');
 const evs=[
  {id:'e1',ongoing:true,lat:40.885,lng:-74.7557},
  {id:'e2',ongoing:false,endAt:'2026-10-31T21:00:00-04:00',lat:40.985,lng:-74.7557},
  {id:'e3',ongoing:false,endAt:'2020-01-01T00:00:00Z',lat:40.885,lng:-74.7557},
 ];
 assert.deepEqual(loc.areaCounts({listings:GEO_ITEMS,events:evs,search:GEO_SEARCH,now}),{displays:2,treats:0,events:1});
 assert.deepEqual(loc.areaCounts({listings:GEO_ITEMS,events:evs,search:{...GEO_SEARCH,radius:25},now}),{displays:2,treats:1,events:2});
 assert.deepEqual(loc.areaCounts({listings:GEO_ITEMS,events:evs,search:null,now}),{displays:2,treats:1,events:2});
});
test('stopsWithAreaFlags flags route stops outside the current search area without mutating them',()=>{
 const stops=[{num:1,lat:40.885,lng:-74.7557},{num:2,lat:40.985,lng:-74.7557}];
 const flagged=loc.stopsWithAreaFlags(stops,GEO_SEARCH);
 assert.deepEqual(flagged.map(s=>s.outOfArea),[false,true]);
 assert.ok(stops.every(s=>!('outOfArea' in s)));
 assert.deepEqual(loc.stopsWithAreaFlags(stops,null).map(s=>s.outOfArea),[false,false]);
});
test('view preference persists to its own key, defaults to list, and survives corrupt values',()=>{
 const storage=mockStorage();
 assert.equal(loc.VIEW_KEY,'hfview:v1');
 assert.equal(loc.loadView(storage),'list');
 assert.equal(loc.saveView('map',storage),'map');
 assert.equal(loc.loadView(storage),'map');
 assert.equal(loc.saveView('list',storage),'list');
 assert.equal(loc.loadView(storage),'list');
 assert.equal(loc.saveView('MAP',storage),'list');
 assert.equal(loc.saveView(7,storage),'list');
 const broken=mockStorage({'hfview:v1':'{nope'});
 assert.equal(loc.loadView(broken),'list');
 const legacy=mockStorage({'hfview:v1':'map'});
 assert.equal(loc.loadView(legacy),'list');
 assert.ok(!('hfsearch:v1' in storage._map),'view key write must not touch the search key');
});
