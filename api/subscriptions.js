const n=require('../lib/newsletter');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET'){try{n.catalog();return res.status(200).json({available:n.enabled(),prepared:n.configured(),catalogReady:true})}catch{return res.status(503).json({available:false,prepared:n.configured(),catalogReady:false})}}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 if(!n.configured())return res.status(503).json({error:'Signup is not available yet.'});
 let body=req.body;
 if(Number(req.headers['content-length'])>5000||(typeof body==='string'&&Buffer.byteLength(body)>5000))return res.status(413).json({error:'Please use the signup form.'});
 const isOneClick=req.query?.action==='unsubscribe'&&req.query?.token&&String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded');
 if(isOneClick)body={action:'unsubscribe',token:req.query.token};
 else{
  if(req.headers.origin!==n.SITE)return res.status(403).json({error:'Please use the form on this website.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Please use the signup form.'});
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the signup form.'})}}
 }
 if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Please use the signup form.'});
 try{
  if(body.action==='unsubscribe')return res.status(200).json(await n.unsubscribe(body.token));
  if(!n.enabled())return res.status(503).json({error:'Signup is not available yet.'});
  if(body.action==='confirm')return res.status(200).json(await n.confirm(body.token));
  if(body.action!=='subscribe'||body.website)return res.status(400).json({error:'Please use the signup form.'});
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  return res.status(202).json(await n.subscribe(body,ip));
 }catch(e){
  const inputError=/valid email|Choose your|Invalid link|confirmation link|older subscription/.test(e.message);
  return res.status(inputError?400:e.status===429?429:503).json({error:inputError||e.status===429?e.message:'Email signup is temporarily unavailable. Please try again later.'});
 }
};
