const {randomUUID}=require('node:crypto');
const SCRIPT="local added=redis.call('SET',KEYS[2],'1','NX','EX',86400);if added then return redis.call('INCR',KEYS[1]) end;return tonumber(redis.call('GET',KEYS[1]) or '0')";
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'})}
  const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  if(!url||!token)return res.status(503).json({error:'Counter unavailable'});
  try{
    let command=['GET','hauntfinder:site-visits:total'];
    if(req.method==='POST'){
      const origin=req.headers.origin;
      if(!origin||new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Use this site'});
      const cookies=String(req.headers.cookie||'');
      const match=cookies.match(/(?:^|;\s*)hf_visit=([a-f0-9-]{36})(?:;|$)/);
      const id=match?match[1]:randomUUID();
      if(!match)res.setHeader('Set-Cookie','hf_visit='+id+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax');
      command=['EVAL',SCRIPT,2,'hauntfinder:site-visits:total','hauntfinder:site-visits:seen:'+id];
    }
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
    const data=await response.json();
    if(!response.ok||data.error)throw new Error('Storage unavailable');
    const visits=Number(data.result||0);
    if(!Number.isSafeInteger(visits)||visits<0)throw new Error('Invalid count');
    return res.status(200).json({visits});
  }catch{return res.status(503).json({error:'Counter unavailable'})}
};
