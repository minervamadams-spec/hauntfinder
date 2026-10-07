const {randomUUID,createHmac}=require('node:crypto');
const HOUSE_IDS=new Set([1,2,3,4,5,6,7]);
const KEY_PREFIX='hauntfinder:2026:';
const RATE_LIMIT_SCRIPT=`local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],600) end;if n>5 then return 0 end;redis.call('LPUSH',KEYS[2],ARGV[1]);return 1`;

function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
async function reviewsFor(house){
  const rows=await redis(['LRANGE',KEY_PREFIX+'reviews:'+house,0,199]);
  return (rows||[]).map(x=>typeof x==='string'?JSON.parse(x):x);
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Feedback is coming soon. You can preview the form below; posting will open once setup is complete.'});
  try{
    if(req.method==='GET'){
      const house=Number(req.query.house);if(!HOUSE_IDS.has(house))return res.status(400).json({error:'Please choose a listed home.'});
      return res.status(200).json({reviews:await reviewsFor(house)});
    }
    const origin=req.headers.origin;
    if(!origin||new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Please submit feedback from this site.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Please use the feedback form.'});
    if(Number(req.headers['content-length'])>12000)return res.status(413).json({error:'Please shorten your feedback.'});
    let body=req.body;if(typeof body==='string'){if(Buffer.byteLength(body)>12000)return res.status(413).json({error:'Please shorten your feedback.'});try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the feedback form.'})}}
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Please use the feedback form.'});
    const {house,rating,website}=body;
    const name=typeof body.name==='string'?body.name.trim():'';
    const comment=typeof body.comment==='string'?body.comment.trim():'';
    if(website)return res.status(400).json({error:'Please use the feedback form.'});
    if(!HOUSE_IDS.has(house)||!Number.isInteger(rating)||rating<1||rating>5||!name||name.length>60||!comment||comment.length>1500)return res.status(400).json({error:'Please add your name, a 1–5 skeleton rating and feedback (up to 1,500 characters).'});
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const rateKey=KEY_PREFIX+'rate:'+createHmac('sha256',storageToken()).update(ip).digest('hex');
    const review={id:randomUUID(),house,name,rating,comment,timestamp:new Date().toISOString()};
    const saved=await redis(['EVAL',RATE_LIMIT_SCRIPT,2,rateKey,KEY_PREFIX+'reviews:'+house,JSON.stringify(review)]);
    if(!saved){res.setHeader('Retry-After','600');return res.status(429).json({error:'Please wait a few minutes before posting more feedback.'})}
    let reviews;try{reviews=await reviewsFor(house)}catch{reviews=[review]}
    return res.status(201).json({reviews});
  }catch{return res.status(503).json({error:'Feedback is temporarily unavailable. Please try again later.'})}
};
