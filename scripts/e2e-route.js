// Browser checks for /route.html and the homepage route entry points, at 1280px and 390px.
//   node scripts/e2e-route.js [base-url]      (default http://localhost:8765)
// Needs the `playwright` package (HF_CHROMIUM may point at a Chromium binary).
// Route QA uses browser storage only: /api/visits is blocked, every non-GET API
// call is aborted, and Google Maps is never opened (window.open is captured).
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks: npm i -D playwright');process.exit(2)}
let fails=0;const ok=(name,pass,detail='')=>{console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`);if(!pass)fails++};
const KEY='hfroute:2026';

const view=()=>{
  const items=[...document.querySelectorAll('#routeStops .route-stop')];
  const scrollers=[...document.querySelectorAll('body *')].filter(e=>{const cs=getComputedStyle(e);return /(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1&&e.clientHeight>0}).map(e=>e.id||e.className);
  return {h1:[...document.querySelectorAll('h1')].map(h=>h.textContent.trim()),empty:!document.getElementById('routeEmpty').hidden,body:!document.getElementById('routeBody').hidden,
    keys:items.map(li=>li.dataset.stopKey),names:items.map(li=>li.querySelector('.route-stop__name').textContent.trim()),cats:items.map(li=>li.querySelector('.route-stop__category').textContent.trim()),
    hrefs:items.map(li=>li.querySelector('.route-stop__name').getAttribute('href')),summary:document.getElementById('routeSummary').textContent.trim(),status:(document.getElementById('routeOrderStatus')||{}).textContent||'',
    stored:localStorage.getItem('hfroute:2026'),url:location.pathname+location.search,dialogs:document.querySelectorAll('dialog').length,scrollers,overflowX:document.documentElement.scrollWidth>innerWidth,active:document.activeElement&&(document.activeElement.id||document.activeElement.dataset.removeStop||document.activeElement.dataset.moveStop||document.activeElement.tagName)};
};

(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  for(const vp of [{name:'1280',width:1280,height:800},{name:'390',width:390,height:844}]){
    const T=vp.name+'px: ';
    const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height}});
    await ctx.route('**/api/visits**',r=>r.abort());
    await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    await ctx.addInitScript(()=>{window.__opened=[];window.open=(u)=>{window.__opened.push(String(u));return null}});
    const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    const go=async q=>{await p.goto(BASE+q,{waitUntil:'networkidle'});await p.waitForTimeout(300)};
    const v=()=>p.evaluate(view);

    // ---- Empty route ----
    await go('/route.html');
    let s=await v();
    ok(T+'direct /route.html: one h1, no dialog',s.h1.length===1&&s.h1[0]==='Your route'&&s.dialogs===0,JSON.stringify(s.h1));
    ok(T+'empty route explains and links home',s.empty&&!s.body&&await p.evaluate(()=>!!document.querySelector('#routeEmpty a[href="/"]')),s.summary);
    ok(T+'empty route keeps a clean URL',s.url==='/route.html',s.url);

    // ---- Stored route ----
    await p.evaluate(k=>localStorage.setItem(k,JSON.stringify([{num:12,entityId:'harvesters-of-souls-2026'},{eventId:'best-buddies-safe-trick-or-treat-2026-10-29'},{num:1,entityId:'hauntfinder:2026:listing:1:original'}])),KEY);
    await go('/route.html');s=await v();
    ok(T+'stored route loads in order',JSON.stringify(s.keys)==='["n:12","e:best-buddies-safe-trick-or-treat-2026-10-29","n:1"]',JSON.stringify(s.keys));
    ok(T+'stops show category and link back',JSON.stringify(s.cats)==='["Display","Event","Display"]'&&s.hrefs[0]==='listing.html?id=12'&&s.hrefs[1]==='/?event=best-buddies-safe-trick-or-treat-2026-10-29',JSON.stringify(s.hrefs));
    ok(T+'URL mirrors the stored route',s.url==='/route.html?route=d12,ebest-buddies-safe-trick-or-treat-2026-10-29,d1',s.url);
    ok(T+'no nested scroll, no horizontal overflow',s.scrollers.length===0&&!s.overflowX,s.scrollers.join(','));

    // ---- Reorder by keyboard ----
    await p.focus('[data-move-stop="n:1"][data-direction="-1"]');await p.keyboard.press('Enter');await p.waitForTimeout(100);
    s=await v();
    ok(T+'move earlier (keyboard) updates list, storage and URL',JSON.stringify(s.keys)==='["n:12","n:1","e:best-buddies-safe-trick-or-treat-2026-10-29"]'&&JSON.parse(s.stored).map(x=>x.num||x.eventId).join()==='12,1,best-buddies-safe-trick-or-treat-2026-10-29'&&s.url.endsWith('route=d12,d1,ebest-buddies-safe-trick-or-treat-2026-10-29'),s.url);
    ok(T+'focus stays on the moved stop control',await p.evaluate(()=>{const a=document.activeElement;return !!a&&a.dataset.moveStop==='n:1'}),String(s.active));
    // drag
    await p.dragAndDrop('[data-stop-key="e:best-buddies-safe-trick-or-treat-2026-10-29"]','[data-stop-key="n:12"]');await p.waitForTimeout(100);
    s=await v();
    ok(T+'drag to reorder',s.keys[0]==='e:best-buddies-safe-trick-or-treat-2026-10-29',JSON.stringify(s.keys));

    // ---- Suggest order, directions, share ----
    await p.click('#optimizeRouteBtn');await p.waitForTimeout(100);s=await v();
    ok(T+'suggest order keeps every stop and syncs storage',s.keys.length===3&&JSON.parse(s.stored).length===3&&/Suggested/.test(s.status),s.status);
    await p.click('#mapRouteBtn');const opened=await p.evaluate(()=>window.__opened.slice(-1)[0]||'');
    ok(T+'directions open Google Maps with every stop',opened.startsWith('https://www.google.com/maps/dir/?')&&new URL(opened).searchParams.get('destination')!==null&&(new URL(opened).searchParams.get('waypoints')||'').split('|').length===2,opened.slice(0,90));
    await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:BASE});
    await p.click('#shareRouteBtn');await p.waitForTimeout(150);
    const shared=await p.evaluate(()=>navigator.clipboard.readText().catch(()=>''))||(await v()).status;
    ok(T+'share copies a /route.html?route= link',/\/route\.html\?route=[de]/.test(shared),shared);

    // ---- Remove ----
    const before=(await v()).keys;
    await p.focus('[data-remove-stop="n:12"]');await p.keyboard.press('Enter');await p.waitForTimeout(100);
    s=await v();
    ok(T+'remove updates list, storage and URL',!s.keys.includes('n:12')&&s.keys.length===before.length-1&&!s.stored.includes('"num":12')&&!/d12/.test(s.url),s.url);
    ok(T+'focus lands on a remaining control after remove',s.active!=='BODY',String(s.active));

    // ---- Reload and Back ----
    await p.reload({waitUntil:'networkidle'});await p.waitForTimeout(200);
    ok(T+'reload keeps the edited route',JSON.stringify((await v()).keys)===JSON.stringify(s.keys));
    await go('/');
    const homeCount=await p.evaluate(()=>document.getElementById('routeBadge').textContent);
    if(await p.isHidden('#routeLink'))await p.click('#routeToggle');
    await p.click('#routeLink');await p.waitForLoadState('networkidle');
    ok(T+'homepage "Your route" CTA is a same-tab link to /route.html',(await p.evaluate(()=>location.pathname))==='/route.html'&&p.context().pages().length===1,homeCount);
    await p.click('[data-remove-stop]');await p.waitForTimeout(100);
    const left=(await v()).keys.length;
    await p.goBack({waitUntil:'networkidle'});await p.waitForTimeout(300);
    const back=await p.evaluate(()=>({path:location.pathname,badge:document.getElementById('routeBadge').textContent,route:state.route.length}));
    ok(T+'Back returns to the map with the current route',back.path==='/'&&back.route===left&&back.badge===`${left} of 10 stops`,JSON.stringify(back));

    // ---- Clear with inline confirmation and Escape ----
    await go('/route.html');
    await p.click('#clearRouteBtn');
    let c=await p.evaluate(()=>({open:!document.getElementById('clearConfirm').hidden,focus:document.activeElement.id,dialogs:document.querySelectorAll('dialog,[role=dialog],[aria-modal]').length}));
    ok(T+'clear asks inline, not in a dialog',c.open&&c.focus==='clearNo'&&c.dialogs===0,JSON.stringify(c));
    await p.keyboard.press('Escape');
    c=await p.evaluate(()=>({open:!document.getElementById('clearConfirm').hidden,focus:document.activeElement.id,stops:document.querySelectorAll('#routeStops .route-stop').length}));
    ok(T+'Escape cancels the confirmation and returns focus',!c.open&&c.focus==='clearRouteBtn'&&c.stops===left,JSON.stringify(c));
    await p.click('#clearRouteBtn');await p.click('#clearYes');await p.waitForTimeout(100);
    s=await v();
    ok(T+'clear empties page, storage and URL',s.empty&&s.stored==='[]'&&s.url==='/route.html',s.url);

    // ---- Shared links ----
    await p.evaluate(()=>localStorage.clear());
    await go('/route.html?route=d8~drakestown-road-2026,d12');s=await v();
    ok(T+'?route= link rebuilds stops without storage',JSON.stringify(s.keys)==='["n:8","n:12"]'&&s.hrefs[0]==='listing.html?id=8&entity=drakestown-road-2026'&&JSON.parse(s.stored).length===2,JSON.stringify(s.keys));
    await p.evaluate(()=>localStorage.clear());
    await go('/route.html?route=d8');s=await v();
    ok(T+'bare reused slot d8 never resolves',s.keys.length===0&&s.empty,s.summary);
    await go('/route.html?outing='+encodeURIComponent('harvesters-of-souls-2026')+','+encodeURIComponent('evt:skullys-costume-closet'));s=await v();
    ok(T+'legacy ?outing= link resolves and is rewritten to ?route=',JSON.stringify(s.keys)==='["n:12","e:skullys-costume-closet"]'&&s.url==='/route.html?route=d12,eskullys-costume-closet',s.url);
    await go('/?route=d12');
    ok(T+'homepage ?route= links still load',await p.evaluate(()=>state.route.length===1&&state.route[0].num===12));

    // ---- Ten-stop cap from the homepage ----
    await p.evaluate(k=>localStorage.setItem(k,JSON.stringify(Array.from({length:10},(_,i)=>({num:i+1,entityId:'hauntfinder:2026:listing:'+(i+1)+':original'})).filter(x=>x.num!==8).concat([{num:8,entityId:'drakestown-road-2026'}]))),KEY);
    await go('/?category=displays');
    await p.evaluate(()=>toggleRoute(12));
    const cap=await p.evaluate(()=>({n:state.route.length,msg:document.getElementById('routeStatus').textContent}));
    ok(T+'ten-stop cap holds with the homepage message',cap.n===10&&cap.msg==='Routes can have up to 10 stops.',JSON.stringify(cap));
    ok(T+'homepage has no dialogs',await p.evaluate(()=>document.querySelectorAll('dialog').length===0));
    // Card actions open the listing page sections in the same tab.
    await p.evaluate(()=>localStorage.clear());await go('/?category=displays');
    const links=await p.evaluate(()=>{const c=document.querySelector('#cardList [data-card]'),n=c.dataset.card;return {n,rate:c.querySelector('.card-rating').getAttribute('href'),report:[...c.querySelectorAll('.card__metalink')].map(a=>a.getAttribute('href')),targets:[...c.querySelectorAll('.card-rating,.card__metalink')].map(a=>a.target||'')}});
    ok(T+'card Rate/Report/Share link to the listing sections, same tab',links.rate===`listing.html?id=${links.n}#feedback`&&links.report.join()===`listing.html?id=${links.n}#report-update,listing.html?id=${links.n}#share`&&links.targets.every(t=>!t),JSON.stringify(links));
    await p.click('#cardList [data-card] .card__metalink');await p.waitForLoadState('networkidle');await p.waitForTimeout(300);
    const landed=await p.evaluate(()=>{const s=document.getElementById('report-update'),b=s.getBoundingClientRect();return {path:location.pathname,hash:location.hash,title:document.getElementById('listingTitle').textContent,inView:b.top<innerHeight&&b.bottom>0}});
    ok(T+'Report lands on the listing report section',landed.path==='/listing.html'&&landed.hash==='#report-update'&&landed.inView&&landed.title!=='Listing not found',JSON.stringify(landed));
    await go('/?house=8&entity=drakestown-road-2026');
    ok(T+'reused slot #8 card links keep the entity',await p.evaluate(()=>{const c=document.querySelector('[data-card="8"]');return !!c&&c.querySelector('.card-rating').getAttribute('href')==='listing.html?id=8&entity=drakestown-road-2026#feedback'}));
    ok(T+'no page errors',errors.length===0,errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails?`\n${fails} check(s) FAILED`:'\nAll route checks passed.');
  process.exit(fails?1:0);
})();
