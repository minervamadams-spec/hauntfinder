// Photo flip card regression (design: Hauntfinder Photo Card.dc.html). Read-only:
// stubs /api/photos for listings 1 and 13 with a generated image, never posts.
//   node scripts/e2e-photo-card.js [base-url]      (default http://localhost:8765)
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks');process.exit(2)}
let fails=0;const ok=(n,p,d='')=>{console.log(`${p?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);if(!p)fails++};
// 4x3 solid JPEG-ish photo: a tall natural size on purpose, so any layout that uses the image's own height shows up.
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGNgYGD4z0AEAAAXAAHp7Cm9AAAAAElFTkSuQmCC','base64');
(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  for(const vp of [1280,390,320]){
    const ctx=await browser.newContext({viewport:{width:vp,height:900}});
    await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    await ctx.route('**/api/photos?num=*',r=>{const n=new URL(r.request().url()).searchParams.get('num');r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({photos:(n==='1'||n==='13')?[{id:'t'+n,url:BASE+'/__photo.png',pathname:'p'}]:[]})})});
    await ctx.route('**/__photo.png',r=>r.fulfill({status:200,contentType:'image/png',body:PNG}));
    await ctx.route('**/api/visits**',r=>r.abort());
    const p=await ctx.newPage(),T=`${vp}px photo card: `;
    await p.goto(`${BASE}/?category=displays`,{waitUntil:'networkidle'});await p.waitForTimeout(2500);
    const m=await p.evaluate(()=>{
      const cards=[...document.querySelectorAll('#cardList .card--compact')];
      const info=c=>{const cr=c.getBoundingClientRect(),f=c.querySelector('.card-face--front')||c;const rows=[...f.children].filter(e=>e.getBoundingClientRect().height>0).map(e=>e.getBoundingClientRect());const name=c.querySelector('.card__name'),pill=c.querySelector('.card__photo-pill');const nr=name&&name.getBoundingClientRect(),pr=pill&&pill.getBoundingClientRect();const share=[...c.querySelectorAll('.card__metalink')].filter(e=>e.getClientRects().length).pop();return {n:(name||{}).textContent,flip:c.classList.contains('card--flip'),h:Math.round(cr.height),noOverlap:rows.slice(1).every((r,i)=>r.top>=rows[i].bottom-9),pillSameRow:pr?Math.abs((nr.top+nr.height/2)-(pr.top+pr.height/2))<8:null,pillAfterName:pr?pr.left>=nr.right-1:null,shareInside:share?(cr.right-share.getBoundingClientRect().right)>=13:true,inner:c.querySelector('.card-flip__inner')?Math.round(c.querySelector('.card-flip__inner').getBoundingClientRect().height):null}};
      return cards.map(info)});
    const flips=m.filter(x=>x.flip),plain=m.filter(x=>!x.flip&&x.h>0);
    ok(T+'listings 1 and 13 become flip cards',flips.length===2,flips.map(x=>x.n).join(', '));
    const tallest=Math.max(...plain.map(x=>x.h));
    ok(T+'flip cards are no taller than the tallest ordinary card (no runaway height)',flips.every(x=>x.h<=tallest+4),JSON.stringify({flips:flips.map(x=>x.h),tallest}));
    ok(T+'no rows overlap on the front',flips.every(x=>x.noOverlap));
    ok(T+'the Photo pill sits on the title row after the name',flips.every(x=>x.pillSameRow&&x.pillAfterName));
    ok(T+'nothing pokes past the card padding',flips.every(x=>x.shareInside));
    const card=p.locator('#cardList [data-card="1"]');await card.scrollIntoViewIfNeeded();
    await card.locator('.card__photo-pill').click();await p.waitForTimeout(900);
    const f=await p.evaluate(()=>{const c=document.querySelector('#cardList [data-card="1"]'),ph=c.querySelector('.card__photo'),front=c.querySelector('.card-face--front'),back=c.querySelector('.card-face--back');return {flipped:c.classList.contains('is-flipped'),card:Math.round(c.getBoundingClientRect().height),back:Math.round(back.getBoundingClientRect().height),front:Math.round(front.getBoundingClientRect().height),photo:Math.round(ph.getBoundingClientRect().height),loaded:!!ph.getAttribute('src'),alt:ph.alt,frontInert:front.inert,backInert:back.inert,frontHidden:front.getAttribute('aria-hidden'),focus:document.activeElement.className}});
    ok(T+'the back is exactly as tall as the front, never the photo',f.flipped&&f.back===f.front&&f.photo<=f.back,JSON.stringify(f));
    ok(T+'the photo loads on the first flip with its alt text',f.loaded&&/^Photo of /.test(f.alt),f.alt);
    ok(T+'the hidden face is inert and aria-hidden; focus moves to Details',f.frontInert&&!f.backInert&&f.frontHidden==='true'&&/card__details-btn/.test(f.focus));
    await card.locator('.card__details-btn').click();await p.waitForTimeout(900);
    const back=await p.evaluate(()=>{const c=document.querySelector('#cardList [data-card="1"]');return {flipped:c.classList.contains('is-flipped'),backInert:c.querySelector('.card-face--back').inert,focus:document.activeElement.className}});
    ok(T+'flipping back restores focus to the Photo pill',!back.flipped&&back.backInert&&/card__photo-pill/.test(back.focus),JSON.stringify(back));
    if(vp===1280){
      // PHOTO-PORTRAIT-FIX: never cropped. Back face and 16:9 popup use contain on #0E0B13.
      const back2=await p.evaluate(()=>{const c=document.querySelector('#cardList [data-card="1"]'),i=c.querySelector('.card__photo'),f=c.querySelector('.card-face--back');return {fit:getComputedStyle(i).objectFit,orient:getComputedStyle(i).imageOrientation,bg:getComputedStyle(f).backgroundColor}});
      ok(T+'card back never crops: object-fit contain on #0E0B13',back2.fit==='contain'&&back2.bg==='rgb(14, 11, 19)'&&back2.orient==='from-image',JSON.stringify(back2));
      await p.locator('#cardList [data-card="13"] .card__hours').scrollIntoViewIfNeeded();await p.locator('#cardList [data-card="13"] .card__hours').click();await p.waitForTimeout(2000);
      const pop=await p.evaluate(()=>{const f=document.querySelector('.map-popup__photo'),i=f&&f.querySelector('img');if(!i)return null;const r=f.getBoundingClientRect();return {ratio:+(r.width/r.height).toFixed(2),fit:getComputedStyle(i).objectFit,bg:getComputedStyle(f).backgroundColor,orient:getComputedStyle(i).imageOrientation}});
      ok(T+'map popup photo is a 16:9 frame, contain on #0E0B13',!!pop&&Math.abs(pop.ratio-1.78)<0.03&&pop.fit==='contain'&&pop.bg==='rgb(14, 11, 19)'&&pop.orient==='from-image',JSON.stringify(pop));
      // EXIF: a landscape JPEG tagged Orientation=6 must be stored upright (portrait) and without EXIF.
      const ex=await p.evaluate(async()=>{
        const c=document.createElement('canvas');c.width=40;c.height=20;const g=c.getContext('2d');g.fillStyle='#c33';g.fillRect(0,0,40,20);
        const base=new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/jpeg',0.9))).arrayBuffer());
        const tiff=[0x4D,0x4D,0,0x2A,0,0,0,8, 0,1, 0x01,0x12, 0,3, 0,0,0,1, 0,6,0,0, 0,0,0,0];
        const body=[0x45,0x78,0x69,0x66,0,0,...tiff],len=body.length+2;
        const out=new Uint8Array(base.length+4+body.length);out.set(base.slice(0,2),0);out.set([0xFF,0xE1,len>>8,len&255,...body],2);out.set(base.slice(2),2+4+body.length);
        const file=new File([out],'phone.jpg',{type:'image/jpeg'});
        const rawDims=await createImageBitmap(file,{imageOrientation:'from-image'}).then(b=>[b.width,b.height]);
        const norm=await hfNormalizePhoto(file);const dims=await createImageBitmap(norm,{imageOrientation:'from-image'}).then(b=>[b.width,b.height]);
        const bytes=new Uint8Array(await norm.arrayBuffer());let hasExif=false;for(let i=0;i<bytes.length-4;i++)if(bytes[i]===0x45&&bytes[i+1]===0x78&&bytes[i+2]===0x69&&bytes[i+3]===0x66){hasExif=true;break}
        return {rawDims,dims,type:norm.type,hasExif,name:norm.name};
      });
      ok(T+'uploads are re-drawn upright and carry no EXIF',ex.rawDims[0]===20&&ex.rawDims[1]===40&&ex.dims[0]===20&&ex.dims[1]===40&&ex.type==='image/jpeg'&&!ex.hasExif,JSON.stringify(ex));
    }
    await ctx.close();
  }
  await browser.close();
  console.log(fails?`\n${fails} check(s) FAILED`:'\nAll photo card checks passed.');process.exit(fails?1:0);
})();
