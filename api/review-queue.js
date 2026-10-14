const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {adminAuthorized}=require('../lib/newsletter');
const {isReusedSlot}=require('../routing');
const {storageKeys}=require('../lib/keys');
const {notifyHost}=require('../lib/host-notify');
// Release 3 increment 4: organizer queue for host update-requests. Reads the
// same review keys api/feedback.js uses; GET never exposes the host email
// (hasEmail only). POST resolve marks the record resolvedAt, keeps
// kind:'update-request' (the public review filter already hides the whole
// kind), and emails the host when a contact email is on record.
function loadHouses(){
 const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
 const ctx={};vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
 const names=new Map(),entities=new Map();
 for(const x of ctx.data.listings){if(x.placeholder)continue;names.set(x.num,x.name);if(isReusedSlot(x))entities.set(x.num,x.entityId)}
 return {names,entities};
}
const {names:LISTING_NAMES,entities:HOUSE_ENTITIES}=loadHouses();
const REVIEW_PREFIX='hauntfinder:2026:reviews:';
const reviewKey=house=>storageKeys({season:'halloween',year:2026,num:house,entityId:HOUSE_ENTITIES.get(house)}).review;
const CAP=200;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
function parseRecord(row){try{return typeof row==='string'?JSON.parse(row):row}catch{return null}}
function houseOfKey(key){const n=Number(String(key).slice(REVIEW_PREFIX.length).split(':')[0]);return Number.isInteger(n)?n:null}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Review queue is temporarily unavailable.'});
  if(!adminAuthorized(req))return res.status(403).json({error:'Organizer access required.'});
  try{
    if(req.method==='GET'){
      const keys=await redis(['KEYS',REVIEW_PREFIX+'*']);
      const queue=[];
      for(const key of keys||[]){
        const house=houseOfKey(key);if(house==null)continue;
        const rows=await redis(['LRANGE',key,0,199]);
        for(const row of rows||[]){
          const record=parseRecord(row);
          if(!record||record.kind!=='update-request'||record.resolvedAt)continue;
          queue.push({house,id:record.id,listingName:LISTING_NAMES.get(house)||null,dates:record.dates||'',hours:record.hours||'',details:record.details||'',closures:record.closures||'',hasEmail:Boolean(record.email),timestamp:record.timestamp});
          if(queue.length>=CAP)break;
        }
        if(queue.length>=CAP)break;
      }
      return res.status(200).json({updates:queue.slice(0,CAP)});
    }
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Please use the review form.'});
    let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the review form.'})}}
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Please use the review form.'});
    const {id}=body,house=Number(body.house);
    if(!Number.isInteger(house))return res.status(400).json({error:'Please choose a listed home.'});
    if(typeof id!=='string'||!id||body.action!=='resolve')return res.status(400).json({error:'Please choose an update to resolve.'});
    const key=reviewKey(house),rows=await redis(['LRANGE',key,0,199]);
    const index=(rows||[]).findIndex(row=>{const record=parseRecord(row);return record&&record.id===id&&record.kind==='update-request'});
    if(index<0)return res.status(404).json({error:'Update request not found.'});
    const record={...parseRecord(rows[index]),resolvedAt:new Date().toISOString()};
    await redis(['LSET',key,index,JSON.stringify(record)]);
    let notified=false;
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email||'')){
      try{
        const name=LISTING_NAMES.get(house)||('Listing '+house);
        const result=await notifyHost({to:record.email,subject:'Your Hauntfinder update was reviewed',text:`Hi!\n\nThanks for the update you sent for ${name}. The organizer has received and reviewed it; approved changes appear on the site after the next listing update.\n\nMount Olive Hauntfinder`});
        notified=result.sent;
      }catch{}
    }
    return res.status(200).json({resolved:true,notified});
  }catch{return res.status(503).json({error:'Review queue is temporarily unavailable. Please try again later.'})}
};
