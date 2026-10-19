const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const {adminAuthorized}=require('../lib/newsletter');
// Release 3 increment 3: private host update links. Admin-only mint/revoke/
// list against hauntfinder:2026:hostlinks:{token} = {num, createdAt}; links
// have no TTL and are revoked explicitly. A lightweight public check
// (GET ?token=) returns only {valid, num, name, town} so a host arriving at
// /?update=TOKEN can be greeted without exposing other listings or tokens.
function loadListings(){
 const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
 const ctx={};vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
 const byNum=new Map();
 for(const x of ctx.data.listings){if(!x.placeholder)byNum.set(x.num,{name:x.name,town:x.town})}
 return byNum;
}
const LISTINGS=loadListings();
const HOSTLINK_PREFIX='hauntfinder:2026:hostlinks:';
const LIST_CAP=50,ALL_CAP=200;
function storageUrl(){return process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL}
function storageToken(){return process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN}
async function redis(command){
  const response=await fetch(storageUrl(),{method:'POST',headers:{Authorization:'Bearer '+storageToken(),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error('Storage request failed');return data.result;
}
function parseValue(row){try{return typeof row==='string'?JSON.parse(row):row}catch{return null}}
function tokenShape(key,value){const record=parseValue(value);return record?{token:String(key).slice(HOSTLINK_PREFIX.length),num:record.num,createdAt:record.createdAt}:null}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!storageUrl()||!storageToken())return res.status(503).json({error:'Host links are temporarily unavailable.'});
  try{
    if(req.method==='GET'){
      const token=typeof req.query?.token==='string'?req.query.token:'';
      if(token){
        if(!/^[\w-]{16,128}$/.test(token))return res.status(404).json({valid:false,error:'This update link is not valid.'});
        const record=parseValue(await redis(['GET',HOSTLINK_PREFIX+token]));
        const listing=record&&LISTINGS.get(record.num);
        if(!listing)return res.status(404).json({valid:false,error:'This update link is not valid.'});
        return res.status(200).json({valid:true,num:record.num,name:listing.name,town:listing.town});
      }
      if(!adminAuthorized(req))return res.status(403).json({error:'Organizer access required.'});
      if(req.query?.catalog==='1')return res.status(200).json({listings:[...LISTINGS.entries()].map(([num,x])=>({num,...x})).sort((a,b)=>a.num-b.num)});
      const keys=await redis(['KEYS',HOSTLINK_PREFIX+'*']);
      const links=[];
      for(const key of keys||[]){const link=tokenShape(key,await redis(['GET',key]));if(link){links.push(link);if(links.length>=ALL_CAP)break}}
      return res.status(200).json({links});
    }
    if(!adminAuthorized(req))return res.status(403).json({error:'Organizer access required.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Please use the host link form.'});
    let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Please use the host link form.'})}}
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Please use the host link form.'});
    const {action}=body;
    if(action==='mint'){
      const num=Number(body.num);
      if(!Number.isInteger(num))return res.status(400).json({error:'Please choose a listed home.'});
      if(!LISTINGS.has(num))return res.status(404).json({error:'Unknown listing.'});
      const token=randomBytes(32).toString('base64url'),createdAt=new Date().toISOString();
      await redis(['SET',HOSTLINK_PREFIX+token,JSON.stringify({num,createdAt})]);
      return res.status(201).json({token,url:'/?update='+token});
    }
    if(action==='revoke'){
      const token=typeof body.token==='string'?body.token:'';
      if(!/^[\w-]{16,128}$/.test(token))return res.status(400).json({error:'Please choose a link to revoke.'});
      const removed=await redis(['DEL',HOSTLINK_PREFIX+token]);
      if(!removed)return res.status(404).json({error:'Unknown link.'});
      return res.status(200).json({revoked:true});
    }
    if(action==='list'){
      const num=Number(body.num);
      if(!Number.isInteger(num))return res.status(400).json({error:'Please choose a listed home.'});
      if(!LISTINGS.has(num))return res.status(404).json({error:'Unknown listing.'});
      const keys=await redis(['KEYS',HOSTLINK_PREFIX+'*']);
      const links=[];
      for(const key of keys||[]){
        const link=tokenShape(key,await redis(['GET',key]));
        if(link&&link.num===num){links.push(link);if(links.length>=LIST_CAP)break}
      }
      return res.status(200).json({links});
    }
    return res.status(400).json({error:'Please choose mint, revoke or list.'});
  }catch{return res.status(503).json({error:'Host links are temporarily unavailable. Please try again later.'})}
};
