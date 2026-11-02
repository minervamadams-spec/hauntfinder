// Screenshots + checks for the Glowfinder notice. Usage: node scripts/qa-notice.js http://localhost:4173
const {chromium}=require('playwright'),path=require('path');
const base=process.argv[2]||'http://localhost:4173',out=path.join(__dirname,'../docs/qa/glowfinder-notice');
(async()=>{
  const b=await chromium.launch();let bad=0;
  const fail=m=>{bad++;console.log('FAIL',m)};
  for(const [w,h] of [[375,812],[1280,800]]){
    const ctx=await b.newContext({viewport:{width:w,height:h}});
    await ctx.addInitScript(()=>{const R=Date;const fixed=new R('2026-11-05T15:00:00-05:00').getTime();window.Date=class extends R{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}}});
    const p=await ctx.newPage();
    await p.goto(base+'/index.html',{waitUntil:'load'});await p.waitForTimeout(1500);
    const n=p.locator('.gf-notice');
    if(await n.count()!==1){fail(w+': notice missing');continue}
    await p.screenshot({path:`${out}/home-${w}.png`});
    const info=await p.evaluate(()=>{
      const r=e=>e.getBoundingClientRect(),n=document.querySelector('.gf-notice'),nr=r(n);
      const kids=[...n.children].map(r);
      const inter=(a,c)=>a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom;
      let overlapKids=false;for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++)if(inter(kids[i],kids[j]))overlapKids=true;
      const header=document.querySelector('.hf-header')||document.querySelector('.app');
      const hr=r(header);
      const clipped=[...n.children].some(c=>r(c).right>innerWidth+0.5||r(c).left<-0.5);
      return {nh:nr.height,nbottom:nr.bottom,headerTop:hr.top,overlapKids,clipped,hscroll:document.documentElement.scrollWidth>innerWidth,appBottom:r(document.querySelector('.app')).bottom,vh:innerHeight};
    });
    console.log(w,JSON.stringify(info));
    if(info.overlapKids)fail(w+': notice children overlap');
    if(info.clipped)fail(w+': notice clipped');
    if(info.hscroll)fail(w+': horizontal scroll');
    if(info.headerTop<info.nbottom-0.5)fail(w+': notice overlaps page header');
    if(info.appBottom>info.vh+0.5)fail(w+': app shell taller than viewport');
    // keyboard: tab to link then close, Enter dismisses
    await p.keyboard.press('Tab');
    const f1=await p.evaluate(()=>document.activeElement.className);
    await p.keyboard.press('Tab');
    const f2=await p.evaluate(()=>document.activeElement.className);
    if(!/gf-notice__link/.test(f1)||!/gf-notice__close/.test(f2))fail(w+': tab order '+f1+' / '+f2);
    await p.keyboard.press('Enter');
    if(await n.count()!==0)fail(w+': Enter did not dismiss');
    await p.screenshot({path:`${out}/home-${w}-dismissed.png`});
    await p.reload({waitUntil:'load'});await p.waitForTimeout(800);
    if(await p.locator('.gf-notice').count()!==0)fail(w+': reappeared after reload');
    // outside the window nothing shows
    const p2=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
    await p2.addInitScript(()=>{const R=Date;const fixed=new R('2026-10-20T12:00:00-04:00').getTime();window.Date=class extends R{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}}});
    await p2.goto(base+'/index.html',{waitUntil:'load'});await p2.waitForTimeout(600);
    if(await p2.locator('.gf-notice').count()!==0)fail(w+': shown in October');
    if(!(await p2.locator('a:has-text("Winter: Glowfinder")').count()))fail(w+': footer link missing in October');
    // blocked storage
    const p3=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
    await p3.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});const R=Date;const fixed=new R('2026-11-05T15:00:00-05:00').getTime();window.Date=class extends R{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}}});
    await p3.goto(base+'/index.html',{waitUntil:'load'});await p3.waitForTimeout(600);
    if(await p3.locator('.gf-notice').count()!==1)fail(w+': not shown with blocked storage');
    await ctx.close();
  }
  await b.close();console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0);
})();
