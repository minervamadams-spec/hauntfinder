// Browser checks for the compact directory homepage at 1280px and 390px.
//   node scripts/e2e-single-scroll.js [base-url]      (default http://localhost:8765)
// Needs the `playwright` package and a Chromium build (set HF_CHROMIUM to an
// executable path if Playwright's bundled browser is not installed).
// Read-only against any host: page-view counting (/api/visits) is blocked and
// nothing is posted, so production runs create no QA data.
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks: npm i -D playwright');process.exit(2)}
let fails=0;const ok=(name,pass,detail='')=>{console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`);if(!pass)fails++};

const probe=()=>{
  const r=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top+scrollY,bottom:b.bottom+scrollY,left:b.left,width:b.width,height:b.height,vTop:b.top,vBottom:b.bottom}};
  const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
  const scrollers=[...document.querySelectorAll('body *')].filter(e=>{if(e.closest('dialog:not([open])'))return false;const cs=getComputedStyle(e);return /(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1&&e.clientHeight>0}).map(e=>(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ')[0]);
  const cards=[...document.querySelectorAll('#cardList [data-card]')];
  const pins=[...document.querySelectorAll('.leaflet-marker-pane [data-pin]')].map(p=>+p.dataset.pin);
  return {banner:r(document.querySelector('.banner__frame')),intro:r(document.querySelector('.intro-strip__copy')),introFont:parseFloat(getComputedStyle(document.querySelector('.intro-strip__copy')).fontSize),introLH:parseFloat(getComputedStyle(document.querySelector('.intro-strip__copy')).lineHeight),
    filterbar:r(document.querySelector('.filterbar')),mapFrame:visible(document.querySelector('.map-frame'))?r(document.querySelector('.map-frame')):null,
    countLine:r(document.getElementById('countLine')),countText:document.getElementById('countLine').textContent,firstCard:r(cards[0]),lastCard:r(cards[cards.length-1]),
    cardNums:cards.map(c=>+c.dataset.card),cardCols:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().left))).size,
    pager:visible(document.getElementById('resultsPager'))?r(document.getElementById('resultsPager')):null,pageStatus:document.getElementById('pageStatus').textContent,
    prevDisabled:document.getElementById('pagePrev').disabled,nextDisabled:document.getElementById('pageNext').disabled,
    route:r(document.getElementById('routeSection')),calendar:visible(document.getElementById('eventCalendar'))?r(document.getElementById('eventCalendar')):null,
    pins,scrollers,overflowX:document.documentElement.scrollWidth>innerWidth,docScrolls:document.documentElement.scrollHeight>innerHeight,
    category:state.category,filter:state.filter,page:state.page,search:state.search&&state.search.zip+'/'+state.search.radius,
    tabCount:+(document.querySelector({displays:'#displayTabCount',treats:'#treatStopCount',events:'#eventCount'}[state.category]).textContent.replace(/\D/g,'')||0),
    active:document.activeElement&&(document.activeElement.id||document.activeElement.className),selected:state.selected};
};
const countOf=t=>+(String(t).match(/^(\d+)/)||[0,0])[1];

(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  for(const vp of [{name:'1280',width:1280,height:800},{name:'390',width:390,height:844}]){
    const desktop=vp.width>=1024,T=vp.name+'px: ';
    const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height}});
    await ctx.route('**/api/visits**',r=>r.abort());
    await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    const go=async q=>{await p.goto(BASE+'/'+q,{waitUntil:'networkidle'});await p.waitForTimeout(700)};

    // ---- Displays, page 1 ----
    await go('?category=displays');
    let d=await p.evaluate(probe);
    ok(T+'banner within cap',d.banner.height>0&&d.banner.height<=(desktop?180:140)+0.5,`${Math.round(d.banner.height)}px`);
    ok(T+'intro kept'+(desktop?' on one line':''),d.intro&&d.intro.height>0&&(!desktop||d.intro.height<=d.introLH*1.2),`${Math.round(d.intro.height)}px`);
    ok(T+(desktop?'desktop: results left, map right':'mobile: filters, map, count, cards, pager'),desktop?d.filterbar.bottom<=d.mapFrame.top+1&&d.filterbar.bottom<=d.countLine.top+1&&d.mapFrame.left>d.countLine.left&&d.countLine.bottom<=d.firstCard.top&&d.lastCard.bottom<=d.pager.top:d.filterbar.bottom<=d.mapFrame.top+1&&d.mapFrame.bottom<=d.countLine.top&&d.countLine.bottom<=d.firstCard.top&&d.lastCard.bottom<=d.pager.top,JSON.stringify({fb:Math.round(d.filterbar.bottom),map:[Math.round(d.mapFrame.top),Math.round(d.mapFrame.bottom),Math.round(d.mapFrame.left)],count:[Math.round(d.countLine.top),Math.round(d.countLine.left)],card:Math.round(d.firstCard.top),pager:Math.round(d.pager.top)}));
    ok(T+'map sized for this viewport',desktop?d.mapFrame.height>=360&&d.mapFrame.height<=620:Math.abs(d.mapFrame.height-240)<=20,`${Math.round(d.mapFrame.height)}px tall, ${Math.round(d.mapFrame.width)}px wide`);
    ok(T+'map visible before scrolling',d.mapFrame.vTop<vp.height,`map top at ${Math.round(d.mapFrame.vTop)}px`);
    ok(T+'route planner after the results',d.route.top>=d.pager.bottom);
    ok(T+'no nested scroll areas',d.scrollers.length===0,d.scrollers.join(', '));
    ok(T+'no horizontal overflow',!d.overflowX);
    const total=countOf(d.countText);
    ok(T+'page 1 shows 8 cards',d.cardNums.length===Math.min(8,total),`${d.cardNums.length} of ${total}`);
    ok(T+'card column stays compact',d.cardCols===1,`${d.cardCols}`);
    ok(T+'tab count == count line == pins',d.tabCount===total&&d.pins.length===total,`tab ${d.tabCount}, count ${total}, pins ${d.pins.length}`);
    ok(T+'pager position',d.pageStatus===`Page 1 of ${Math.ceil(total/8)} · 1–8 of ${total}`&&d.prevDisabled&&!d.nextDisabled,d.pageStatus);

    // ---- Next page by keyboard ----
    await p.focus('#pageNext');await p.keyboard.press('Enter');await p.waitForTimeout(200);
    let d2=await p.evaluate(probe);
    ok(T+'Next (keyboard) shows the rest',d2.cardNums.length===total-8&&d2.page===1&&d2.pageStatus===`Page 2 of 2 · 9–${total} of ${total}`,d2.pageStatus);
    ok(T+'focus returns to the result count',d2.active==='countLine',String(d2.active));
    ok(T+'count line in view after paging',(await p.evaluate(()=>{const b=document.getElementById('countLine').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight})));
    ok(T+'page change keeps filters, category, search and pins',d2.category==='displays'&&d2.filter===d.filter&&d2.search===d.search&&JSON.stringify(d2.pins.sort())===JSON.stringify(d.pins.sort()));
    ok(T+'no card repeats across pages',new Set([...d.cardNums,...d2.cardNums]).size===total);
    await p.focus('#pagePrev');await p.keyboard.press('Space');await p.waitForTimeout(200);
    ok(T+'Previous (keyboard) returns to page 1',(await p.evaluate(probe)).page===0);

    // ---- Pin on page 2 opens its card page; card selects its pin ----
    const target=d2.cardNums[0];
    await p.evaluate(n=>markerByNum.get(n).fire('click'),target);await p.waitForTimeout(300);
    let d3=await p.evaluate(probe);
    ok(T+'pin on page 2 opens that card page',d3.page===1&&d3.cardNums.includes(target)&&(await p.evaluate(n=>document.querySelector(`[data-card="${n}"]`).classList.contains('is-selected'),target)),`page ${d3.page+1}, selected ${d3.selected}`);
    const first=d.cardNums[0];
    await p.evaluate(()=>window.scrollTo(0,0));await p.click('#pagePrev');await p.waitForTimeout(200);
    await p.click(`[data-card="${first}"] .card__nametext`);await p.waitForTimeout(300);
    ok(T+'card selects its pin',await p.evaluate(n=>!!document.querySelector(`.leaflet-marker-pane [data-pin="${n}"].is-selected`)&&state.selected===n,first));

    // ---- Filter and category changes reset paging safely ----
    await p.click('#pageNext');await p.waitForTimeout(150);
    await p.evaluate(()=>{state.filter='Spooky';renderFilters();renderCards()});
    let d4=await p.evaluate(probe);const spooky=countOf(d4.countText);
    ok(T+'filter change resets to page 1',d4.page===0&&d4.cardNums.length===Math.min(8,spooky)&&d4.pins.length===spooky,`${spooky} spooky`);
    await p.evaluate(()=>{state.filter='All';renderFilters();renderCards()});await p.click('#pageNext');await p.waitForTimeout(150);
    await p.click('#treatStopsTab');await p.waitForTimeout(300);
    let t=await p.evaluate(probe);const treats=countOf(t.countText);
    ok(T+'Treat Stops: page reset, counts agree, pager hidden for one page',t.category==='treats'&&t.page===0&&t.cardNums.length===treats&&t.pins.length===treats&&t.tabCount===treats&&(treats>8||!t.pager),`${treats} treat stop(s)`);
    ok(T+'Treat Stops: responsive map, no nested scroll, no overflow',t.mapFrame&&t.scrollers.length===0&&!t.overflowX);
    await p.click('#displaysTab');await p.waitForTimeout(300);
    ok(T+'back to Displays starts on page 1',(await p.evaluate(probe)).page===0);

    // ---- Events ----
    await go('?category=events');
    const e=await p.evaluate(probe);
    const evCards=await p.evaluate(()=>document.querySelectorAll('#cardList .event-card,#eventsMobileList .event-card,#cardList article').length);
    ok(T+'Events: calendar shown, no map, no pager',!!e.calendar&&!e.mapFrame&&!e.pager);
    ok(T+'Events: no nested scroll, no overflow',e.scrollers.length===0&&!e.overflowX,e.scrollers.join(', '));
    ok(T+'Events: tab count matches events',e.tabCount===(await p.evaluate(()=>matchingEvents().length)));

    // ---- Deep link from /listing.html ----
    await go('?house=12&view=map');await p.waitForTimeout(800);
    const dl=await p.evaluate(()=>{const pin=document.querySelector('.leaflet-marker-pane [data-pin="12"]');const b=pin.getBoundingClientRect(),m=document.getElementById('map').getBoundingClientRect(),fb=document.querySelector('.filterbar').getBoundingClientRect(),mf=document.querySelector('.map-frame').getBoundingClientRect();const cx=b.left+b.width/2,cy=b.top+b.height/2,top=document.elementFromPoint(cx,b.bottom-4);const sticky=getComputedStyle(document.querySelector('.filterbar')).position==='sticky';return {zoom:map.getZoom(),selected:state.selected,pinSelected:pin.classList.contains('is-selected'),onTop:!!top&&!!top.closest('[data-pin="12"]'),dx:Math.round(cx-(m.left+m.width/2)),tipDy:Math.round(b.bottom-(m.top+m.height/2)),peek:!document.getElementById('mapPeek').classList.contains('is-hidden'),mapTop:Math.round(mf.top),mapBottom:Math.round(mf.bottom),under:sticky?Math.round(fb.bottom):0}});
    ok(T+'deep link: pin 12 selected, centered, visible, popup open',dl.zoom===15&&dl.selected===12&&dl.pinSelected&&dl.onTop&&Math.abs(dl.dx)<=3&&Math.abs(dl.tipDy)<=3&&dl.peek,JSON.stringify(dl));
    ok(T+'deep link: map stays in its responsive position',desktop?dl.mapTop>=dl.under-2&&dl.mapTop<vp.height:dl.mapTop>=dl.under-2&&dl.mapBottom<=vp.height+2,JSON.stringify({mapTop:dl.mapTop,mapBottom:dl.mapBottom,filtersEnd:dl.under}));
    await go('?house=8&entity=drakestown-road-2026');
    const d8=await p.evaluate(()=>({sel:state.selected,shown:!!document.querySelector('[data-card="8"].is-selected')}));
    ok(T+'?house= link to a page-2 listing opens the page with its card selected',d8.sel===8&&d8.shown,JSON.stringify(d8));
    ok(T+'no page errors',errors.length===0,errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails?`\n${fails} check(s) FAILED`:'\nAll layout checks passed.');
  process.exit(fails?1:0);
})();
