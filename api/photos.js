const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Release 3 increment 2: public read endpoint for approved host photos.
// Only status:'approved' records from hauntfinder:2026:photos:{num} ever
// leave this route; pending and rejected records stay organizer-only.
function loadHouses(){
 const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
 const ctx={};vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
 const ids=new Set();
 for(const x of ctx.data.listings){if(x.placeholder)continue;ids.add(x.num)}
 return ids;
}
const HOUSE_IDS=loadHouses();
const PHOTOS_KEY=num=>'hauntfinder:2026:photos:'+num;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
function parseRecord(row){try{return typeof row==='string'?JSON.parse(row):row}catch{return null}}
module.exports=async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
  const num=Number(req.query&&req.query.num);
  if(!Number.isInteger(num))return res.status(400).json({error:'Please choose a listed home.'});
  if(!HOUSE_IDS.has(num))return res.status(404).json({error:'Unknown listing.'});
  // 60s edge cache: short enough that an organizer-approved photo shows on
  // the next page load shortly after approval (a 5-min cache made approvals
  // appear to do nothing).
  res.setHeader('Cache-Control','public, max-age=60');
  if(!storageUrl()||!storageToken())return res.status(200).json({photos:[]});
  try{
    const rows=await redis(['LRANGE',PHOTOS_KEY(num),0,49]);
    const photos=(rows||[]).map(parseRecord).filter(p=>p&&p.status==='approved').map(p=>({id:p.id,url:p.url,pathname:p.pathname}));
    return res.status(200).json({photos});
  }catch{return res.status(200).json({photos:[]})}
};
