const test=require('node:test'),assert=require('node:assert/strict');
const {migrateRoute,isReusedSlot,legacyEntityId}=require('../routing');
const {storageKeys}=require('../lib/keys');
// Fixture mirrors the real slot map: 8 is reuse-gated (former entity in the
// slot), 11 is a fresh allocation with its own entityId, the rest carry the
// legacy convention entityId.
const LEGACY=n=>'hauntfinder:2026:listing:'+n+':original';
const fixture=[1,2,3,4,5,6,7,9,10].map(n=>({num:n,entityId:LEGACY(n)})).concat([
 {num:8,entityId:'drakestown-road-2026'},
 {num:11,entityId:'north-rose-lane-treat-stop-2026'}
]);
test('legacy number-array route migrates to entity-aware entries without loss',()=>{
 const out=migrateRoute('[1,2,8]',fixture,{8:'drakestown-road-2026'});
 assert.deepEqual(out,[{num:1,entityId:LEGACY(1)},{num:2,entityId:LEGACY(2)},{num:8,entityId:'drakestown-road-2026'}]);
});
test('legacy saved stop for a slot whose recorded entity mismatches is dropped',()=>{
 assert.deepEqual(migrateRoute('[8]',fixture,{8:'skullys-costume-closet'}),[]);
 assert.deepEqual(migrateRoute(JSON.stringify([1,8]),fixture,{8:'skullys-costume-closet'}),[{num:1,entityId:LEGACY(1)}]);
});
test('new-format entries must match the current entity exactly; wrong entity dropped, garbage tolerated',()=>{
 assert.deepEqual(migrateRoute(JSON.stringify([{num:8,entityId:'skullys-costume-closet'}]),fixture,{}),[]);
 assert.deepEqual(migrateRoute(JSON.stringify([{num:8,entityId:'drakestown-road-2026'}]),fixture,{}),[{num:8,entityId:'drakestown-road-2026'}]);
 const mixed=migrateRoute('[{"num":8,"entityId":"skullys-costume-closet"},8,"9",{"num":2},{"num":2},null,"garbage",42]',fixture,{});
 assert.deepEqual(mixed,[{num:8,entityId:'drakestown-road-2026'},{num:9,entityId:LEGACY(9)},{num:2,entityId:LEGACY(2)}]);
 assert.doesNotThrow(()=>migrateRoute('not json',fixture,{}));
 assert.deepEqual(migrateRoute('not json',fixture,{}),[]);
 assert.deepEqual(migrateRoute(undefined,fixture,{}),[]);
});
test('migration dedupes by num and preserves order',()=>{
 const out=migrateRoute('[3,1,3,2]',fixture,{});
 assert.deepEqual(out.map(x=>x.num),[3,1,2]);
});
test('placeholders and unknown numbers never migrate',()=>{
 const withPh=fixture.concat([{num:12,placeholder:true,entityId:'vacant-2026'}]);
 assert.deepEqual(migrateRoute('[12,99,1]',withPh,{}),[{num:1,entityId:LEGACY(1)}]);
});
test('isReusedSlot gates only slots reused in place; fresh allocations keep plain keys',()=>{
 assert.equal(isReusedSlot({num:8,entityId:'drakestown-road-2026'}),true);
 assert.equal(isReusedSlot({num:8,entityId:'something-else'}),false);
 // #11 was a fresh allocation: own entityId, but no former entity in the slot.
 assert.equal(isReusedSlot({num:11,entityId:'north-rose-lane-treat-stop-2026'}),false);
 assert.equal(isReusedSlot({num:1,entityId:LEGACY(1)}),false);
 assert.equal(isReusedSlot({num:13}),false);
 assert.equal(isReusedSlot(null),false);
 // Other seasons follow the generic convention: any non-legacy entityId is a reuse.
 assert.equal(isReusedSlot({num:4,entityId:'drakestown-road-2026',season:'holiday',year:2026}),true);
 assert.equal(legacyEntityId(4),'hauntfinder:2026:listing:4:original');
});
test('feedback review keys: only in-place reuse is suffixed; houses 1 and 11 stay byte-identical',()=>{
 // Mirrors the api/feedback.js derivation: the entity suffix applies only
 // to reuse-gated slots, so every existing Redis key stays byte-identical.
 const key=(listings,num)=>{const x=listings.find(l=>l.num===num);return storageKeys({season:'halloween',year:2026,num,entityId:isReusedSlot(x)?x.entityId:undefined}).review};
 const houses=fixture.concat([{num:12,entityId:'new-thing-2027'},{num:13}]);
 assert.equal(key(houses,1),'hauntfinder:2026:reviews:1');
 assert.equal(key(houses,11),'hauntfinder:2026:reviews:11');
 assert.equal(key(houses,8),'hauntfinder:2026:reviews:8:drakestown-road-2026');
 assert.equal(key(houses,12),'hauntfinder:2026:reviews:12');
 assert.equal(key(houses,13),'hauntfinder:2026:reviews:13');
 // The builder itself suffixes any season-scoped key when an entityId is passed.
 assert.equal(storageKeys({season:'holiday',year:2026,num:12,entityId:'new-thing-2027'}).review,'hauntfinder:holiday:2026:reviews:12:new-thing-2027');
});
