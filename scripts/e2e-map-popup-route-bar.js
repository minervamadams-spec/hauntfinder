// Read-only browser regression checks for the map preview / route-bar boundary.
//   node scripts/e2e-map-popup-route-bar.js [base-url]
// Blocks telemetry and every non-GET API request so production runs create no QA data.
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks: npm i -D playwright');process.exit(2)}
let fails=0;const ok=(name,pass,detail='')=>{console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?' — '+detail:''}`);if(!pass)fails++};
const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));

(async()=>{
 const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
 for(const vp of [{width:1440,height:900},{width:1095,height:841},{width:768,height:1024},{width:390,height:844}]){
  const desktop=vp.width>=1024,label=`${vp.width}x${vp.height}: `;
  const ctx=await browser.newContext({viewport:vp,...(desktop?{}:{hasTouch:true,isMobile:vp.width<768})});
  await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
  await ctx.route('**/api/visits**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({visits:508})}));
  const page=await ctx.newPage();
  await page.goto(BASE+'/?category=displays&zip=07828&mi=50',{waitUntil:'networkidle'});await page.waitForTimeout(700);
  if(!desktop){await page.click('#viewToggle');await page.waitForTimeout(500)}
  const selected=await page.evaluate(()=>listings.find(x=>x.name==='Joanow Holiday Displays')?.num||activeListings().find(x=>!x.placeholder)?.num);
  await page.evaluate(n=>markerByNum.get(n).fire('click'),selected);await page.waitForTimeout(300);
  const geometry=await page.evaluate(({desktop})=>{
   const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
   const add=rect('[data-peek-route]'),popup=rect('.map-popup'),bar=rect(desktop?'#routeSection':'#mobileBar'),full=rect('[data-peek-full]');
   return {intersection:Math.max(0,Math.min(popup.right,bar.right)-Math.max(popup.left,bar.left))*Math.max(0,Math.min(popup.bottom,bar.bottom)-Math.max(popup.top,bar.top)),hit:document.elementFromPoint(add.left+add.width/2,add.bottom-4)?.closest('[data-peek-route]')?.hasAttribute('data-peek-route')===true,fullVisible:full.width>0&&full.height>0,popup,bar,add,full};
  },{desktop});
  ok(label+'map preview and route control do not overlap; Add to route owns its lower hit target; Full details is mobile-only',geometry.intersection===0&&geometry.hit&&(desktop?!geometry.fullVisible:geometry.fullVisible),JSON.stringify(geometry));
  if(!desktop){
   await page.click('[data-peek-full]');await page.waitForTimeout(150);
   const fullDetails=await page.evaluate(({n})=>{const card=document.querySelector(`#cardList [data-card="${n}"]`),box=card.getBoundingClientRect();return {peekHidden:document.getElementById('mapPeek').classList.contains('is-hidden'),selected:card.classList.contains('is-selected'),inView:box.bottom>0&&box.top<innerHeight}},{n:selected});
   ok(label+'Full details opens the selected listing card',fullDetails.peekHidden&&fullDetails.selected&&fullDetails.inView,JSON.stringify(fullDetails));
   await page.click('#viewToggle');await page.waitForTimeout(150);
  }
  await page.evaluate(n=>markerByNum.get(n).fire('click'),selected);await page.waitForTimeout(150);
  // The preceding hit-target assertion is the interaction check. Force only lets
  // the suite continue on the known-broken build to record every viewport.
  await page.locator('[data-peek-route]').click({force:true});await page.waitForTimeout(200);
  const added=await page.evaluate(()=>({count:state.route.length,badge:document.getElementById(innerWidth>=1024?'routeBadge':'routeBarCount').textContent}));
  ok(label+'popup Add to route updates the route count',added.count===1&&/^1(?: of 10 stops)?$/.test(added.badge),JSON.stringify(added));
  if(desktop){
   await page.evaluate(()=>activeListings().filter(x=>!x.placeholder).slice(1,6).forEach(x=>toggleRoute(x.num)));await page.waitForTimeout(150);
   await page.click('#routeToggle');await page.waitForTimeout(200);
   await page.evaluate(n=>selectListing(n),selected);await page.waitForTimeout(200);
   const expanded=await page.evaluate(()=>{const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom}};const p=rect('#mapPeek'),r=rect('#routeSection');return {intersection:Math.max(0,Math.min(p.right,r.right)-Math.max(p.left,r.left))*Math.max(0,Math.min(p.bottom,r.bottom)-Math.max(p.top,r.top)),stops:document.querySelectorAll('#routeStopsMini .route-stop').length,full:document.querySelector('[data-peek-full]').getBoundingClientRect().height}});
   ok(label+'expanded multi-stop route also clears the preview; Full details stays hidden on desktop',expanded.intersection===0&&expanded.stops>=2&&expanded.full===0,JSON.stringify(expanded));
  }
  await ctx.close();
 }
 await browser.close();
 if(fails){console.error(`\n${fails} check(s) failed.`);process.exit(1)}
 console.log('\nAll map popup / route bar checks passed.');
})().catch(e=>{console.error(e);process.exit(1)});
