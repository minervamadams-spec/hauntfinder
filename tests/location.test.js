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
 assert.equal(activeListings.length,11);
 assert.equal(activeEvents.length,2);
 assert.ok(activeListings.every(x=>x.season==='halloween'&&x.year===2026&&x.participation==='confirmed'));
 assert.ok(activeEvents.every(x=>x.season==='halloween'&&x.year===2026&&x.participation==='confirmed'));
});
test('public-data pipeline sees only active-season confirmed records with coordinates',()=>{
 const data=JSON.parse(require('node:child_process').execFileSync('node',[path.join(__dirname,'../scripts/public-data.cjs')],{encoding:'utf8'}));
 assert.equal(data.listings.length,11);
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
