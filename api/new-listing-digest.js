const n=require('../lib/newsletter');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 if(!n.adminAuthorized(req))return res.status(401).json({error:'Unauthorized.'});
 if(!n.enabled())return res.status(503).json({error:'Newsletter setup is incomplete.'});
 try{return res.status(200).json(await n.digest())}catch(e){console.error('Community summary failed',{message:e.message,status:e.status||null});return res.status(503).json({error:'Daily summary or sheet sync failed. Inspect private service logs.'})}
};
