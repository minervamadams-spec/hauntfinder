const {createHash}=require('node:crypto');
const {adminAuthorized}=require('../lib/newsletter');
const PREFIX='hauntfinder:2026:',photosKey=num=>PREFIX+'photos:'+num,linkKey=token=>PREFIX+'hostlinks:'+token;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){const r=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command)});const d=await r.json();if(!r.ok||d.error)throw Error('storage');return d.result}
const parse=x=>{try{return typeof x==='string'?JSON.parse(x):x}catch{return null}};
async function hostOwns(token,num,photo){if(typeof token!=='string'||!/^[\w-]{16,128}$/.test(token)||!photo.hostTokenHash)return false;const row=parse(await redis(['GET',linkKey(token)]));return row&&row.num===num&&createHash('sha256').update(token).digest('hex')===photo.hostTokenHash}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Photos are temporarily unavailable.'});
  if(req.method==='GET'){const num=Number(req.query?.listingNum),token=String(req.query?.token||'');if(!Number.isInteger(num))return res.status(400).json({error:'Invalid request.'});try{const rows=await redis(['LRANGE',photosKey(num),0,49]),admin=adminAuthorized(req),photos=[];for(const row of rows||[]){const photo=parse(row);if(photo?.status!=='approved')continue;if(admin||await hostOwns(token,num,photo))photos.push({id:photo.id,url:photo.url,uploadedAt:photo.uploadedAt})}return res.status(200).json({photos});}catch{return res.status(503).json({error:'Photos are temporarily unavailable.'})}}
  let body=req.body;try{if(typeof body==='string')body=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid request.'})}
  const num=Number(body?.listingNum),id=String(body?.id||'');if(!Number.isInteger(num)||!id)return res.status(400).json({error:'Invalid request.'});
  try{const key=photosKey(num),rows=await redis(['LRANGE',key,0,49]),index=(rows||[]).findIndex(x=>parse(x)?.id===id);if(index<0)return res.status(404).json({error:'Photo not found.'});const photo=parse(rows[index]);if(!adminAuthorized(req)&&!await hostOwns(body.token,num,photo))return res.status(403).json({error:'Not authorized.'});await redis(['LSET',key,index,JSON.stringify({...photo,status:'removed',removedAt:new Date().toISOString()})]);return res.status(200).json({removed:true});}catch{return res.status(503).json({error:'Photos are temporarily unavailable.'})}
};
