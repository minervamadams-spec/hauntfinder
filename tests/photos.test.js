const test=require('node:test');
const assert=require('node:assert/strict');
const {execSync}=require('node:child_process');
const crypto=require('node:crypto');
const path=require('node:path');
const photosHandler=require('../api/photos');
const reviewHandler=require('../api/photo-review');
const ROOT=path.join(__dirname,'..');
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}}}
function request(method,body,headers={}){return {method,body,headers:{'content-type':'application/json',...headers},query:{}}}
function sha256Preamble(src){return crypto.createHash('sha256').update(src.split('const filters=')[0]).digest('hex')}
function redisMock(store){
  return async(url,opts)=>{const c=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer test-token');
    if(c[0]==='LRANGE')return {ok:true,json:async()=>({result:store.get(c[1])||[]})};
    if(c[0]==='LSET'){const list=store.get(c[1]);if(!list||c[2]<0||c[2]>=list.length)return {ok:true,json:async()=>({error:'index out of range'})};list[c[2]]=c[3];return {ok:true,json:async()=>({result:'OK'})}}
    if(c[0]==='KEYS'){const prefix=c[1].slice(0,-1);return {ok:true,json:async()=>({result:[...store.keys()].filter(k=>k.startsWith(prefix))})}}
    throw new Error('unexpected redis command '+c[0])};
}
function envSetup(){const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','CRON_SECRET'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';process.env.CRON_SECRET='x'.repeat(32);return{keys,saved}}
function envRestore({keys,saved}){for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}}
test('photos API returns approved records only, validates the listing, fails closed',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    delete process.env.UPSTASH_REDIS_REST_URL;
    let res=response();await photosHandler({method:'GET',query:{num:'1'},headers:{}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body,{photos:[]},'unconfigured storage fails closed to empty');
    process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';
    const store=new Map();
    store.set('hauntfinder:2026:photos:1',[JSON.stringify({id:'a',url:'https://blob/1/a.jpg',pathname:'photos/1/a.jpg',status:'approved'}),JSON.stringify({id:'p',url:'https://blob/1/p.jpg',pathname:'photos/1/p.jpg',status:'pending',uploadedAt:'2026-10-14T00:00:00Z'}),JSON.stringify({id:'r',url:'https://blob/1/r.jpg',pathname:'photos/1/r.jpg',status:'rejected'})]);
    store.set('hauntfinder:2026:reviews:1',[JSON.stringify({id:'x',url:'https://blob/1/x.jpg',status:'approved'})]);
    global.fetch=redisMock(store);
    res=response();await photosHandler({method:'POST',query:{num:'1'},headers:{}},res);assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,'GET');
    res=response();await photosHandler({method:'GET',query:{num:'abc'},headers:{}},res);assert.equal(res.statusCode,400);
    res=response();await photosHandler({method:'GET',query:{},headers:{}},res);assert.equal(res.statusCode,400,'missing num rejected');
    res=response();await photosHandler({method:'GET',query:{num:'999'},headers:{}},res);assert.equal(res.statusCode,404,'unknown listing rejected');
    res=response();await photosHandler({method:'GET',query:{num:'1'},headers:{}},res);
    assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'public, max-age=300');
    assert.deepEqual(res.body.photos,[{id:'a',url:'https://blob/1/a.jpg',pathname:'photos/1/a.jpg'}],'only the approved record is returned, without pending/rejected or review-namespace rows');
    res=response();await photosHandler({method:'GET',query:{num:'2'},headers:{}},res);assert.deepEqual(res.body,{photos:[]},'missing key -> empty array');
    global.fetch=async()=>{throw Error('offline')};res=response();await photosHandler({method:'GET',query:{num:'1'},headers:{}},res);assert.deepEqual(res.body,{photos:[]},'storage outage -> empty array');
  }finally{global.fetch=originalFetch;envRestore(env)}
});
test('photo-review API: admin-only pending queue and approve/reject via LSET',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    const admin={'authorization':'Bearer '+'x'.repeat(32)};
    delete process.env.UPSTASH_REDIS_REST_URL;
    let res=response();await reviewHandler(request('GET',null,{}),res);assert.equal(res.statusCode,503,'unconfigured storage fails closed');
    process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';
    res=response();await reviewHandler(request('GET',null,{}),res);assert.equal(res.statusCode,403,'non-admin denied');
    res=response();await reviewHandler(request('POST',{listingNum:3,id:'keep',action:'approve'},{}),res);assert.equal(res.statusCode,403,'non-admin POST denied');
    const store=new Map();
    const row=(id,status) =>JSON.stringify({id,url:'https://blob/3/'+id+'.jpg',pathname:'photos/3/'+id+'.jpg',status,uploadedAt:'2026-10-14T00:00:00Z'});
    store.set('hauntfinder:2026:photos:3',[row('keep','pending'),row('ok','approved'),row('no','rejected')]);
    store.set('hauntfinder:2026:photos:4',Array.from({length:150},(_,i)=>row('p'+i,'pending')));
    global.fetch=redisMock(store);
    res=response();await reviewHandler(request('GET',null,admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.pending.length,100,'queue capped at 100 with 151 pending seeded');
    assert.ok(res.body.pending.every(p=>p.listingNum===3||p.listingNum===4));
    const first=res.body.pending[0];assert.deepEqual(Object.keys(first).sort(),['id','listingNum','uploadedAt','url'],'queue rows carry no status/contact fields');
    res=response();await reviewHandler(request('POST',{listingNum:3,id:'keep',action:'maybe'},admin),res);assert.equal(res.statusCode,400,'bad action rejected');
    res=response();await reviewHandler(request('POST',{listingNum:'x',id:'keep',action:'approve'},admin),res);assert.equal(res.statusCode,400,'bad listingNum rejected');
    res=response();await reviewHandler(request('POST',{listingNum:3,id:'nope',action:'approve'},admin),res);assert.equal(res.statusCode,404,'unknown photo id rejected');
    res=response();await reviewHandler(request('DELETE',null,admin),res);assert.equal(res.statusCode,405);
    res=response();await reviewHandler(request('POST',{listingNum:3,id:'keep',action:'approve'},admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.photo.status,'approved');
    const stored=JSON.parse(store.get('hauntfinder:2026:photos:3')[0]);assert.equal(stored.id,'keep');assert.equal(stored.status,'approved','LSET rewrote the record in place');
    const other=JSON.parse(store.get('hauntfinder:2026:photos:3')[1]);assert.equal(other.status,'approved','neighboring record untouched');
    global.fetch=redisMock(store);let res2=response();
    await photosHandler({method:'GET',query:{num:'3'},headers:{}},res2);
    assert.deepEqual(res2.body.photos.map(p=>p.id).sort(),['keep','ok'],'approved photo now visible through the public filter');
    res=response();await reviewHandler(request('POST',{listingNum:3,id:'ok',action:'reject'},admin),res);
    assert.equal(res.body.photo.status,'rejected');
    res2=response();await photosHandler({method:'GET',query:{num:'3'},headers:{}},res2);
    assert.deepEqual(res2.body.photos.map(p=>p.id),['keep'],'rejected photo hidden from the public filter');
    global.fetch=async()=>{throw Error('offline')};res=response();await reviewHandler(request('GET',null,admin),res);assert.equal(res.statusCode,503);
  }finally{global.fetch=originalFetch;envRestore(env)}
});
test('app.js public-data preamble hash is untouched by front-end edits',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const current=require('node:fs').readFileSync(path.join(ROOT,'app.js'),'utf8');
  const headHash=sha256Preamble(head),currentHash=sha256Preamble(current);
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(currentHash,headHash,'preamble hash identical to committed HEAD');
});
test('front-end wiring: renderPeek hook, script include, lazy loading and lightbox close',()=>{
  const fs=require('node:fs');
  const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const ui=fs.readFileSync(path.join(ROOT,'photos-ui.js'),'utf8');
  const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
  assert.ok(app.includes("typeof loadPeekPhotos==='function'&&loadPeekPhotos(n,x)"),'renderPeek calls the photo loader defensively');
  assert.ok(app.indexOf("typeof loadPeekPhotos==='function'")>app.indexOf('const filters='),'hook lives after the frozen split marker');
  assert.ok(html.indexOf('photos-ui.js')>html.indexOf('app.js'),'photos-ui.js loads after app.js');
  assert.ok(ui.includes("img.loading='lazy'"),'photos lazy-load');
  assert.ok(ui.includes("e.key==='Escape'"),'Esc dismisses the lightbox');
  assert.ok(ui.includes("inCurrentSeason(listing)"),'season gate present');
  assert.ok(ui.includes(".catch(()=>{})")||ui.includes('.catch(()=>{'),'fetch failure renders nothing');
  assert.ok(css.includes('.map-popup__photo img{')&&css.includes('.photo-lightbox{'),'popup photo and lightbox styles exist');
});
