// Read-only browser checks for /listing.html at 1280px and 390px.
//   node scripts/e2e-listing.js [base-url]      (default http://localhost:8765)
// Blocks /api/visits and aborts every non-GET /api call; nothing is posted.
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks: npm i -D playwright');process.exit(2)}
let fails=0;const ok=(name,pass,detail='')=>{console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`);if(!pass)fails++};
const PAGES=[{q:'?id=12',title:'Harvesters of Souls'}];
(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  for(const vp of [1280,390]){
    const ctx=await browser.newContext({viewport:{width:vp,height:800}});
    await ctx.route('**/api/visits**',r=>r.abort());
    await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    for(const pg of PAGES){
      const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      const T=`${vp}px listing.html${pg.q}: `;
      const res=await p.goto(`${BASE}/listing.html${pg.q}`,{waitUntil:'networkidle'});await p.waitForTimeout(600);
      const r=await p.evaluate(()=>({h1:[...document.querySelectorAll('h1')].map(h=>h.textContent.trim()),dialog:document.querySelectorAll('dialog').length,overflow:document.documentElement.scrollWidth>innerWidth,feedback:!!document.getElementById('feedback'),mapLink:(document.querySelector('a[href*="view=map"]')||{}).getAttribute&&document.querySelector('a[href*="view=map"]').getAttribute('href')}));
      ok(T+'200, one h1 with the listing name',res.status()===200&&r.h1.length===1&&r.h1[0]===pg.title,JSON.stringify(r.h1));
      ok(T+'no dialogs, no horizontal overflow',!r.dialog&&!r.overflow);
      ok(T+'feedback section present',r.feedback);
      ok(T+'map link carries the stable number',/[?&]house=12\b/.test(r.mapLink||''),String(r.mapLink));
      ok(T+'no page errors',errors.length===0,errors.join(' | '));
      await p.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(fails?`\n${fails} check(s) FAILED`:'\nAll listing checks passed.');process.exit(fails?1:0);
})();
