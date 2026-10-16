const test=require('node:test');
const assert=require('node:assert/strict');
const hostLinkHandler=require('../api/host-link');
const hostUpdateHandler=require('../api/host-update');
const feedbackHandler=require('../api/feedback');
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}}}
function request(method,body,headers={}){return {method,body,headers:{'content-type':'application/json',...headers},query:{}}}
function redisMock(store,rates){
  return async(url,opts)=>{const c=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer test-token');
    if(c[0]==='GET')return {ok:true,json:async()=>({result:store.has(c[1])?store.get(c[1]):null})};
    if(c[0]==='SET'){store.set(c[1],c[2]);return {ok:true,json:async()=>({result:'OK'})}}
    if(c[0]==='DEL'){const had=store.has(c[1]);store.delete(c[1]);return {ok:true,json:async()=>({result:had?1:0})}}
    if(c[0]==='KEYS'){const prefix=c[1].slice(0,-1);return {ok:true,json:async()=>({result:[...store.keys()].filter(k=>k.startsWith(prefix))})}}
    if(c[0]==='LPUSH'){store.set(c[1],[c[2],...(store.get(c[1])||[])]);return {ok:true,json:async()=>({result:store.get(c[1]).length})}}
    if(c[0]==='LRANGE')return {ok:true,json:async()=>({result:store.get(c[1])||[]})};
    if(c[0]==='EVAL'){const n=(rates.get(c[2])||0)+1;rates.set(c[2],n);const cap=c[1].includes('3600')?5:5;return {ok:true,json:async()=>({result:n>cap?0:1})}}
    throw new Error('unexpected redis command '+c[0])};
}
function envSetup(){const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','CRON_SECRET'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';process.env.CRON_SECRET='x'.repeat(32);return{keys,saved}}
function envRestore({keys,saved}){for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}}
test('host-link API: admin mint/revoke/list plus public token check',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    const admin={'authorization':'Bearer '+'x'.repeat(32)},store=new Map(),rates=new Map();
    global.fetch=redisMock(store,rates);
    let res=response();await hostLinkHandler(request('POST',{num:1,action:'mint'},{}),res);assert.equal(res.statusCode,403,'non-admin denied');
    res=response();await hostLinkHandler(request('GET',null,{}),res);assert.equal(res.statusCode,403,'non-admin list-all denied');
    res=response();await hostLinkHandler(request('DELETE',null,admin),res);assert.equal(res.statusCode,405);
    res=response();await hostLinkHandler(request('POST',{num:'x',action:'mint'},admin),res);assert.equal(res.statusCode,400,'non-integer num rejected');
    res=response();await hostLinkHandler(request('POST',{num:999,action:'mint'},admin),res);assert.equal(res.statusCode,404,'unknown listing rejected');
    res=response();await hostLinkHandler(request('POST',{num:1,action:'mint'},admin),res);
    assert.equal(res.statusCode,201);const token=res.body.token;
    assert.ok(token&&/^[\w-]{43}$/.test(token),'32-byte url-safe token');
    assert.equal(res.body.url,'/?update='+token);
    const stored=JSON.parse(store.get('hauntfinder:2026:hostlinks:'+token));
    assert.deepEqual(Object.keys(stored).sort(),['createdAt','num'],'exact {num, createdAt} value shape');
    assert.equal(stored.num,1);assert.ok(stored.createdAt,'createdAt present');
    res=response();await hostLinkHandler({method:'GET',query:{token},headers:{}},res);
    assert.equal(res.statusCode,200);assert.deepEqual(Object.keys(res.body).sort(),['name','num','town','valid']);
    assert.equal(res.body.valid,true);assert.equal(res.body.num,1);
    assert.ok(res.body.name&&res.body.town,'listing identity returned');
    assert.ok(!JSON.stringify(res.body).includes(token),'token never echoed by the public check');
    res=response();await hostLinkHandler({method:'GET',query:{token:'no-such-token-1234567890'},headers:{}},res);
    assert.equal(res.statusCode,404);assert.equal(res.body.valid,false);
    res=response();await hostLinkHandler(request('POST',{num:1,action:'list'},admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.links.length,1);assert.equal(res.body.links[0].num,1);
    res=response();await hostLinkHandler(request('POST',{token,action:'revoke'},admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.revoked,true);
    res=response();await hostLinkHandler({method:'GET',query:{token},headers:{}},res);
    assert.equal(res.statusCode,404,'revoked token invalid');assert.equal(res.body.valid,false);
    res=response();await hostLinkHandler(request('POST',{token,action:'revoke'},admin),res);assert.equal(res.statusCode,404,'revoking twice is unknown');
    for(let i=0;i<210;i++)store.set('hauntfinder:2026:hostlinks:seed-'+String(i).padStart(4,'0'),JSON.stringify({num:1,createdAt:'2026-10-14T00:00:00Z'}));
    res=response();await hostLinkHandler(request('GET',null,admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.links.length,200,'list-all capped at 200');
    global.fetch=async()=>{throw Error('offline')};res=response();await hostLinkHandler(request('GET',null,admin),res);assert.equal(res.statusCode,503);
    delete process.env.UPSTASH_REDIS_REST_URL;res=response();await hostLinkHandler(request('GET',null,admin),res);assert.equal(res.statusCode,503,'unconfigured fails closed');
  }finally{global.fetch=originalFetch;envRestore(env)}
});
test('host-update API full flow',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    delete process.env.UPSTASH_REDIS_REST_URL;
    let res=response();await hostUpdateHandler(request('POST',{}),res);assert.equal(res.statusCode,503,'unconfigured fails closed');
    process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';
    const store=new Map(),rates=new Map();global.fetch=redisMock(store,rates);
    const token='host-token-abcdef1234567890',token8='host-token-for-house-8-x';
    store.set('hauntfinder:2026:hostlinks:'+token,JSON.stringify({num:1,createdAt:'2026-10-14T00:00:00Z'}));
    store.set('hauntfinder:2026:hostlinks:'+token8,JSON.stringify({num:8,createdAt:'2026-10-14T00:00:00Z'}));
    const valid={token,dates:'Oct 28–31',hours:'6–10 PM',details:'New graveyard scene',closures:'',email:'host@example.com'};
    res=response();await hostUpdateHandler(request('POST',{...valid,token:undefined}),res);assert.equal(res.statusCode,403,'missing token rejected');
    res=response();await hostUpdateHandler(request('POST',{...valid,token:'unknown-token-abcdef123456'}),res);assert.equal(res.statusCode,403,'unknown token rejected');
    res=response();await hostUpdateHandler(request('POST',{...valid,email:'not-an-email'}),res);assert.equal(res.statusCode,400,'bad email rejected');
    res=response();await hostUpdateHandler(request('POST',{token,dates:'',hours:'',details:'',closures:''}),res);assert.equal(res.statusCode,400,'empty submission rejected');
    res=response();await hostUpdateHandler(request('POST',valid),res);assert.equal(res.statusCode,201);assert.equal(res.body.received,true);
    const key='hauntfinder:2026:reviews:1',rows=store.get(key);
    assert.equal(rows.length,1);
    const record=JSON.parse(rows[0]);
    assert.equal(record.kind,'update-request');assert.equal(record.house,1);
    assert.equal(record.dates,valid.dates);assert.equal(record.email,valid.email);assert.ok(record.id&&record.timestamp);
    res=response();await hostUpdateHandler(request('POST',{token:token8,dates:'Halloween only'}),res);assert.equal(res.statusCode,201);
    assert.ok(store.has('hauntfinder:2026:reviews:8:drakestown-road-2026'),'reused slot 8 uses the entityId review key');
    rates.clear();
    for(let i=0;i<5;i++){res=response();await hostUpdateHandler(request('POST',{...valid,dates:'Update '+i}),res);assert.equal(res.statusCode,201)}
    res=response();await hostUpdateHandler(request('POST',valid),res);assert.equal(res.statusCode,429,'6th submission in an hour rejected');
    const visitor=JSON.stringify({id:'v1',house:1,name:'Visitor',rating:5,comment:'Great!',timestamp:'2026-10-14T00:00:00Z'});
    store.get(key).push(visitor);
    res=response();await feedbackHandler({method:'GET',query:{house:'1'},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.reviews.length,1,'feedback GET hides update-requests');
    assert.equal(res.body.reviews[0].id,'v1');
    global.fetch=async()=>{throw Error('offline')};res=response();await hostUpdateHandler(request('POST',valid),res);assert.equal(res.statusCode,503);
  }finally{global.fetch=originalFetch;envRestore(env)}
});
test('host update wiring: scripts included, review filter present, preamble untouched',()=>{
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('node:child_process');
  const ROOT=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const ui=fs.readFileSync(path.join(ROOT,'host-update-ui.js'),'utf8');
  const feedback=fs.readFileSync(path.join(ROOT,'api/feedback.js'),'utf8');
  const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(html.indexOf('host-update-ui.js')>html.indexOf('blob-client.js'),'host panel script loads after the blob client bundle');
  assert.ok(ui.includes('HFBlob.upload'),'photo upload uses the vendored blob client');
  assert.ok(ui.includes("fetch('/api/host-update'"),'update form posts to the host-update route');
  assert.ok(ui.includes('Your photo is live')&&ui.includes('Your photo goes live right away.')&&!ui.includes('photo appears on the site once the organizer reviews'),'auto-publish copy is honest (update requests are still reviewed)');
  assert.ok(feedback.includes("r.kind!=='update-request'"),'public review reads filter update-requests');
  assert.equal(hash(app),hash(head),'app.js preamble hash unchanged');
});
