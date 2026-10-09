const n=require('../lib/newsletter');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed.'});
 if(!n.adminAuthorized(req))return res.status(401).json({error:'Unauthorized.'});
 const checks={},failures=[];
 async function check(service,run){
  try{checks[service]=await run()}
  catch(e){
   const status=Number.isInteger(e.status)?e.status:null;
   checks[service]=false;
   failures.push({service,status,reason:service==='brevo'&&status===401?'Brevo rejected authentication. Check API key validity and Brevo API security restrictions.':service==='sheet'?'Google sheet connection failed. Check web app deployment access and matching CRON_SECRET.':service==='storage'?'Private subscriber storage connection failed.':'Brevo account or sender lookup failed.'});
  }
 }
 await check('storage',async()=>{await n.redis(['PING']);return true});
 await check('brevo',async()=>{
  const account=await n.brevo('/account'),senders=await n.brevo('/senders');
  checks.senderVerified=Boolean(senders.senders?.find(x=>x.email.toLowerCase()===n.SENDER.toLowerCase())?.active);
  checks.emailAccount=Boolean(account.email);
  return true;
 });
 await check('sheet',async()=>{const result=await n.sheetRequest({action:'ping'});return Boolean(result?.ok)});
 return res.status(failures.length?503:200).json({storage:checks.storage,senderVerified:checks.senderVerified||false,emailAccount:checks.emailAccount||false,sheetConnected:checks.sheet,enabled:n.enabled(),...(failures.length?{error:'A newsletter connection check failed.',failures}:{})});
};
