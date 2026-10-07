const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/feedback');
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}}}
function request(body){return {method:'POST',body,headers:{host:'hauntfinder.vercel.app',origin:'https://hauntfinder.vercel.app','content-type':'application/json','x-forwarded-for':'192.0.2.1'},query:{}}}
test('feedback API validates, persists, isolates homes and handles failures',async()=>{
  const originalFetch=global.fetch,originalUrl=process.env.UPSTASH_REDIS_REST_URL,originalToken=process.env.UPSTASH_REDIS_REST_TOKEN;
  try{
    delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
    let res=response();await handler({method:'GET',query:{house:'1'},headers:{}},res);assert.equal(res.statusCode,503);
    process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
    const rows=new Map(),rates=new Map();let calls=0;
    global.fetch=async(url,opts)=>{calls++;const c=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer test-token');if(c[0]==='LRANGE')return {ok:true,json:async()=>({result:rows.get(c[1])||[]})};assert.equal(c[0],'EVAL');assert.equal(c[2],2);const n=(rates.get(c[3])||0)+1;rates.set(c[3],n);if(n>5)return {ok:true,json:async()=>({result:0})};rows.set(c[4],[c[5],...(rows.get(c[4])||[])]);return {ok:true,json:async()=>({result:1})}};
    const valid={house:1,name:'  Visitor  ',rating:5,comment:'Loved the display!',timestamp:'1990-01-01',website:''};
    for(const change of [{rating:0},{rating:6},{rating:1.5},{house:100},{name:' '},{comment:' '},{comment:'x'.repeat(1501)},{website:'spam'}]){res=response();await handler(request({...valid,...change}),res);assert.equal(res.statusCode,400)}assert.equal(calls,0);
    res=response();const foreign=request(valid);foreign.headers.origin='https://other.example';await handler(foreign,res);assert.equal(res.statusCode,403);
    res=response();const malformed=request('{');await handler(malformed,res);assert.equal(res.statusCode,400);
    res=response();await handler(request(valid),res);assert.equal(res.statusCode,201);const review=res.body.reviews[0];assert.equal(review.name,'Visitor');assert.equal(review.comment,valid.comment);assert.equal(review.rating,5);assert.ok(Math.abs(Date.now()-Date.parse(review.timestamp))<5000);assert.ok(review.id);assert.ok(!JSON.stringify(res.body).includes('test-token'));
    res=response();await handler({method:'GET',headers:{},query:{house:'2'}},res);assert.deepEqual(res.body.reviews,[]);
    res=response();await handler({method:'GET',headers:{},query:{house:'1'}},res);assert.equal(res.body.reviews.length,1);
    for(let i=0;i<4;i++){res=response();await handler(request(valid),res);assert.equal(res.statusCode,201)}res=response();await handler(request(valid),res);assert.equal(res.statusCode,429);assert.equal(rows.get('hauntfinder:2026:reviews:1').length,5);
    global.fetch=async()=>{throw Error('offline')};res=response();await handler({method:'GET',headers:{},query:{house:'1'}},res);assert.equal(res.statusCode,503);
    res=response();await handler({method:'DELETE',headers:{},query:{}},res);assert.equal(res.statusCode,405);
  }finally{global.fetch=originalFetch;if(originalUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=originalUrl;if(originalToken===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=originalToken}
});
