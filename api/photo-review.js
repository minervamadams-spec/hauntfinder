const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {adminAuthorized}=require('../lib/newsletter');
const {isReusedSlot}=require('../routing');
const {storageKeys}=require('../lib/keys');
const {notifyHost}=require('../lib/host-notify');
// Release 3 increment 2: organizer moderation for host photos. Admin bearer
// only (CRON_SECRET pattern from lib/newsletter.js). GET lists the pending
// queue across hauntfinder:2026:photos:*; POST approve/reject rewrites one
// record's status in place via LSET. No other Redis namespace is touched.
function loadHouses(){
 const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
 const ctx={};vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
 const names=new Map(),entities=new Map();
 for(const x of ctx.data.listings){if(x.placeholder)continue;names.set(x.num,x.name);if(isReusedSlot(x))entities.set(x.num,x.entityId)}
 return {names,entities};
}
const {names:LISTING_NAMES,entities:HOUSE_ENTITIES}=loadHouses();
const reviewKey=house=>storageKeys({season:'halloween',year:2026,num:house,entityId:HOUSE_ENTITIES.get(house)}).review;
const PHOTOS_PREFIX='hauntfinder:2026:photos:';
const PHOTOS_GLOB=PHOTOS_PREFIX+'*';
const MAX_QUEUE=100;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
function parseRecord(row){try{return typeof row==='string'?JSON.parse(row):row}catch{return null}}
async function findHostEmail(num){
  const rows=await redis(['LRANGE',reviewKey(num),0,49]);
  for(const row of rows||[]){
    const record=parseRecord(row);
    if(record&&record.kind==='update-request'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email||''))return record.email;
  }
  return null;
}
function listingNumOf(key){const n=Number(String(key).slice(PHOTOS_PREFIX.length));return Number.isInteger(n)?n:null}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Photo review is temporarily unavailable.'});
  if(!adminAuthorized(req))return res.status(403).json({error:'Organizer access required.'});
  try{
    if(req.method==='GET'){
      const keys=await redis(['KEYS',PHOTOS_GLOB]);
      const queue=[];
      for(const key of keys||[]){
        const num=listingNumOf(key);if(num==null)continue;
        const rows=await redis(['LRANGE',key,0,49]);
        for(const row of rows||[]){
          const photo=parseRecord(row);
          if(photo&&photo.status==='pending'){queue.push({listingNum:num,id:photo.id,url:photo.url,uploadedAt:photo.uploadedAt});if(queue.length>=MAX_QUEUE)break}
        }
        if(queue.length>=MAX_QUEUE)break;
      }
      return res.status(200).json({pending:queue.slice(0,MAX_QUEUE)});
    }
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Please use the review form.'});
    let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the review form.'})}}
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Please use the review form.'});
    const {id,action}=body,listingNum=Number(body.listingNum);
    if(!Number.isInteger(listingNum))return res.status(400).json({error:'Please choose a listed home.'});
    if(typeof id!=='string'||!id||!['approve','reject'].includes(action))return res.status(400).json({error:'Please choose approve or reject.'});
    const key=PHOTOS_PREFIX+listingNum,rows=await redis(['LRANGE',key,0,49]);
    const index=(rows||[]).findIndex(row=>{const photo=parseRecord(row);return photo&&photo.id===id});
    if(index<0)return res.status(404).json({error:'Photo not found.'});
    const updated={...parseRecord(rows[index]),status:action==='approve'?'approved':'rejected'};
    await redis(['LSET',key,index,JSON.stringify(updated)]);
    if(action!=='approve')return res.status(200).json({photo:updated});
    let notified=false;
    try{
      const hostEmail=await findHostEmail(listingNum);
      if(hostEmail){
        const name=LISTING_NAMES.get(listingNum)||('Listing '+listingNum);
        const result=await notifyHost({to:hostEmail,subject:'Your Hauntfinder photo is live',text:`Hi!\n\nThe photo you added for ${name} on Hauntfinder has been reviewed and approved. It now appears on the map when visitors open your listing.\n\nThanks for keeping your listing fresh,\nMount Olive Hauntfinder`});
        notified=result.sent;
      }
    }catch{}
    return res.status(200).json({photo:updated,notified});
  }catch{return res.status(503).json({error:'Photo review is temporarily unavailable. Please try again later.'})}
};
