const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const feedback=require('../api/feedback');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const CACHE='public, max-age=0, s-maxage=60, stale-while-revalidate=300';
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}}}
function env(){const saved={u:process.env.UPSTASH_REDIS_REST_URL,t:process.env.UPSTASH_REDIS_REST_TOKEN,f:global.fetch};process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';return ()=>{global.fetch=saved.f;for(const [k,v] of [['UPSTASH_REDIS_REST_URL',saved.u],['UPSTASH_REDIS_REST_TOKEN',saved.t]]){if(v===undefined)delete process.env[k];else process.env[k]=v}}}
// Mock Upstash with /pipeline support plus the single-command forms the write path uses.
function storage(store){const log=[];global.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer test-token');log.push({url,body});
  if(url.endsWith('/pipeline'))return {ok:true,json:async()=>body.map(c=>{assert.equal(c[0],'LRANGE');return {result:store.get(c[1])||[]}})};
  if(body[0]==='LRANGE')return {ok:true,json:async()=>({result:store.get(body[1])||[]})};
  assert.equal(body[0],'EVAL');store.set(body[4],[body[5],...(store.get(body[4])||[])]);return {ok:true,json:async()=>({result:1})}};return log}
const get=async q=>{const res=response();await feedback({method:'GET',query:q,headers:{}},res);return res};
const seed=()=>{const s=new Map();
  s.set('hauntfinder:2026:reviews:1',[JSON.stringify({rating:5}),JSON.stringify({rating:4}),JSON.stringify({kind:'update-request',rating:1})]);
  s.set('hauntfinder:2026:reviews:2',[JSON.stringify({rating:3})]);
  s.set('hauntfinder:2026:photos:1',[JSON.stringify({id:'a',url:'https://blob/a.jpg',pathname:'p/a.jpg',status:'approved'}),JSON.stringify({id:'b',url:'https://blob/b.jpg',status:'pending'})]);
  return s};

test('batched read returns ratings and approved photos for all listings in one storage round trip',async()=>{
  const restore=env();try{
    const log=storage(seed());const res=await get({summary:'1'});
    assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],CACHE);
    assert.deepEqual(res.body.ratings[1],{count:2,average:'4.5'},'update-request rows are not ratings');
    assert.deepEqual(res.body.ratings[2],{count:1,average:'3.0'});
    assert.deepEqual(res.body.photos,{1:[{id:'a',url:'https://blob/a.jpg',pathname:'p/a.jpg'}]},'only approved photos; listings without photos are omitted');
    assert.ok(Number.isFinite(Date.parse(res.body.generatedAt)));
    assert.equal(log.length,1,'one storage call for every listing');assert.ok(log[0].url.endsWith('/pipeline'));
    assert.ok(log[0].body.length>=2);
  }finally{restore()}
});
test('batched read: id filter, unknown ids dropped, bad ids rejected, empty data',async()=>{
  const restore=env();try{
    const log=storage(seed());
    let res=await get({summary:'1',ids:'1,2'});assert.deepEqual(Object.keys(res.body.ratings).sort(),['1','2']);assert.equal(log[0].body.length,4);
    res=await get({summary:'1',ids:'1,999999'});assert.equal(res.statusCode,200);assert.deepEqual(Object.keys(res.body.ratings),['1'],'unknown id dropped');
    res=await get({summary:'1',ids:'999999'});assert.equal(res.statusCode,200);assert.deepEqual(res.body.ratings,{});assert.deepEqual(res.body.photos,{});assert.equal(res.headers['Cache-Control'],CACHE);
    for(const ids of ['abc','1,,2','1;2','-1','1.5'])assert.equal((await get({summary:'1',ids})).statusCode,400,ids);
    assert.equal(res.headers['X-Content-Type-Options'],'nosniff');
    storage(new Map());res=await get({summary:'1'});assert.equal(res.statusCode,200);assert.deepEqual(res.body.ratings,{});assert.deepEqual(res.body.photos,{},'no data is an empty, cacheable answer');assert.equal(res.headers['Cache-Control'],CACHE);
  }finally{restore()}
});
test('batched read: failures are never cached; other methods rejected',async()=>{
  const restore=env();try{
    global.fetch=async()=>{throw Error('offline')};let res=await get({summary:'1'});assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');
    global.fetch=async()=>({ok:true,json:async()=>[{result:[]},{error:'boom'}]});res=await get({summary:'1'});assert.equal(res.statusCode,503,'a partial pipeline failure fails the whole read');assert.equal(res.headers['Cache-Control'],'no-store');
    delete process.env.UPSTASH_REDIS_REST_URL;res=await get({summary:'1'});assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');
    process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';
    res=response();await feedback({method:'POST',query:{summary:'1'},headers:{}},res);assert.notEqual(res.headers['Cache-Control'],CACHE);
  }finally{restore()}
});
test('single-listing feedback read stays available and is CDN cacheable; errors are not',async()=>{
  const restore=env();try{
    storage(seed());let res=await get({house:'1'});assert.equal(res.statusCode,200);assert.equal(res.body.reviews.length,2);assert.equal(res.headers['Cache-Control'],CACHE);
    res=await get({house:'999999'});assert.equal(res.statusCode,400);assert.equal(res.headers['Cache-Control'],'no-store');
    global.fetch=async()=>{throw Error('offline')};res=await get({house:'1'});assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');
  }finally{restore()}
});
test('a write is never cached and the writer sees the update at once',async()=>{
  const restore=env();try{
    const store=seed();storage(store);
    const post=async()=>{const res=response();await feedback({method:'POST',body:{house:2,name:'Test',rating:5,comment:'Great',website:''},headers:{host:'hauntfinder.vercel.app',origin:'https://hauntfinder.vercel.app','content-type':'application/json','x-forwarded-for':'192.0.2.9'},query:{}},res);return res};
    const res=await post();assert.equal(res.statusCode,201);assert.equal(res.headers['Cache-Control'],'no-store','writes are uncached');
    assert.equal(res.body.reviews.length,2,'the POST response already includes the new review');
    // Shared cache is a minute behind, so the page overlays the writer's own rating (listing.js stores it, community.js prefers it).
    const listingJs=read('listing.js'),community=read('community.js');
    assert.ok(listingJs.includes("localStorage.setItem('hfrated:v1'")&&listingJs.includes("bust='&t='+mine.at"),'writer stores their rating and bypasses the shared cache on reload');
    assert.ok(community.includes('mine.at>made'),'a rating newer than the cached summary wins');
    assert.deepEqual((await get({summary:'1',ids:'2'})).body.ratings[2],{count:2,average:'4.0'},'a fresh summary reflects the write');
  }finally{restore()}
});
test('client: one batched read, no per-listing fan-out, video waits for play, safe on failure',()=>{
  const community=read('community.js'),photos=read('photos-ui.js'),app=read('app.js'),listing=read('listing.js');
  assert.equal((community.match(/fetch\(/g)||[]).length,1,'community.js makes exactly one request');
  assert.equal(/forEach\(async/.test(community),false);
  assert.equal(/fetch\(/.test(photos),false,'photos-ui.js never requests per listing');
  assert.ok(community.includes('.catch(()=>null)')&&photos.includes('.catch(()=>null)'),'failed batch leaves default cards, no console error');
  assert.ok(app.includes('<video controls playsinline muted preload="none"'),'walkthrough not downloaded until play');
  assert.ok(listing.includes("'/api/feedback?house='+house.num"),'listing page keeps its single read');
});
