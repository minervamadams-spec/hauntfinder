const {SENDER,brevo,redis}=require('./newsletter');
// Release 3 increment 4: host approval/resolution notifications. Plain-text
// transactional email through the shared Brevo helper, guarded by its OWN
// tiny daily budget (mtocommunity:subscribers:v1:notify-budget:YYYY-MM-DD,
// 25/day) so these rare messages never eat the digest's 280/day allowance.
// Never throws: callers fold the outcome into their response as a flag.
const BUDGET_PREFIX='mtocommunity:subscribers:v1:notify-budget:';
const DAY_CAP=25;
const BUDGET_SCRIPT=`local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],172800) end;if n>${DAY_CAP} then return 0 end;return 1`;
async function notifyHost({to,subject,text}){
  try{
    if(typeof to!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return{sent:false,reason:'no-email'};
    const day=new Date().toISOString().slice(0,10);
    const allowed=await redis(['EVAL',BUDGET_SCRIPT,1,BUDGET_PREFIX+day]);
    if(!allowed)return{sent:false,reason:'budget'};
    await brevo('/smtp/email','POST',{sender:{name:'Mount Olive Hauntfinder',email:SENDER},replyTo:{email:SENDER,name:'Mount Olive Community Finder'},to:[{email:to}],subject,textContent:String(text||''),tags:['community-finder']});
    return{sent:true};
  }catch{return{sent:false,reason:'error'}}
}
module.exports={notifyHost,BUDGET_PREFIX,DAY_CAP};
