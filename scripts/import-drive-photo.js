#!/usr/bin/env node
// Import host photos that arrived as Google Drive links (response sheet) into the
// same store the upload form uses: bytes -> Vercel Blob, record -> Upstash list
// hauntfinder:2026:photos:{num}. DRY RUN BY DEFAULT: downloads and validates only,
// writes nothing. Records are written as 'approved' (live, no review step; Minerva, 2026-10-16)
// unless --hold is passed to keep one pending.
//
//   node scripts/import-drive-photo.js --num 1 --url "<drive link>" --num 13 --url "<drive link>"
//   node scripts/import-drive-photo.js --num 1 --file ~/Downloads/adams.jpg      (private Drive file: download it first)
//   ... --apply [--hold]    (needs UPSTASH_REDIS_REST_URL/TOKEN + PHOTOS_READ_WRITE_TOKEN)
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const MAX_BYTES=5*1024*1024;
function driveFileId(link){
  const s=String(link||'').trim();let m;
  if((m=s.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]{10,})/)))return m[1];
  if((m=s.match(/^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]{10,})/)))return m[1];
  return null;
}
function sniffImage(buf){
  if(!buf||buf.length<12)return null;
  if(buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF)return {type:'image/jpeg',ext:'jpg'};
  if(buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])))return {type:'image/png',ext:'png'};
  if(buf.slice(0,4).toString('latin1')==='RIFF'&&buf.slice(8,12).toString('latin1')==='WEBP')return {type:'image/webp',ext:'webp'};
  if(buf.slice(0,3).toString('latin1')==='GIF')return {type:'image/gif',ext:'gif'};
  return null;
}
function validateDownload({status,contentType,buf}){
  if(status!==200)return 'Drive returned HTTP '+status+' (is the file shared as "Anyone with the link"?)';
  if(/text\/html/i.test(contentType||''))return 'Drive returned a web page, not the photo (file is private or needs a sign-in)';
  if(!buf||!buf.length)return 'empty download';
  if(buf.length>MAX_BYTES)return 'photo is '+(buf.length/1048576).toFixed(1)+' MB; limit is 5 MB';
  if(!sniffImage(buf))return 'file is not a JPEG, PNG, WebP or GIF';
  return null;
}
function buildRecord({url,pathname,status,driveId,now}){return {id:randomUUID(),url,pathname,status:status==='pending'?'pending':'approved',uploadedAt:(now||new Date()).toISOString(),source:'drive-import',driveId}}
function knownListings(){
  const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0],ctx={};
  vm.runInNewContext(src+';this.data={listings};',ctx,{timeout:500});
  return new Map(ctx.data.listings.filter(x=>!x.placeholder).map(x=>[x.num,x.name]));
}
function parseArgs(argv){
  const pairs=[];let cur={},apply=false,hold=false;
  for(let i=0;i<argv.length;i++){const a=argv[i];
    if(a==='--apply')apply=true;else if(a==='--approve'){/* default now; accepted for old commands */}else if(a==='--hold')hold=true;
    else if(a==='--num'){if(cur.num!=null&&cur.url==null&&cur.file==null)throw new Error('--num without --url or --file');if(cur.num!=null){pairs.push(cur);cur={}}cur.num=Number(argv[++i])}
    else if(a==='--url'){cur.url=argv[++i];if(cur.num==null)throw new Error('--url before --num');pairs.push(cur);cur={}}
    else if(a==='--file'){cur.file=argv[++i];if(cur.num==null)throw new Error('--file before --num');pairs.push(cur);cur={}}
    else throw new Error('unknown argument '+a)}
  if(cur.num!=null)throw new Error('--num without --url or --file');
  return {pairs,apply,hold};
}
async function download(id){
  const res=await fetch('https://drive.google.com/uc?export=download&id='+encodeURIComponent(id),{redirect:'follow',signal:AbortSignal.timeout(30000)});
  const buf=Buffer.from(await res.arrayBuffer());
  return {status:res.status,contentType:res.headers.get('content-type')||'',buf};
}
async function redis(command){
  const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  const d=await r.json();if(!r.ok||d.error)throw new Error('Storage request failed');return d.result;
}
async function main(){
  const {pairs,apply,hold}=parseArgs(process.argv.slice(2));
  if(!pairs.length){console.error('Usage: --num N --url "<drive link>" [...] [--apply [--hold]]');process.exit(2)}
  const houses=knownListings();let bad=0;const ready=[];
  for(const {num,url,file} of pairs){
    const name=houses.get(num),id=file?'file-'+require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,16):driveFileId(url);
    if(!name){console.log(`FAIL  #${num}: not a listing`);bad++;continue}
    if(!id){console.log(`FAIL  #${num} ${name}: not a Google Drive file link`);bad++;continue}
    const d=file?{status:200,contentType:'',buf:fs.readFileSync(file)}:await download(id),err=validateDownload(d);
    if(err){console.log(`FAIL  #${num} ${name}: ${err}`);bad++;continue}
    const img=sniffImage(d.buf);console.log(`OK    #${num} ${name}: ${img.type}, ${(d.buf.length/1024).toFixed(0)} KB, source ${id}`);ready.push({num,id,img,buf:d.buf});
  }
  if(bad)process.exit(1);
  if(!apply){console.log('\nDry run: nothing written. Re-run with --apply to publish (add --hold to keep it pending).');return}
  const {put}=require('@vercel/blob');const blobToken=process.env.PHOTOS_READ_WRITE_TOKEN||process.env.BLOB_READ_WRITE_TOKEN;
  if(!blobToken||!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL))throw new Error('Missing UPSTASH_REDIS_REST_URL/TOKEN or PHOTOS_READ_WRITE_TOKEN');
  for(const {num,id,img,buf} of ready){
    const key='hauntfinder:2026:photos:'+num,existing=(await redis(['LRANGE',key,0,49])||[]).map(r=>{try{return typeof r==='string'?JSON.parse(r):r}catch{return null}});
    if(existing.some(p=>p&&p.driveId===id)){console.log(`SKIP  #${num}: this Drive file is already imported`);continue}
    const blob=await put(`hauntfinder-import/${num}-${id}.${img.ext}`,buf,{access:'public',addRandomSuffix:true,contentType:img.type,token:blobToken});
    const rec=buildRecord({url:blob.url,pathname:blob.pathname,status:hold?'pending':'approved',driveId:id});
    await redis(['LPUSH',key,JSON.stringify(rec)]);console.log(`DONE  #${num}: ${rec.status} -> ${blob.url}`);
  }
  console.log('\nPublic API caches 60s: check /api/photos?num=N after a minute.');
}
if(require.main===module)main().catch(e=>{console.error('ERROR '+e.message);process.exit(1)});
module.exports={driveFileId,sniffImage,validateDownload,buildRecord,parseArgs,MAX_BYTES};
