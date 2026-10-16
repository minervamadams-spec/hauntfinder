const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {getPayloadFromClientToken}=require('@vercel/blob/client');
const handler=require('../api/upload');
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}}}
function request(body,headers={}){return {method:'POST',url:'/api/upload',body,headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.1',...headers},query:{}}}
function mintBody(contentType,extra={}){return {type:'blob.generate-client-token',payload:{pathname:'photos/3/front-porch.jpg',multipart:false,clientPayload:JSON.stringify({listingNum:3,contentType,...extra})}}}
function completedBody(){return {type:'blob.upload-completed',payload:{blob:{url:'https://blob.vercel-storage.com/photos/3/front-porch.jpg',pathname:'photos/3/front-porch.jpg',contentType:'image/jpeg'},tokenPayload:JSON.stringify({listingNum:3})}}}
test('upload API: type allowlist, size cap, dual auth, rate limit, photo record published immediately',async()=>{
  const originalFetch=global.fetch;
  const envKeys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','CRON_SECRET','BLOB_READ_WRITE_TOKEN'];
  const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
  try{
    delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;delete process.env.CRON_SECRET;delete process.env.BLOB_READ_WRITE_TOKEN;
    let res=response();await handler(request(mintBody('image/jpeg')),res);assert.equal(res.statusCode,503,'storage not configured -> coming soon');
    process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
    process.env.CRON_SECRET='x'.repeat(32);process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_teststore_testsecret';
    const store=new Map(),rates=new Map();
    global.fetch=async(url,opts)=>{const c=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer test-token');
      if(c[0]==='GET')return {ok:true,json:async()=>({result:store.has(c[1])?store.get(c[1]):null})};
      if(c[0]==='LPUSH'){store.set(c[1],[c[2],...(store.get(c[1])||[])]);return {ok:true,json:async()=>({result:store.get(c[1]).length})}}
      if(c[0]==='EVAL'){const n=(rates.get(c[2])||0)+1;rates.set(c[2],n);return {ok:true,json:async()=>({result:n>10?0:1})}}
      throw new Error('unexpected redis command '+c[0])};
    store.set('hauntfinder:2026:hostlinks:good-host-token-1234',JSON.stringify({num:3}));
    const admin={'authorization':'Bearer '+'x'.repeat(32)};
    res=response();await handler({method:'GET',url:'/api/upload',headers:{}},res);assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,'POST');
    res=response();const other=request(mintBody('image/jpeg'),{});other.url='/api/other';await handler(other,res);assert.equal(res.statusCode,404,'wrong path rejected');
    res=response();await handler(request('{'),res);assert.equal(res.statusCode,400);
    res=response();await handler(request({type:'blob.generate-client-token'}),res);assert.equal(res.statusCode,400,'missing payload rejected');
    for(const contentType of ['image/jpeg','image/png','image/webp','image/gif']){
      res=response();await handler(request(mintBody(contentType),admin),res);
      assert.equal(res.statusCode,200,contentType+' accepted');assert.equal(res.body.type,'blob.generate-client-token');assert.ok(res.body.clientToken);
      assert.ok(!JSON.stringify(res.body).includes('test-token')&&!JSON.stringify(res.body).includes('testsecret'),'no storage tokens echoed');
      const decoded=getPayloadFromClientToken(res.body.clientToken);
      assert.equal(decoded.maximumSizeInBytes,5*1024*1024,'5 MB cap in minted token');
      assert.deepEqual(decoded.allowedContentTypes,['image/jpeg','image/png','image/webp','image/gif']);
    }
    for(const contentType of ['image/svg+xml','application/pdf','application/x-msdownload','text/html','']){
      res=response();await handler(request(mintBody(contentType),admin),res);
      assert.equal(res.statusCode,400,contentType+' rejected before minting');assert.equal(res.body.clientToken,undefined);
    }
    res=response();await handler(request(mintBody('image/jpeg',{listingNum:100}),admin),res);assert.equal(res.statusCode,200,'admin may mint for any listing');
    res=response();await handler(request(mintBody('image/jpeg')),res);assert.equal(res.statusCode,403,'no credential at all rejected');
    res=response();await handler(request(mintBody('image/jpeg',{token:'short'})),res);assert.equal(res.statusCode,403,'malformed host token rejected');
    res=response();await handler(request(mintBody('image/jpeg',{token:'unknown-host-token-9999'})),res);assert.equal(res.statusCode,403,'unknown host token rejected');
    res=response();await handler(request(mintBody('image/jpeg',{token:'good-host-token-1234',listingNum:4})),res);assert.equal(res.statusCode,403,'host token bound to a different listing rejected');
    res=response();await handler(request(mintBody('image/jpeg',{token:'good-host-token-1234'})),res);assert.equal(res.statusCode,200,'matching host token accepted');
    rates.clear();
    for(let i=0;i<10;i++){res=response();await handler(request(mintBody('image/jpeg'),admin),res);assert.equal(res.statusCode,200)}
    res=response();await handler(request(mintBody('image/jpeg'),admin),res);assert.equal(res.statusCode,429,'11th mint in an hour rejected');
    const body=completedBody(),signature=createHmac('sha256',process.env.BLOB_READ_WRITE_TOKEN).update(JSON.stringify(body)).digest('hex');
    res=response();await handler(request(body,{'x-vercel-signature':signature}),res);assert.equal(res.statusCode,200,'signed upload-completed accepted');
    const rows=store.get('hauntfinder:2026:photos:3');assert.equal(rows.length,1);
    const photo=JSON.parse(rows[0]);assert.equal(photo.status,'approved');assert.equal(photo.url,body.payload.blob.url);assert.equal(photo.pathname,body.payload.blob.pathname);assert.ok(photo.id);assert.ok(photo.uploadedAt);
    assert.equal(store.has('hauntfinder:2026:reviews:3'),false,'review namespace untouched');
    res=response();await handler(request(body,{'x-vercel-signature':'deadbeef'}),res);assert.equal(res.statusCode,400,'bad signature rejected');
    res=response();await handler(request(body),res);assert.equal(res.statusCode,400,'missing signature rejected');
    global.fetch=async()=>{throw Error('offline')};res=response();await handler(request(mintBody('image/jpeg'),admin),res);assert.equal(res.statusCode,400,'storage outage surfaces as plain failure, never a token');
  }finally{
    global.fetch=originalFetch;
    for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}
  }
});
