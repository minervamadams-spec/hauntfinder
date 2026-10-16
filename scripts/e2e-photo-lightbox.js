// Photo lightbox (PHOTO-PORTRAIT-FIX.md section 2, panel P6). Read-only; stubs /api/photos
// with a generated 300x400 portrait PNG for listing 13 (Glens Terror Drive).
//   node scripts/e2e-photo-lightbox.js [base-url]      (default http://localhost:8765)
const zlib=require('node:zlib');
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks');process.exit(2)}
let fails=0;const ok=(n,p,d='')=>{console.log(`${p?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);if(!p)fails++};
function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}let crc=0xFFFFFFFF;for(const b of buf)crc=t[(crc^b)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));return Buffer.concat([len,td,crc])}
function png(w,h){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;const row=Buffer.alloc(1+w*3);for(let x=0;x<w;x++){row[1+x*3]=200;row[2+x*3]=60;row[3+x*3]=40}const raw=Buffer.concat(Array.from({length:h},()=>row));return Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
const PHOTO=png(300,400);
(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  for(const vp of [{w:1280,h:900,touch:false},{w:390,h:844,touch:true}]){
    const ctx=await browser.newContext({viewport:{width:vp.w,height:vp.h},hasTouch:vp.touch,isMobile:vp.touch});
    await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    await ctx.route('**/api/photos?num=*',r=>{const n=new URL(r.request().url()).searchParams.get('num');r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({photos:n==='13'?[{id:'t',url:BASE+'/__portrait.png',pathname:'p'}]:[]})})});
    await ctx.route('**/__portrait.png',r=>r.fulfill({status:200,contentType:'image/png',body:PHOTO}));
    await ctx.route('**/api/visits**',r=>r.abort());
    const p=await ctx.newPage(),T=`${vp.w}px lightbox: `,errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(`${BASE}/?category=displays`,{waitUntil:'networkidle'});await p.waitForTimeout(2500);
    const card=p.locator('#cardList [data-card="13"]');await card.scrollIntoViewIfNeeded();
    // ---- card back trigger
    await card.locator('.card__photo-pill').click();await p.waitForTimeout(900);
    const tb=await p.evaluate(()=>{const b=document.querySelector('#cardList [data-card="13"] .photo-trigger');return b&&{label:b.getAttribute('aria-label'),icon:!!b.querySelector('.photo-trigger__icon'),iconSize:(i=>i&&[Math.round(i.getBoundingClientRect().width),Math.round(i.getBoundingClientRect().height)])(b.querySelector('.photo-trigger__icon'))}});
    ok(T+'the card back photo is a button labelled "View larger photo of {name}" with a 28px corner icon',!!tb&&tb.label==='View larger photo of Glens Terror Drive'&&tb.icon&&tb.iconSize[0]===28,JSON.stringify(tb));
    await card.locator('.photo-trigger').click();await p.waitForTimeout(500);
    const lb=await p.evaluate(()=>{const l=document.querySelector('.lightbox');if(!l)return null;const i=l.querySelector('.lightbox__img'),r=i.getBoundingClientRect(),lr=l.getBoundingClientRect(),sc=Math.min(r.width/i.naturalWidth,r.height/i.naturalHeight),content=[Math.round(i.naturalWidth*sc),Math.round(i.naturalHeight*sc)],cl=l.querySelector('.lightbox__close').getBoundingClientRect();return {content,role:l.getAttribute('role'),modal:l.getAttribute('aria-modal'),z:+getComputedStyle(l).zIndex,box:[Math.round(lr.width),Math.round(lr.height)],img:[Math.round(r.width),Math.round(r.height)],inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,fit:getComputedStyle(i).objectFit,nat:[i.naturalWidth,i.naturalHeight],close:[Math.round(cl.width),Math.round(cl.height)],focus:document.activeElement.className,locked:document.documentElement.classList.contains('lightbox-open')?'hidden':'open',title:l.querySelector('.lightbox__meta strong').textContent,vh:innerHeight,vw:innerWidth}});
    ok(T+'opens as an aria-modal dialog above the map, focus on the 44px ×',!!lb&&lb.role==='dialog'&&lb.modal==='true'&&lb.z>=3000&&lb.close[0]===44&&/lightbox__close/.test(lb.focus),JSON.stringify(lb));
    ok(T+'the whole photo is shown (contain, inside the screen) and the page scroll is locked',!!lb&&lb.fit==='contain'&&lb.inside&&lb.locked==='hidden'&&lb.nat[0]===300,JSON.stringify({img:lb&&lb.img,vh:lb&&lb.vh}));
    if(vp.touch)ok(T+'mobile: edge to edge (overlay = viewport, photo fills the width)',lb.box[0]===lb.vw&&lb.box[1]===lb.vh&&lb.img[0]===lb.vw,JSON.stringify({box:lb.box,img:lb.img}));
    else ok(T+'desktop: the portrait photo fills the screen height under the top bar (100dvh - 140px), whole photo visible',Math.abs(lb.content[1]-(lb.vh-140))<=2&&Math.abs(lb.content[0]/lb.content[1]-300/400)<0.01,JSON.stringify({content:lb.content,expected:lb.vh-140}));
    const closed=async()=>p.evaluate(()=>!document.querySelector('.lightbox'));
    // close paths, each reopening from the card back
    await p.locator('.lightbox__close').click();await p.waitForTimeout(400);
    const afterX=await p.evaluate(()=>({gone:!document.querySelector('.lightbox'),focus:document.activeElement.className,flipped:document.querySelector('#cardList [data-card="13"]').classList.contains('is-flipped'),unlocked:!document.documentElement.classList.contains('lightbox-open')}));
    ok(T+'× closes, returns focus to the photo trigger, keeps the card flipped, unlocks scroll',afterX.gone&&/photo-trigger/.test(afterX.focus)&&afterX.flipped&&afterX.unlocked,JSON.stringify(afterX));
    await card.locator('.photo-trigger').click();await p.waitForTimeout(400);await p.keyboard.press('Escape');await p.waitForTimeout(400);
    ok(T+'Esc closes',await closed());
    await card.locator('.photo-trigger').click();await p.waitForTimeout(400);
    await p.mouse.click(Math.round(lb.vw/2)+(lb.img[0]/2)+12>lb.vw?4:Math.min(lb.vw-4,Math.round(lb.vw/2+lb.img[0]/2+12)),Math.round(lb.vh/2));await p.waitForTimeout(400);
    const outsideClosed=await closed();
    if(vp.touch){ok(T+'(mobile: photo fills the width, so there is no outside area; tap on the top bar title keeps it open)',true);if(!outsideClosed){await p.keyboard.press('Escape');await p.waitForTimeout(300)}}
    else ok(T+'a tap on the dark background outside the photo closes',outsideClosed);
    await card.locator('.photo-trigger').click();await p.waitForTimeout(400);
    const histLen=await p.evaluate(()=>history.state&&history.state.hfLightbox);
    await p.goBack().catch(()=>{});await p.waitForTimeout(500);
    const backOk=await p.evaluate(()=>({gone:!document.querySelector('.lightbox'),stillHere:location.search.includes('category=displays'),flipped:document.querySelector('#cardList [data-card="13"]')&&document.querySelector('#cardList [data-card="13"]').classList.contains('is-flipped')}));
    ok(T+'Back closes it (one history entry) and stays on the same page with the card still flipped',histLen===1&&backOk.gone&&backOk.stillHere&&backOk.flipped,JSON.stringify({histLen,backOk}));
    // popup trigger
    await card.locator('.card__details-btn').click().catch(()=>{});await p.waitForTimeout(500);
    if(!vp.touch){
      await card.locator('.card__hours').click();await p.waitForTimeout(2000);
      const pt=await p.evaluate(()=>{const b=document.querySelector('.map-popup__photo .photo-trigger');return b&&{label:b.getAttribute('aria-label'),sub:b.dataset.sub}});
      ok(T+'the map popup photo is a labelled trigger too',!!pt&&pt.label==='View larger photo of Glens Terror Drive',JSON.stringify(pt));
      await p.locator('.map-popup__photo .photo-trigger').click();await p.waitForTimeout(500);
      const pl=await p.evaluate(()=>({open:!!document.querySelector('.lightbox'),title:(document.querySelector('.lightbox__meta strong')||{}).textContent,fits:(()=>{const r=document.querySelector('.lightbox__img').getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0})()}));
      ok(T+'popup photo opens the same lightbox, whole photo on screen',pl.open&&pl.title==='Glens Terror Drive'&&pl.fits,JSON.stringify(pl));
      await p.keyboard.press('Escape');await p.waitForTimeout(400);
      ok(T+'closing returns to the same popup, nothing reset',await p.evaluate(()=>!!document.querySelector('.map-popup__photo')&&!document.querySelector('.lightbox')));
    }else{
      // swipe down closes (synthetic touch events; pinch zoom is the browser's own via touch-action:pinch-zoom)
      await card.locator('.card__photo-pill').click();await p.waitForTimeout(700);await card.locator('.photo-trigger').click();await p.waitForTimeout(500);
      await p.evaluate(()=>{const l=document.querySelector('.lightbox');const mk=(type,y)=>{const t=new Touch({identifier:1,target:l,clientX:200,clientY:y});l.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}))};mk('touchstart',300);mk('touchmove',340);mk('touchmove',420);mk('touchend',420)});
      await p.waitForTimeout(500);
      ok(T+'swipe down (over 80px) closes it',await closed());
      await card.locator('.photo-trigger').click();await p.waitForTimeout(500);
      await p.evaluate(()=>{const l=document.querySelector('.lightbox');const mk=(type,y)=>{const t=new Touch({identifier:1,target:l,clientX:200,clientY:y});l.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}))};mk('touchstart',300);mk('touchmove',330);mk('touchend',330)});
      await p.waitForTimeout(400);
      ok(T+'a short drag (under 80px) does not close it',!(await closed()));
      const pz=await p.evaluate(()=>getComputedStyle(document.querySelector('.lightbox__img')).touchAction);
      ok(T+'the photo allows pinch zoom (touch-action: pinch-zoom)',/pinch-zoom/.test(pz),pz);
      await p.keyboard.press('Escape');await p.waitForTimeout(300);
    }
    ok(T+'no page errors',errors.length===0,errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails?`\n${fails} check(s) FAILED`:'\nAll photo lightbox checks passed.');process.exit(fails?1:0);
})();
