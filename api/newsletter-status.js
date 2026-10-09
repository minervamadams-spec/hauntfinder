const n=require('../lib/newsletter');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed.'});
 if(!n.adminAuthorized(req))return res.status(401).json({error:'Unauthorized.'});
 try{
  await n.redis(['PING']);const account=await n.brevo('/account'),senders=await n.brevo('/senders');
  const sender=senders.senders?.find(x=>x.email.toLowerCase()===n.SENDER.toLowerCase());
  const sheet=process.env.SUBSCRIBER_SHEET_URL?await n.sheetRequest({action:'ping'}):null;
  return res.status(200).json({storage:true,senderVerified:Boolean(sender?.active),emailAccount:Boolean(account.email),sheetConnected:Boolean(sheet?.ok),enabled:n.enabled()});
 }catch(e){console.error('Community connection check failed',{message:e.message,status:e.status||null});return res.status(503).json({error:'A newsletter connection check failed.'})}
};
