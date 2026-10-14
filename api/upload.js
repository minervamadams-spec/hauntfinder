const {handleUpload}=require('@vercel/blob/client');
const {createHmac,randomUUID,timingSafeEqual}=require('node:crypto');
const {adminAuthorized}=require('../lib/newsletter');
// Release 3 increment 1: host photo uploads via Vercel Blob client uploads.
// The browser mints a client token here, then sends the bytes straight to
// Blob, so function payload limits never see image data. Exactly one of two
// credentials is accepted: the admin bearer (lib/newsletter.js pattern) or a
// per-listing host update token stored at hauntfinder:2026:hostlinks:{token}
// (increment 3 will mint those keys; this route only validates them).
const KEY_PREFIX='hauntfinder:2026:';
const PHOTOS_KEY=num=>KEY_PREFIX+'photos:'+num;
const HOSTLINK_KEY=token=>KEY_PREFIX+'hostlinks:'+token;
const MAX_BYTES=5*1024*1024;
const MAX_MINTS_PER_HOUR=10;
const ALLOWED_TYPES=['image/jpeg','image/png','image/webp','image/gif'];
const RATE_LIMIT_SCRIPT=`local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],3600) end;if n>${MAX_MINTS_PER_HOUR} then return 0 end;return 1`;

function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
function deny(status,message){const error=new Error(message);error.status=status;return error}
async function listingForHostToken(token){
  if(typeof token!=='string'||!/^[\w-]{16,128}$/.test(token))return null;
  let value;try{value=await redis(['GET',HOSTLINK_KEY(token)])}catch{return null}
  if(value==null)return null;
  let parsed;try{parsed=typeof value==='string'?JSON.parse(value):value}catch{return null}
  const num=typeof parsed==='object'&&parsed!==null?parsed.num:Number(parsed);
  return Number.isInteger(num)?num:null;
}
async function authorizedListing(req,clientData){
  if(!Number.isInteger(clientData.listingNum))throw deny(400,'Please choose a listed home for this photo.');
  if(adminAuthorized(req))return clientData.listingNum;
  const num=await listingForHostToken(clientData.token);
  if(num==null)throw deny(403,'Unknown or expired update link.');
  if(clientData.listingNum!==num)throw deny(403,'This update link belongs to a different listing.');
  return num;
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
  if(req.url&&!req.url.split('?')[0].endsWith('/upload'))return res.status(404).json({error:'Not found.'});
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Photo uploads are coming soon.'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the photo upload form.'})}}
  if(!body||typeof body!=='object'||!body.payload||typeof body.payload!=='object')return res.status(400).json({error:'Please use the photo upload form.'});
  try{
    const jsonResponse=await handleUpload({
      request:req,
      body,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        let clientData=null;
        if(typeof clientPayload==='string'&&clientPayload){try{clientData=JSON.parse(clientPayload)}catch{}}
        const contentType=(clientData&&clientData.contentType)||body.payload.contentType;
        if(!ALLOWED_TYPES.includes(contentType))throw deny(400,'Only JPEG, PNG, WebP or GIF photos can be uploaded.');
        const listingNum=await authorizedListing(req,clientData||{});
        const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
        const rateKey=KEY_PREFIX+'rate:upload:'+createHmac('sha256',storageToken()).update(ip).digest('hex');
        const allowed=await redis(['EVAL',RATE_LIMIT_SCRIPT,1,rateKey]);
        if(!allowed)throw deny(429,'Too many upload attempts. Please try again later.');
        return{allowedContentTypes:ALLOWED_TYPES,maximumSizeInBytes:MAX_BYTES,addRandomSuffix:true,access:'public',tokenPayload:JSON.stringify({listingNum})};
      },
      onUploadCompleted:async({blob,tokenPayload})=>{
        let listingNum=null;try{listingNum=JSON.parse(tokenPayload||'').listingNum}catch{}
        if(!Number.isInteger(listingNum))throw new Error('Upload is missing its listing.');
        const photo={id:randomUUID(),url:blob.url,pathname:blob.pathname,status:'pending',uploadedAt:new Date().toISOString()};
        await redis(['LPUSH',PHOTOS_KEY(listingNum),JSON.stringify(photo)]);
      }
    });
    return res.status(200).json(jsonResponse);
  }catch(error){
    return res.status(error.status||400).json({error:error.message||'Upload failed.'});
  }
};
