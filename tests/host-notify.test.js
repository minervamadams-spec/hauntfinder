const test=require('node:test');
const assert=require('node:assert/strict');
const {notifyHost}=require('../lib/host-notify');
const {SENDER}=require('../lib/newsletter');
const photoReviewHandler=require('../api/photo-review');
const reviewQueueHandler=require('../api/review-queue');
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}}}
function request(method,body,headers={}){return {method,body,headers:{'content-type':'application/json',...headers},query:{}}}
function envSetup(){const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','CRON_SECRET','BREVO_API_KEY'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';process.env.CRON_SECRET='x'.repeat(32);process.env.BREVO_API_KEY='brevo-key';return{keys,saved}}
function envRestore({keys,saved}){for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}}
// fetch mock routing: Upstash REST commands vs Brevo API calls.
function makeMock(store,emails,budget,opts={}){
  return async(url,o)=>{
    if(String(url).includes('api.brevo.com')){
      emails.push(JSON.parse(o.body));
      if(opts.brevoDown)throw Error('brevo offline');
      return {ok:!opts.brevoFail,json:async()=>({})};
    }
    const c=JSON.parse(o.body);assert.equal(o.headers.Authorization,'Bearer test-token');
    if(c[0]==='GET')return {ok:true,json:async()=>({result:store.has(c[1])?store.get(c[1]):null})};
    if(c[0]==='LPUSH'){store.set(c[1],[c[2],...(store.get(c[1])||[])]);return {ok:true,json:async()=>({result:store.get(c[1]).length})}}
    if(c[0]==='LRANGE')return {ok:true,json:async()=>({result:store.get(c[1])||[]})};
    if(c[0]==='LSET'){const list=store.get(c[1]);list[c[2]]=c[3];return {ok:true,json:async()=>({result:'OK'})}}
    if(c[0]==='KEYS'){const prefix=c[1].slice(0,-1);return {ok:true,json:async()=>({result:[...store.keys()].filter(k=>k.startsWith(prefix))})}}
    if(c[0]==='EVAL'){const n=(budget.get(c[3])||0)+1;budget.set(c[3],n);return {ok:true,json:async()=>({result:n>25?0:1})}}
    throw new Error('unexpected command '+c[0]);
  };
}
test('notifyHost: own daily budget, plain-text Brevo payload, never throws',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    const store=new Map(),budget=new Map(),emails=[];
    global.fetch=makeMock(store,emails,budget);
    let calls=0;const counting=global.fetch;global.fetch=async(...a)=>{calls++;return counting(...a)};
    let result=await notifyHost({to:'not-an-email',subject:'S',text:'T'});
    assert.deepEqual(result,{sent:false,reason:'no-email'});assert.equal(calls,0,'no storage or email calls for a bad address');
    result=await notifyHost({to:'host@example.com',subject:'Your Hauntfinder photo is live',text:'Hello there'});
    assert.deepEqual(result,{sent:true});
    assert.equal(emails.length,1);const payload=emails[0];
    assert.equal(payload.sender.email,SENDER);assert.equal(payload.sender.name,'Mount Olive Hauntfinder');
    assert.deepEqual(payload.to,[{email:'host@example.com'}],'host address is the only recipient');
    assert.equal(payload.textContent,'Hello there');assert.equal(payload.htmlContent,undefined,'plain text only');
    assert.ok(!JSON.stringify(payload).includes('brevo-key'),'no credential echo');
    for(let i=0;i<24;i++){result=await notifyHost({to:'host@example.com',subject:'S',text:'T'});assert.equal(result.sent,true)}
    result=await notifyHost({to:'host@example.com',subject:'S',text:'T'});
    assert.deepEqual(result,{sent:false,reason:'budget'},'26th send in a day refused');
    assert.equal(emails.length,25);
    const dayKey=[...budget.keys()][0];
    assert.ok(dayKey.startsWith('mtocommunity:subscribers:v1:notify-budget:'),'dedicated budget key');
    assert.ok(!dayKey.includes('send-budget'),'digest allowance key untouched');
    const failing=makeMock(store,emails,budget,{brevoFail:true});
    const freshBudget=new Map();global.fetch=makeMock(store,emails,freshBudget,{brevoFail:true});
    result=await notifyHost({to:'host@example.com',subject:'S',text:'T'});
    assert.deepEqual(result,{sent:false,reason:'error'},'Brevo failure swallowed');
    global.fetch=makeMock(store,emails,new Map(),{brevoDown:true});
    result=await notifyHost({to:'host@example.com',subject:'S',text:'T'});
    assert.deepEqual(result,{sent:false,reason:'error'},'network failure swallowed');
  }finally{global.fetch=originalFetch;envRestore(env)}
});
test('photo-review approve emails the host when an update-request left an email; reject stays silent',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    const admin={'authorization':'Bearer '+'x'.repeat(32)},store=new Map(),budget=new Map(),emails=[];
    global.fetch=makeMock(store,emails,budget);
    const row=(id,status,extra={}) =>JSON.stringify({id,url:'https://blob/3/'+id+'.jpg',pathname:'photos/3/'+id+'.jpg',status,...extra});
    store.set('hauntfinder:2026:photos:3',[row('keep','pending'),row('gone','pending')]);
    store.set('hauntfinder:2026:reviews:3',[JSON.stringify({id:'u1',house:3,kind:'update-request',dates:'Oct 28–31',email:'host@example.com',timestamp:'2026-10-14T00:00:00Z'}),JSON.stringify({id:'v1',house:3,name:'Visitor',rating:5,comment:'Nice',timestamp:'2026-10-14T00:00:00Z'})]);
    let res=response();await photoReviewHandler(request('POST',{listingNum:3,id:'keep',action:'approve'},admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.photo.status,'approved');assert.equal(res.body.notified,true);
    assert.equal(emails.length,1);assert.equal(emails[0].to[0].email,'host@example.com');assert.equal(emails[0].subject,'Your Hauntfinder photo is live');
    assert.ok(emails[0].textContent.includes('map')&&!emails[0].textContent.includes('undefined'),'honest copy with listing name filled');
    res=response();await photoReviewHandler(request('POST',{listingNum:3,id:'gone',action:'reject'},admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.notified,undefined,'reject does not notify');assert.equal(emails.length,1);
    store.set('hauntfinder:2026:photos:3',[row('solo','pending')]);
    store.set('hauntfinder:2026:reviews:3',[JSON.stringify({id:'u2',house:3,kind:'update-request',dates:'x',timestamp:'2026-10-14T00:00:00Z'})]);
    res=response();await photoReviewHandler(request('POST',{listingNum:3,id:'solo',action:'approve'},admin),res);
    assert.equal(res.body.notified,false,'no email on file -> approved but not notified');
    const brevoEmails=emails.length;
    global.fetch=makeMock(store,emails,new Map(),{brevoFail:true});
    store.set('hauntfinder:2026:photos:3',[row('wobbly','pending')]);
    store.set('hauntfinder:2026:reviews:3',[JSON.stringify({id:'u3',house:3,kind:'update-request',dates:'x',email:'host@example.com',timestamp:'2026-10-14T00:00:00Z'})]);
    res=response();await photoReviewHandler(request('POST',{listingNum:3,id:'wobbly',action:'approve'},admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.photo.status,'approved');assert.equal(res.body.notified,false,'email failure never fails the approval');
    assert.equal(emails.length,brevoEmails+1,'attempt was made exactly once');
  }finally{global.fetch=originalFetch;envRestore(env)}
});
test('review-queue: admin-only, hasEmail-only GET, resolve appends resolvedAt and notifies',async()=>{
  const env=envSetup(),originalFetch=global.fetch;
  try{
    const admin={'authorization':'Bearer '+'x'.repeat(32)},store=new Map(),budget=new Map(),emails=[];
    global.fetch=makeMock(store,emails,budget);
    const req=(id,extra) =>JSON.stringify({id,house:1,kind:'update-request',dates:'Oct 28–31',hours:'6–10 PM',details:'New scene',closures:'',timestamp:'2026-10-14T00:00:00Z',...extra});
    store.set('hauntfinder:2026:reviews:1',[req('u1',{email:'host@example.com'}),req('u2'),req('u3',{resolvedAt:'2026-10-13T00:00:00Z'})]);
    store.set('hauntfinder:2026:reviews:8:drakestown-road-2026',[req('u8',{house:8,email:'eight@example.com'})]);
    store.set('hauntfinder:2026:reviews:1',store.get('hauntfinder:2026:reviews:1'));
    let res=response();await reviewQueueHandler(request('GET',null,{}),res);assert.equal(res.statusCode,403);
    res=response();await reviewQueueHandler(request('DELETE',null,admin),res);assert.equal(res.statusCode,405);
    res=response();await reviewQueueHandler(request('GET',null,admin),res);
    assert.equal(res.statusCode,200);assert.equal(res.body.updates.length,3,'resolved record excluded; plain and entity-suffixed keys both scanned');
    assert.deepEqual(Object.keys(res.body.updates[0]).sort(),['closures','dates','details','hasEmail','hours','house','id','listingName','timestamp']);
    assert.ok(res.body.updates.every(u=>typeof u.hasEmail==='boolean'));
    assert.ok(!JSON.stringify(res.body).includes('host@example.com')&&!JSON.stringify(res.body).includes('eight@example.com'),'emails never appear in the GET payload');
    res=response();await reviewQueueHandler(request('POST',{house:'x',id:'u1',action:'resolve'},admin),res);assert.equal(res.statusCode,400);
    res=response();await reviewQueueHandler(request('POST',{house:1,id:'u1',action:'merge'},admin),res);assert.equal(res.statusCode,400);
    res=response();await reviewQueueHandler(request('POST',{house:1,id:'nope',action:'resolve'},admin),res);assert.equal(res.statusCode,404);
    res=response();await reviewQueueHandler(request('POST',{house:1,id:'u1',action:'resolve'},admin),res);
    assert.equal(res.statusCode,200);assert.deepEqual(res.body,{resolved:true,notified:true});
    const stored=JSON.parse(store.get('hauntfinder:2026:reviews:1').find(r=>JSON.parse(r).id==='u1'));
    assert.equal(stored.kind,'update-request');assert.ok(stored.resolvedAt,'resolvedAt appended, kind kept');
    assert.equal(emails.length,1);assert.equal(emails[0].to[0].email,'host@example.com');
    assert.ok(emails[0].textContent.includes('next listing update'),'honest resolution copy');
    res=response();await reviewQueueHandler(request('POST',{house:1,id:'u2',action:'resolve'},admin),res);
    assert.deepEqual(res.body,{resolved:true,notified:false},'no email -> resolved without notify');
    assert.equal(emails.length,1,'no second email');
    res=response();await reviewQueueHandler(request('GET',null,admin),res);
    assert.equal(res.body.updates.length,1);assert.equal(res.body.updates[0].id,'u8');
    store.set('hauntfinder:2026:reviews:5',Array.from({length:210},(_,i)=>req('q'+i)));
    res=response();await reviewQueueHandler(request('GET',null,admin),res);
    assert.equal(res.body.updates.length,200,'queue capped at 200');
    delete process.env.UPSTASH_REDIS_REST_URL;res=response();await reviewQueueHandler(request('GET',null,admin),res);assert.equal(res.statusCode,503,'unconfigured fails closed');
  }finally{global.fetch=originalFetch;envRestore(env)}
});
