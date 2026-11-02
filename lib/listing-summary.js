const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {storageKeys}=require('../lib/keys');
const {isReusedSlot}=require('../routing');
// Served by api/feedback.js as GET /api/feedback?summary=1 (a separate api/ file
// would be a 13th function; the Hobby plan allows 12).
// Batched, CDN-cacheable read for the home page: rating summaries and approved
// photos for every listing in one call (replaces ~150 per-listing calls to
// /api/feedback and /api/photos per page view). Read-only; /api/feedback and
// /api/photos keep serving single-listing reads and all writes.
function loadHouses(){
 const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
 const ctx={};vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
 const ids=[],entities=new Map();
 for(const x of ctx.data.listings){if(x.placeholder)continue;ids.push(x.num);if(isReusedSlot(x))entities.set(x.num,x.entityId)}
 return {ids,entities};
}
const {ids:HOUSE_IDS,entities:HOUSE_ENTITIES}=loadHouses();
const HOUSE_SET=new Set(HOUSE_IDS);
const MAX_IDS=200;
const reviewKey=house=>storageKeys({season:'halloween',year:2026,num:house,entityId:HOUSE_ENTITIES.get(house)}).review;
const photosKey=num=>'hauntfinder:2026:photos:'+num;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function pipeline(commands){
  const response=await fetch(storageUrl().replace(/\/+$/,'')+'/pipeline',{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(commands),signal:AbortSignal.timeout(8000)});
  const data=await response.json();
  if(!response.ok||!Array.isArray(data)||data.length!==commands.length||data.some(x=>!x||x.error))throw new Error('Storage request failed');
  return data.map(x=>x.result);
}
function parse(row){try{return typeof row==='string'?JSON.parse(row):row}catch{return null}}
function summarize(rows){
  const ratings=(rows||[]).map(parse).filter(r=>r&&r.kind!=='update-request'&&Number.isFinite(r.rating));
  return {count:ratings.length,average:ratings.length?(ratings.reduce((s,r)=>s+r.rating,0)/ratings.length).toFixed(1):null};
}
function parseIds(raw){
  if(raw===undefined||raw==='')return {ids:HOUSE_IDS};
  const text=Array.isArray(raw)?raw.join(','):String(raw);
  const parts=text.split(',');
  if(parts.length>MAX_IDS||parts.some(p=>!/^\d{1,6}$/.test(p.trim())))return {error:'Please choose listed homes.'};
  // Unknown ids are dropped, not errors: a listing can be retired between a
  // cached page and a fresh API call.
  return {ids:[...new Set(parts.map(p=>Number(p.trim())))].filter(n=>HOUSE_SET.has(n))};
}
function fail(res,status,error){res.setHeader('Cache-Control','no-store');return res.status(status).json({error})}
async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return fail(res,405,'Method not allowed.')}
  const parsed=parseIds(req.query&&req.query.ids);
  if(parsed.error)return fail(res,400,parsed.error);
  const ids=parsed.ids;
  const generatedAt=new Date().toISOString();
  if(!ids.length){res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=300');return res.status(200).json({generatedAt,ratings:{},photos:{}})}
  if(!storageUrl()||!storageToken())return fail(res,503,'Community data is coming soon.');
  try{
    // One round trip to storage: reviews then photos for every requested id.
    const results=await pipeline([...ids.map(n=>['LRANGE',reviewKey(n),0,199]),...ids.map(n=>['LRANGE',photosKey(n),0,49])]);
    const ratings={},photos={};
    ids.forEach((n,i)=>{
      const summary=summarize(results[i]);
      if(summary.count)ratings[n]=summary;
      const approved=(results[ids.length+i]||[]).map(parse).filter(p=>p&&p.status==='approved'&&p.url).map(p=>({id:p.id,url:p.url,pathname:p.pathname}));
      if(approved.length)photos[n]=approved;
    });
    // Ratings and photos change rarely; a minute of shared-cache staleness is
    // acceptable. The page overlays a visitor's own just-posted rating locally.
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({generatedAt,ratings,photos});
  }catch{return fail(res,503,'Community data is temporarily unavailable.')}
}
module.exports=handler;
