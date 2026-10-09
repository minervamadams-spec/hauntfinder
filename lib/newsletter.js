const {createHmac,randomBytes,timingSafeEqual,createHash}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const SITE='https://hauntfinder.vercel.app';
const PREFIX='mtocommunity:subscribers:v1:';
const SENDER='MTOCommunityFinder@gmail.com';
const CONSENT='new-listings-v1';
const CATEGORIES=['displays','events','treats'];
const SEASONS=['halloween','holiday'];
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const secret=()=>process.env.CRON_SECRET;
const hash=s=>createHash('sha256').update(s).digest('hex');
const hmac=s=>createHmac('sha256',secret()).update(s).digest('hex');
function configured(){return Boolean(process.env.BREVO_API_KEY&&secret()?.length>=32&&storageUrl()&&storageToken())}
function enabled(){return configured()&&process.env.NEWSLETTER_ENABLED==='true'&&validSheetUrl(process.env.SUBSCRIBER_SHEET_URL)}
function validSheetUrl(s){try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)}catch{return false}}
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
 const r=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
 const d=await r.json();if(!r.ok||d.error)throw new Error('Subscriber storage unavailable');return d.result;
}
async function get(key){const v=await redis(['GET',PREFIX+key]);return v?typeof v==='string'?JSON.parse(v):v:null}
async function put(key,value,...args){return redis(['SET',PREFIX+key,JSON.stringify(value),...args])}
async function brevo(path,method='GET',body){
 const r=await fetch('https://api.brevo.com/v3'+path,{method,headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json',Accept:'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok){const e=new Error('Email service request failed');e.status=r.status;throw e}return d;
}
function token(action,id,version){const payload=Buffer.from(JSON.stringify({action,id,version})).toString('base64url');return payload+'.'+hmac(payload)}
function readToken(value,action){
 if(typeof value!=='string'||value.length>700)throw new Error('Invalid link');
 const [payload,sig,...extra]=value.split('.');const expected=hmac(payload||'');
 if(extra.length||!sig||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw new Error('Invalid link');
 const d=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(d.action!==action||!/^\w{64}$/.test(d.id)||typeof d.version!=='string')throw new Error('Invalid link');return d;
}
function catalog(){
 const src=readFileSync(join(__dirname,'../app.js'),'utf8').split('const filters=')[0];const ctx={};
 vm.runInNewContext(src+';this.data={listings,events};',ctx,{timeout:500});
 const season=process.env.COMMUNITY_SEASON==='holiday'?'holiday':'halloween';
 return [...ctx.data.listings.filter(x=>!x.placeholder).map(x=>({...x,category:x.kind==='Trick-or-treat stop'?'treats':'displays',identity:x.entityId||'hauntfinder:2026:listing:'+x.num+':original'})),...ctx.data.events.map(x=>({...x,category:'events',identity:x.entityId||x.id}))].map(x=>({...x,season}));
}
function prefs(body){
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(email.length>254||! /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))throw new Error('Enter a valid email address.');
 const select=(values,allowed)=>Array.isArray(values)&&values.length&&values.length<=allowed.length&&values.every(x=>allowed.includes(x))?[...new Set(values)]:null;
 const categories=select(body.categories,CATEGORIES),seasons=select(body.seasons,SEASONS);
 if(!categories||!seasons||body.consent!==true)throw new Error('Choose your categories and seasons, and agree to receive updates.');
 return {email,categories,seasons};
}
async function reserveSend(){const day=new Date().toISOString().slice(0,10);return redis(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],172800) end;if n>280 then return 0 end;return 1",1,PREFIX+'send-budget:'+day])}
async function send(email,subject,html,unsubscribe){
 if(!await reserveSend()){const e=new Error('Daily email allowance reached');e.status=429;throw e}
 const body={sender:{name:'Mount Olive Hauntfinder',email:SENDER},replyTo:{email:SENDER,name:'Mount Olive Community Finder'},to:[{email}],subject,htmlContent:html,tags:['community-finder']};
 if(unsubscribe)body.headers={'List-Unsubscribe':'<'+unsubscribe+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'};
 return brevo('/smtp/email','POST',body);
}
async function markDirty(id){await redis(['SADD',PREFIX+'dirty',id])}
async function subscribe(body,ip){
 const p=prefs(body);const id=hmac('subscriber:'+p.email);
 const allowed=await redis(['EVAL',"local a=redis.call('INCR',KEYS[1]);local b=redis.call('INCR',KEYS[2]);if a==1 then redis.call('EXPIRE',KEYS[1],3600) end;if b==1 then redis.call('EXPIRE',KEYS[2],3600) end;if a>8 or b>3 then return 0 end;return 1",2,PREFIX+'rate-ip:'+hmac(ip),PREFIX+'rate-email:'+id]);
 if(!allowed){const e=new Error('Please wait before requesting another confirmation email.');e.status=429;throw e}
 const pending={...p,id,version:randomBytes(24).toString('hex'),signedUpAt:new Date().toISOString(),baseline:catalog().map(x=>x.identity),consentVersion:CONSENT};
 await put('pending:'+id,pending,'EX',86400);
 const existing=await get('subscriber:'+id);
 if(!existing){await put('subscriber:'+id,{...pending,status:'pending',lastChangedAt:pending.signedUpAt},'EX',604800);await markDirty(id)}
 const link=SITE+'/alerts.html?action=confirm&token='+encodeURIComponent(token('confirm',id,pending.version));
 await send(p.email,'Confirm your community listing alerts',`<h1>Confirm your listing alerts</h1><p>You requested daily summaries for ${escape(p.seasons.join(', '))} listings in ${escape(p.categories.join(', '))}.</p><p><a href="${escape(link)}">Confirm my email and choices</a></p><p>This link expires in 24 hours. We send a summary only when new listings match your choices. If you did not request this, ignore this email.</p><p>This inbox is not monitored. Use Contact Us on <a href="${SITE}">the website</a>.</p>`);
 return {message:'Check your inbox for the confirmation email. Your choices take effect after you confirm.'};
}
async function confirm(value){
 const d=readToken(value,'confirm'),p=await get('pending:'+d.id);
 if(!p||p.version!==d.version){const existing=await get('subscriber:'+d.id);if(existing?.version===d.version&&existing.status==='confirmed')return {message:'Your email is already confirmed.'};throw new Error('This confirmation link expired or was replaced. Please sign up again.');}
 const old=await get('subscriber:'+d.id);
 await brevo('/contacts','POST',{email:p.email,updateEnabled:true,emailBlacklisted:false});
 const s={...p,status:'confirmed',confirmedAt:new Date().toISOString(),lastChangedAt:new Date().toISOString(),delivered:[...new Set([...(old?.delivered||[]),...p.baseline])],pendingDelivery:null};
 delete s.baseline;
 await put('subscriber:'+d.id,s);await redis(['SADD',PREFIX+'ids',d.id]);await redis(['DEL',PREFIX+'pending:'+d.id]);await markDirty(d.id);
 return {message:'Your email is confirmed. You will receive a daily summary only when new listings match your choices.'};
}
async function unsubscribe(value){
 const d=readToken(value,'unsubscribe'),s=await get('subscriber:'+d.id);
 if(!s||s.version!==d.version)throw new Error('This link belongs to an older subscription. Use the link in your latest email.');
 s.status='unsubscribed';s.unsubscribedAt=new Date().toISOString();s.lastChangedAt=s.unsubscribedAt;
 await put('subscriber:'+d.id,s);await redis(['DEL',PREFIX+'pending:'+d.id]);await markDirty(d.id);
 try{await brevo('/contacts/'+encodeURIComponent(s.email),'PUT',{emailBlacklisted:true})}catch{/* Redis opt-out is authoritative; sending always checks it. */}
 return {message:'You are unsubscribed from all community listing alerts.'};
}
function freshEntries(s,items){const delivered=new Set([...s.delivered||[],...s.pendingDelivery?.identities||[]]);return items.filter(x=>!delivered.has(x.identity)&&s.seasons.includes(x.season)&&s.categories.includes(x.category)&&!['temporarily_closed','weather_cancelled'].includes(x.status)&&(!x.endAt||new Date(x.endAt)>new Date()))}
function easternDay(value){return new Date(value).toLocaleDateString('en-CA',{timeZone:'America/New_York'})}
function listingLink(x){return x.category==='events'?SITE+'/?category=events&event='+encodeURIComponent(x.id):SITE+'/?house='+x.num+(x.entityId?'&entity='+encodeURIComponent(x.entityId):'')}
function summary(s,items){
 const unsub=SITE+'/alerts.html?action=unsubscribe&token='+encodeURIComponent(token('unsubscribe',s.id,s.version));
 const oneClick=SITE+'/api/subscriptions?action=unsubscribe&token='+encodeURIComponent(token('unsubscribe',s.id,s.version));
 const html='<h1>New Hauntfinder listings</h1>'+items.map(x=>`<h2>${x.num?'#'+x.num+' ':''}${escape(x.name)}</h2><p>${escape({displays:'Display',events:'Event',treats:'Treat Stop'}[x.category])} · ${escape(x.town||x.address)}</p><p>${escape(x.address)}</p><p>${escape([x.dates||x.date||(x.ongoing?'Open daily':''),x.times||x.hours].filter(Boolean).join(' · '))}</p><p><a href="${escape(listingLink(x))}">View listing</a></p>`).join('')+`<hr><p>You signed up for new listing alerts. Existing-listing edits do not trigger emails.</p><p><a href="${escape(unsub)}">Unsubscribe</a> · <a href="${SITE}/alerts.html">Change preferences</a></p><p>This inbox is not monitored. Please use Contact Us on <a href="${SITE}">the website</a>.</p><p>Sent with Brevo</p>`;
 return {html,oneClick};
}
async function syncSheet(){
 const ids=(await redis(['SMEMBERS',PREFIX+'dirty'])||[]).slice(0,20),deliveryIds=(await redis(['SMEMBERS',PREFIX+'dirty-deliveries'])||[]).slice(0,20);
 const subscribers=[];for(const id of ids){const s=await get('subscriber:'+id);if(s)subscribers.push(s)}
 const deliveries=[];for(const id of deliveryIds){const d=await get('delivery:'+id);if(d)deliveries.push(d)}
 if(!ids.length&&!deliveryIds.length)return;
 await sheetRequest({action:'sync',subscribers,deliveries});
 const remove="if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('SREM',KEYS[2],ARGV[2]) end;return 0";
 for(const s of subscribers)await redis(['EVAL',remove,2,PREFIX+'subscriber:'+s.id,PREFIX+'dirty',JSON.stringify(s),s.id]);
 for(const d of deliveries)await redis(['EVAL',remove,2,PREFIX+'delivery:'+d.id,PREFIX+'dirty-deliveries',JSON.stringify(d),d.id]);
}
async function sheetRequest(data){
 if(!validSheetUrl(process.env.SUBSCRIBER_SHEET_URL))throw new Error('Subscriber sheet is not connected');
 const payload=JSON.stringify({...data,timestamp:Date.now()});
 const r=await fetch(process.env.SUBSCRIBER_SHEET_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature:hmac(payload)}),signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok||d.ok!==true)throw new Error('Subscriber sheet sync failed');return d;
}
async function digest(items=catalog()){
 const lock=randomBytes(16).toString('hex');
 if(!await redis(['SET',PREFIX+'digest-lock',lock,'NX','EX',120]))return {busy:true,more:true};
 try{
  const started=Date.now(),ids=await redis(['SMEMBERS',PREFIX+'ids'])||[];let sent=0,held=0,suppressed=0,more=false,quotaReached=false;
  for(const id of ids){
   if(sent>=5||Date.now()-started>30000){more=true;break}
   let s=await get('subscriber:'+id);if(!s||s.status!=='confirmed')continue;
   if(s.lastSentAt&&easternDay(s.lastSentAt)===easternDay(Date.now()))continue;
   if(s.pendingDelivery){held++;continue}
   const entries=freshEntries(s,items);if(!entries.length)continue;
   const provider=await brevo('/contacts/'+encodeURIComponent(s.email));
   if(provider.emailBlacklisted){s.status='unsubscribed';s.unsubscribedAt=new Date().toISOString();s.lastChangedAt=s.unsubscribedAt;await put('subscriber:'+id,s);await markDirty(id);suppressed++;continue}
   // Read immediately before sending so a concurrent opt-out is honored.
   const latest=await get('subscriber:'+id);if(latest.status!=='confirmed'||latest.version!==s.version)continue;s=latest;
   const deliveryId=hash(id+':'+s.version+':'+entries.map(x=>x.identity).sort().join('|'));
   const attempt={id:deliveryId,subscriberId:id,email:s.email,identities:entries.map(x=>x.identity),status:'sending',attemptedAt:new Date().toISOString()};
   const expected=JSON.stringify(s);s.pendingDelivery={id:deliveryId,identities:attempt.identities};
   // Compare-and-set avoids overwriting an opt-out or preference change after our read.
   const claimed=await redis(['EVAL',"if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end;redis.call('SET',KEYS[1],ARGV[2]);redis.call('SET',KEYS[2],ARGV[3]);redis.call('SADD',KEYS[3],ARGV[4]);return 1",3,PREFIX+'subscriber:'+id,PREFIX+'delivery:'+deliveryId,PREFIX+'dirty-deliveries',expected,JSON.stringify(s),JSON.stringify(attempt),deliveryId]);
   if(!claimed)continue;
   try{
    const content=summary(s,entries),result=await send(s.email,entries.length+' new Hauntfinder listing'+(entries.length===1?'':'s'),content.html,content.oneClick);
    attempt.status='sent';attempt.sentAt=new Date().toISOString();attempt.messageId=result.messageId||'';
    // Merge status from storage; never undo an unsubscribe during an accepted send.
    const current=await get('subscriber:'+id);current.delivered=[...new Set([...(current.delivered||[]),...attempt.identities])];current.pendingDelivery=null;current.lastSentAt=attempt.sentAt;current.lastChangedAt=attempt.sentAt;
    await redis(['EVAL',"redis.call('SET',KEYS[1],ARGV[1]);redis.call('SET',KEYS[2],ARGV[2]);redis.call('SADD',KEYS[3],ARGV[3]);return 1",3,PREFIX+'subscriber:'+id,PREFIX+'delivery:'+deliveryId,PREFIX+'dirty',JSON.stringify(current),JSON.stringify(attempt),id]);sent++;
   }catch(e){
    if(e.status&&e.status>=400&&e.status<500){const current=await get('subscriber:'+id);current.pendingDelivery=null;await put('subscriber:'+id,current);attempt.status='rejected';await put('delivery:'+deliveryId,attempt);if(e.status===429){more=true;quotaReached=true;break}throw e}
    attempt.status='delivery-uncertain';await put('delivery:'+deliveryId,attempt);held++;
   }
  }
  await syncSheet();return {sent,held,suppressed,more,quotaReached};
 }finally{await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,PREFIX+'digest-lock',lock])}
}
function adminAuthorized(req){const value=String(req.headers.authorization||'');const want='Bearer '+secret();return Boolean(secret())&&value.length===want.length&&timingSafeEqual(Buffer.from(value),Buffer.from(want))}
module.exports={SITE,PREFIX,SENDER,CATEGORIES,SEASONS,escape,configured,enabled,prefs,token,readToken,catalog,freshEntries,listingLink,summary,subscribe,confirm,unsubscribe,redis,brevo,sheetRequest,syncSheet,digest,adminAuthorized,validSheetUrl};
