const {handleUpload}=require('@vercel/blob/client');
const {createHmac}=require('node:crypto');
// Community-spotted houses: street photo for a nomination. The browser re-encodes
// the picture to JPEG first (which drops EXIF/GPS), then sends it straight to Blob.
// Nothing here publishes anything: the URL travels in the "Nominations" Google Form
// and only reaches the site if the nomination is approved on review.
const KEY_PREFIX='hauntfinder:2026:';
const MAX_BYTES=5*1024*1024;
const MAX_MINTS_PER_HOUR=6;
const ALLOWED_TYPES=['image/jpeg'];
const RATE_LIMIT_SCRIPT=`local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],3600) end;if n>${MAX_MINTS_PER_HOUR} then return 0 end;return 1`;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
function deny(status,message){const error=new Error(message);error.status=status;return error}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Photo uploads are coming soon.'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the nomination form.'})}}
  if(!body||typeof body!=='object'||!body.payload||typeof body.payload!=='object')return res.status(400).json({error:'Please use the nomination form.'});
  try{
    const jsonResponse=await handleUpload({
      token:process.env.PHOTOS_READ_WRITE_TOKEN||process.env.BLOB_READ_WRITE_TOKEN,
      request:req,
      body,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        if(!/^nominations\/[\w.-]{1,80}$/.test(pathname))throw deny(400,'Please use the nomination form.');
        const contentType=body.payload.contentType||(()=>{try{return JSON.parse(clientPayload||'{}').contentType}catch{return ''}})();
        if(!ALLOWED_TYPES.includes(contentType))throw deny(400,'Only JPEG photos can be added here.');
        const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
        const rateKey=KEY_PREFIX+'rate:nomination-photo:'+createHmac('sha256',storageToken()).update(ip).digest('hex');
        if(!await redis(['EVAL',RATE_LIMIT_SCRIPT,1,rateKey]))throw deny(429,'Too many photo attempts. Please try again later.');
        return{allowedContentTypes:ALLOWED_TYPES,maximumSizeInBytes:MAX_BYTES,addRandomSuffix:true,access:'public'};
      },
      onUploadCompleted:async()=>{}
    });
    return res.status(200).json(jsonResponse);
  }catch(error){
    return res.status(error.status||400).json({error:error.message||'Upload failed.'});
  }
};
module.exports.MAX_BYTES=MAX_BYTES;
