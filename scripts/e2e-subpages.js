// Read-only: every standalone page must be fully reachable by normal scrolling at a short desktop window and on mobile.
//   node scripts/e2e-subpages.js [base-url]      (default http://localhost:8765)
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright: npm i -D playwright');process.exit(2)}
let fails=0;const ok=(n,p,d='')=>{console.log(`${p?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);if(!p)fails++};
const PAGES=['about.html','listing.html?id=12','route.html','alerts.html','submit.html','newsletter-setup.html'];
(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  for(const [w,h] of [[1440,600],[390,700]]){
    const ctx=await browser.newContext({viewport:{width:w,height:h}});
    await ctx.route('**/api/visits**',r=>r.abort());await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    const p=await ctx.newPage();
    for(const u of PAGES){
      await p.goto(`${BASE}/${u}`,{waitUntil:'networkidle'});await p.waitForTimeout(400);
      const r=await p.evaluate(()=>{let max=0;document.querySelectorAll('body *').forEach(e=>{const b=e.getBoundingClientRect();if(b.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]'))max=Math.max(max,b.bottom+scrollY)});scrollTo(0,99999);return {content:Math.round(max),reached:Math.round(scrollY+innerHeight),inner:innerHeight,overflowX:document.documentElement.scrollWidth>innerWidth}});
      ok(`${w}px ${u}: the whole page is reachable by scrolling, no horizontal overflow`,r.reached>=r.content-2&&!r.overflowX,JSON.stringify(r));
    }
    await ctx.close();
  }
  await browser.close();console.log(fails?`\n${fails} check(s) FAILED`:'\nAll standalone-page scroll checks passed.');process.exit(fails?1:0);
})();
