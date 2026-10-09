const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const n=require('../lib/newsletter');

function fixture(){
 const originalFetch=global.fetch,oldEnv={...process.env},db=new Map(),sent=[],contacts=new Map();let failSend=false;
 Object.assign(process.env,{BREVO_API_KEY:'test-key-only',CRON_SECRET:'a'.repeat(40),UPSTASH_REDIS_REST_URL:'https://storage.invalid',UPSTASH_REDIS_REST_TOKEN:'test-token',SUBSCRIBER_SHEET_URL:'https://script.google.com/macros/s/test/exec',NEWSLETTER_ENABLED:'true'});
 const respond=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
 function set(key,value,args=[]){if(args.includes('NX')&&db.has(key))return null;db.set(key,value);return 'OK'}
 function incr(key){const value=Number(db.get(key)||0)+1;db.set(key,value);return value}
 function sadd(key,...values){const s=db.get(key)||new Set();values.forEach(x=>s.add(x));db.set(key,s);return 1}
 function srem(key,...values){const s=db.get(key)||new Set();values.forEach(x=>s.delete(x));return 1}
 function command(c){const [op,key,...args]=c;
  if(op==='PING')return 'PONG';if(op==='GET')return db.get(key)||null;if(op==='SET')return set(key,args[0],args.slice(1));if(op==='DEL'){db.delete(key);return 1}if(op==='SADD')return sadd(key,...args);if(op==='SREM')return srem(key,...args);if(op==='SMEMBERS')return [...(db.get(key)||[])];
  if(op==='EVAL'){
   const script=key,count=args[0],keys=args.slice(1,1+count),values=args.slice(1+count);
   if(script.includes('local a=')){const a=incr(keys[0]),b=incr(keys[1]);return a>8||b>3?0:1}
   if(script.includes('local n='))return incr(keys[0])>280?0:1;
   if(script.includes('~=ARGV[1]')){if(db.get(keys[0])!==values[0])return 0;db.set(keys[0],values[1]);db.set(keys[1],values[2]);sadd(keys[2],values[3]);return 1}
   if(script.includes("redis.call('SET',KEYS[2]")){db.set(keys[0],values[0]);db.set(keys[1],values[1]);sadd(keys[2],values[2]);return 1}
   if(script.includes("'SREM'"))return db.get(keys[0])===values[0]?srem(keys[1],values[1]):0;
   if(script.includes("'DEL'")){if(db.get(keys[0])===values[0])db.delete(keys[0]);return 1}
  }
  throw new Error('Unhandled fake Redis command '+op);
 }
 global.fetch=async(url,options={})=>{
  if(url==='https://storage.invalid')return respond({result:command(JSON.parse(options.body))});
  if(String(url).startsWith('https://script.google.com/'))return respond({ok:true});
  assert.ok(String(url).startsWith('https://api.brevo.com/v3/'),'No real service calls allowed');
  const path=String(url).slice('https://api.brevo.com/v3'.length),body=options.body?JSON.parse(options.body):{};
  if(path==='/smtp/email'){if(failSend)throw new Error('Network timeout');sent.push(body);return respond({messageId:'test-'+sent.length},201)}
  if(path==='/contacts'&&options.method==='POST'){contacts.set(body.email,{email:body.email,emailBlacklisted:body.emailBlacklisted});return respond({id:1},201)}
  if(path.startsWith('/contacts/')){const email=decodeURIComponent(path.slice('/contacts/'.length));if(options.method==='PUT'){contacts.set(email,{...contacts.get(email),...body});return respond({},204)}return contacts.has(email)?respond(contacts.get(email)):respond({},404)}
  throw new Error('Unhandled fake Brevo request '+path);
 };
 return {db,sent,contacts,fail:()=>{failSend=true},restore:()=>{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv)}};
}
const signup={email:'person@example.com',categories:['displays'],seasons:['halloween'],consent:true};
function subscriber(f){const key=[...f.db.keys()].find(x=>x.startsWith(n.PREFIX+'subscriber:'));return {key,data:JSON.parse(f.db.get(key))}}
async function confirmed(f,preferences=signup){await n.subscribe(preferences,'127.0.0.1');const {data}=subscriber(f);await n.confirm(n.token('confirm',data.id,data.version));return subscriber(f).data}
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.statusCode=code;return this},json(value){this.data=value;return this}}}

test('confirmation, empty summary, updates, stable slot reuse and unsubscribe',async()=>{
 const f=fixture();try{
  const s=await confirmed(f);assert.equal(s.status,'confirmed');assert.equal(f.sent.length,1);
  const items=n.catalog();assert.equal(items.length,13);assert.equal((await n.digest(items)).sent,0);
  const edited=items.map(x=>({...x,times:'Updated hours',updatedAt:'2026-10-10'}));assert.equal((await n.digest(edited)).sent,0);
  const event={identity:'new-event',category:'events',season:'halloween',name:'New event'};
  const holiday={identity:'new-holiday',category:'displays',season:'holiday',name:'Holiday display'};
  assert.equal((await n.digest([...items,event,holiday])).sent,0);
  const replacement={...items.find(x=>x.num===8),entityId:'different-host',identity:'replacement-display-8',name:'<New display>'};
  assert.equal((await n.digest([...items.filter(x=>x.num!==8),replacement])).sent,1);
  assert.ok(f.sent[1].htmlContent.includes('&lt;New display&gt;'));assert.ok(f.sent[1].headers['List-Unsubscribe-Post']);
  assert.ok(n.listingLink(replacement).includes('entity=different-host'));
  assert.equal((await n.digest([...items,replacement])).sent,0);
  await n.unsubscribe(n.token('unsubscribe',s.id,s.version));
  assert.equal(subscriber(f).data.status,'unsubscribed');assert.equal((await n.digest([...items,{...replacement,identity:'another-new'}])).sent,0);
 }finally{f.restore()}
});
test('pending users cannot receive summaries; preferences require fresh confirmation',async()=>{
 const f=fixture();try{
  await n.subscribe(signup,'ip');const initial=subscriber(f).data;assert.equal(initial.status,'pending');assert.equal((await n.digest()).sent,0);
  await n.confirm(n.token('confirm',initial.id,initial.version));
  await n.subscribe({...signup,categories:['events'],seasons:['holiday']},'ip');
  assert.deepEqual(subscriber(f).data.categories,['displays']);
  const pending=JSON.parse(f.db.get(n.PREFIX+'pending:'+initial.id));
  await assert.rejects(n.confirm(n.token('confirm',initial.id,'forged-version')));
  await n.confirm(n.token('confirm',initial.id,pending.version));assert.deepEqual(subscriber(f).data.categories,['events']);assert.deepEqual(subscriber(f).data.seasons,['holiday']);
  await assert.rejects(n.unsubscribe(n.token('unsubscribe',initial.id,initial.version)));
 }finally{f.restore()}
});
test('ambiguous email outcome holds the attempt and never retries automatically',async()=>{
 const f=fixture();try{
  await confirmed(f);f.fail();const entry={...n.catalog()[0],identity:'new-uncertain'};
  assert.equal((await n.digest([entry])).held,1);assert.ok(subscriber(f).data.pendingDelivery);
  assert.equal((await n.digest([entry])).held,1);assert.equal(f.sent.length,1);
 }finally{f.restore()}
});
test('Brevo opt-out is honored and no message is sent',async()=>{
 const f=fixture();try{await confirmed(f);f.contacts.get(signup.email).emailBlacklisted=true;const result=await n.digest([{...n.catalog()[0],identity:'new-suppressed'}]);assert.equal(result.suppressed,1);assert.equal(f.sent.length,1);assert.equal(subscriber(f).data.status,'unsubscribed')}finally{f.restore()}
});
test('forged tokens, missing consent, invalid selections and email are rejected',()=>{
 const f=fixture();try{const value=n.token('confirm','a'.repeat(64),'v1');assert.throws(()=>n.readToken(value+'x','confirm'));assert.throws(()=>n.readToken(value,'unsubscribe'));assert.throws(()=>n.prefs({...signup,consent:false}));assert.throws(()=>n.prefs({...signup,categories:['injected']}));assert.throws(()=>n.prefs({...signup,email:'a\nb@example.com'}));assert.equal(n.validSheetUrl('https://attacker.invalid/exec'),false)}finally{f.restore()}
});
test('public GET is read-only; unauthenticated digest, wrong origin and oversized bodies fail',async()=>{
 const f=fixture();try{
  const handler=require('../api/subscriptions'),digest=require('../api/new-listing-digest');
  let res=response();await handler({method:'GET',headers:{},query:{action:'confirm',token:'forged'}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.data,{available:true,prepared:true,catalogReady:true});assert.equal(f.db.size,0);
  res=response();await digest({method:'POST',headers:{authorization:'Bearer invalid'}},res);assert.equal(res.statusCode,401);
  res=response();await handler({method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:{action:'subscribe',...signup}},res);assert.equal(res.statusCode,403);
  res=response();await handler({method:'POST',headers:{origin:n.SITE,'content-type':'application/json','content-length':'6000'},body:{}},res);assert.equal(res.statusCode,413);
  process.env.NEWSLETTER_ENABLED='false';res=response();await handler({method:'POST',headers:{origin:n.SITE,'content-type':'application/json'},body:{action:'subscribe',...signup}},res);assert.equal(res.statusCode,503);assert.equal(f.sent.length,0);
 }finally{f.restore()}
});
test('Google sheet bridge rejects forged/stale signatures and cannot disclose subscribers',()=>{
 const secret='a'.repeat(40),ctx={PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='CRON_SECRET'?secret:'private-id'})},Utilities:{computeHmacSha256Signature:(payload,key)=>[...createHmac('sha256',key).update(payload).digest()]},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>({})})}};
 vm.createContext(ctx);vm.runInContext(readFileSync(require('node:path').join(__dirname,'../scripts/subscriber-sheet.gs'),'utf8'),ctx);
 const request=(data,sig)=>{const payload=JSON.stringify(data);return ctx.doPost({postData:{contents:JSON.stringify({payload,signature:sig||createHmac('sha256',secret).update(payload).digest('hex')})}})};
 assert.equal(request({action:'ping',timestamp:Date.now()}).ok,true);
 assert.equal(request({action:'ping',timestamp:Date.now()},'forged').ok,false);
 assert.equal(request({action:'ping',timestamp:Date.now()-600000}).ok,false);
 assert.equal(request({action:'read',timestamp:Date.now()}).ok,false);
 assert.equal(ctx.literalCell('=IMPORTXML("evil")'),'\'=IMPORTXML("evil")');
});
test('a daily summary is limited to one accepted send per subscriber per Eastern day',async()=>{
 const f=fixture();try{await confirmed(f);const entry={...n.catalog()[0],identity:'first-today'};assert.equal((await n.digest([entry])).sent,1);assert.equal((await n.digest([{...entry,identity:'second-today'}])).sent,0);assert.equal(f.sent.length,2)}finally{f.restore()}
});
test('daily send budget stops safely and keeps a rejected listing eligible',async()=>{
 const f=fixture();try{await confirmed(f);f.db.set(n.PREFIX+'send-budget:'+new Date().toISOString().slice(0,10),280);const result=await n.digest([{...n.catalog()[0],identity:'over-budget'}]);assert.equal(result.quotaReached,true);assert.equal(result.sent,0);assert.equal(subscriber(f).data.pendingDelivery,null);assert.equal(f.sent.length,1)}finally{f.restore()}
});
