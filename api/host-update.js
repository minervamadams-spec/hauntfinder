const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {randomUUID,createHmac}=require('node:crypto');
const {isReusedSlot}=require('../routing');
const {storageKeys}=require('../lib/keys');
// Release 3 increment 3: host update requests. A valid host link token
// (hauntfinder:2026:hostlinks:{token} -> {num}) lets the returning host send
// dates/hours/details/closures plus an optional contact email. The request
// lands in the SAME organizer pipeline as visitor feedback: LPUSH to the
// listing's review key with kind:'update-request'. api/feedback.js filters
// that kind out of the public reviews list, so review rendering and rating
// math are untouched. The private email stays inside this record only.
function loadHouses(){
 const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
 const ctx={};vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
 const ids=new Set(),entities=new Map();
 for(const x of ctx.data.listings){if(x.placeholder)continue;ids.add(x.num);if(isReusedSlot(x))entities.set(x.num,x.entityId)}
 return {ids,entities};
}
const {ids:HOUSE_IDS,entities:HOUSE_ENTITIES}=loadHouses();
const KEY_PREFIX='hauntfinder:2026:';
const HOSTLINK_KEY=token=>KEY_PREFIX+'hostlinks:'+token;
const MAX_REQUESTS_PER_HOUR=5;
const RATE_LIMIT_SCRIPT=`local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],3600) end;if n>${MAX_REQUESTS_PER_HOUR} then return 0 end;return 1`;
const reviewKey=house=>storageKeys({season:'halloween',year:2026,num:house,entityId:HOUSE_ENTITIES.get(house)}).review;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
async function listingForToken(token){
  if(typeof token!=='string'||!/^[\w-]{16,128}$/.test(token))return null;
  const value=await redis(['GET',HOSTLINK_KEY(token)]);
  if(value==null)return null;
  let parsed;try{parsed=typeof value==='string'?JSON.parse(value):value}catch{return null}
  const num=typeof parsed==='object'&&parsed!==null?parsed.num:Number(parsed);
  return Number.isInteger(num)&&HOUSE_IDS.has(num)?num:null;
}
function text(value,max){return typeof value==='string'?value.trim().slice(0,max):''}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Updates are temporarily unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Please use the update form.'});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the update form.'})}}
  if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Please use the update form.'});
  try{
    const num=await listingForToken(body.token);
    if(num==null)return res.status(403).json({error:'Unknown or expired update link.'});
    const email=text(body.email,120);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Please check the email address.'});
    const record={id:randomUUID(),house:num,kind:'update-request',dates:text(body.dates,300),hours:text(body.hours,300),details:text(body.details,1500),closures:text(body.closures,500),email,timestamp:new Date().toISOString()};
    if(!record.dates&&!record.hours&&!record.details&&!record.closures)return res.status(400).json({error:'Please share at least one update.'});
    const rateKey=KEY_PREFIX+'rate:hostupdate:'+createHmac('sha256',storageToken()).update(String(body.token)).digest('hex');
    const allowed=await redis(['EVAL',RATE_LIMIT_SCRIPT,1,rateKey]);
    if(!allowed){res.setHeader('Retry-After','3600');return res.status(429).json({error:'Please wait before sending another update.'})}
    await redis(['LPUSH',reviewKey(num),JSON.stringify(record)]);
    return res.status(201).json({received:true});
  }catch{return res.status(503).json({error:'Updates are temporarily unavailable. Please try again later.'})}
};
