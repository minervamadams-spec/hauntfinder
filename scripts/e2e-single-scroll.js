// Browser checks for the three-rail directory homepage at 1280px and 390px.
//   node scripts/e2e-single-scroll.js [base-url]      (default http://localhost:8765)
// Layout contract (decision A): at >=1024px the filter rail and the results rail
// (.list-column) are the only nested scroll areas; at 390px the page is the only
// scroll surface. Needs the `playwright` package and a Chromium build (set
// HF_CHROMIUM to an executable path if Playwright's bundled browser is absent).
// Read-only against any host: /api/visits is blocked, every non-GET /api call is
// aborted, and nothing is posted, so production runs create no QA data.
const BASE=(process.argv[2]||'http://localhost:8765').replace(/\/$/,'');
let chromium;try{({chromium}=require('playwright'))}catch{console.error('Install playwright to run these checks: npm i -D playwright');process.exit(2)}
let fails=0,lastStep='';const ok=(name,pass,detail='')=>{lastStep=name;console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`);if(!pass)fails++};

const probe=()=>{
  const r=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,width:b.width,height:b.height}};
  const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
  const scrollers=[...document.querySelectorAll('body *')].filter(e=>{const cs=getComputedStyle(e);return /(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1&&e.clientHeight>0}).map(e=>(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ')[0]);
  const cards=[...document.querySelectorAll('#cardList [data-card]')];
  const pins=[...markerByNum].filter(([n,m])=>listingCluster.hasLayer(m)).map(([n])=>n);
  const mf=document.querySelector('.map-frame'),cl=document.getElementById('countLine');
  const sel=({displays:'#displayTabCount',treats:'#treatStopCount',events:'#eventCount'})[state.category];
  return {filterRail:r(document.getElementById('filterRail')),listRail:r(document.querySelector('.list-column')),mapFrame:visible(mf)?r(mf):null,countLine:r(cl),countText:cl.textContent,
    firstCard:r(cards[0]),lastCard:r(cards[cards.length-1]),cardNums:cards.map(c=>+c.dataset.card),cardCols:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().left))).size,
    pins,scrollers,overflowX:document.documentElement.scrollWidth>innerWidth,category:state.category,filter:state.filter,selected:state.selected,
    tabCount:+(document.querySelector(sel).textContent.replace(/\D/g,'')||0),hasPager:!!document.getElementById('pagePrev')||!!document.getElementById('pageNext')||!!document.getElementById('resultsPager'),hasDialog:!!document.querySelector('dialog'),
    calendar:visible(document.getElementById('eventCalendar'))};
};
const countOf=t=>+(String(t).match(/^(\d+)/)||[0,0])[1];
const sorted=a=>JSON.stringify([...a].sort((x,y)=>x-y));
(async()=>{
  const browser=await chromium.launch(process.env.HF_CHROMIUM?{executablePath:process.env.HF_CHROMIUM}:{});
  const viewports=[{name:'1280',width:1280,height:800},{name:'390',width:390,height:844},{name:'820',width:820,height:1000}];
  for(const vp of viewports.filter(v=>!process.env.HF_VIEWPORT||v.name===process.env.HF_VIEWPORT)){
    const desktop=vp.width>=1024,T=vp.name+'px: ';
    const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height},...(vp.width<1024?{hasTouch:true,isMobile:vp.width<768}:{})});
    await ctx.route('**/api/visits**',r=>r.abort());
    await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
    const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(process.env.HF_DEBUG?'after "'+lastStep+'": '+String(e.stack).split('\n').slice(0,9).join(' | '):e.message));
    // The filter panel starts collapsed, so desktop flows expand it first unless they test the default.
    const go=async(q,o)=>{await p.goto(BASE+'/'+q,{waitUntil:'networkidle'});await p.waitForTimeout(700);if(!(o&&o.keepRail)&&await p.evaluate(()=>innerWidth>=1024&&document.documentElement.dataset.rail==='collapsed')){await p.click('#railToggle');await p.waitForTimeout(300)}};
    const inView=n=>p.evaluate(({n,desktop})=>{const c=document.querySelector(`#cardList [data-card="${n}"]`);if(!c)return false;const b=c.getBoundingClientRect(),area=desktop?document.querySelector('.list-column').getBoundingClientRect():{top:0,bottom:innerHeight};return b.top>=area.top-1&&b.bottom<=area.bottom+1},{n,desktop});

    if(!desktop){
      // ================= Mobile and tablet (below 1024px): design/Hauntfinder Mobile Spec =================
      const tablet=vp.width>=768;
      const mp=()=>p.evaluate(()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,w:b.width,h:b.height}};const cards=[...document.querySelectorAll('#cardList [data-card]')];return {header:r(document.querySelector('.hf-header')),filterbar:r(document.querySelector('.filterbar')),tabs:r(document.querySelector('.filterbar .tabs')),bar:r(document.getElementById('mobileBar')),sticky:getComputedStyle(document.querySelector('.filterbar')).position,mview:document.documentElement.dataset.mview,overflowX:document.documentElement.scrollWidth>innerWidth,pageScrolls:document.documentElement.scrollHeight>innerHeight+1,scrollers:[...document.querySelectorAll('body *')].filter(e=>{const cs=getComputedStyle(e);return /(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1&&e.clientHeight>0&&!e.closest('.leaflet-container,.route-panel,.filter-rail')}).map(e=>(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ')[0]),cards:cards.map(c=>+c.dataset.card),cols:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().left))).size,count:document.getElementById('countLine').textContent,pins:[...markerByNum].filter(([n,m])=>listingCluster.hasLayer(m)).map(([n])=>n),tabCount:+document.getElementById('displayTabCount').textContent.replace(/\D/g,''),intro:getComputedStyle(document.querySelector('.intro-strip__copy')).display,menuBtn:r(document.getElementById('menuBtn'))}});
      await go('?category=displays');
      let m=await mp();const total=countOf(m.count);
      ok(T+'header is 56px; the search row and tabs stick; the bottom bar is fixed',Math.round(m.header.h)===56&&m.sticky==='sticky'&&m.bar&&Math.abs(m.bar.bottom-vp.height)<=1&&m.intro==='none',JSON.stringify({h:m.header.h,sticky:m.sticky}));
      ok(T+'page is the only scroll surface and there is no horizontal overflow',m.scrollers.length===0&&!m.overflowX&&m.pageScrolls,m.scrollers.join(', ')||'none');
      ok(T+(tablet?'cards sit in 2 columns':'cards sit in 1 column'),m.cols===(tablet?2:1),String(m.cols));
      ok(T+'every matching card renders; every pin is on the map; counts agree',total>0&&m.cards.length===total&&m.pins.length===total&&m.tabCount===total,`${m.cards.length} cards, ${m.pins.length} pins, ${total}`);
      const targets=await p.evaluate(()=>[...document.querySelectorAll('.mobile-bar button,.filterbar .tabs button,#filtersBtn,#menuBtn,#cardList .card__route-btn,#cardList .card__mapbtn,#cardList .card__morebtn,#cardList .card__fav-btn')].filter(e=>e.getClientRects().length).map(e=>Math.round(e.getBoundingClientRect().height)).filter(h=>h<44));
      ok(T+'every button is at least 44px tall',targets.length===0,targets.join(','));
      // map view: one view at a time, pin preview, FULL DETAILS back to the list
      await p.click('#viewToggle');await p.waitForTimeout(900);
      const mv=await p.evaluate(()=>{const mc=document.querySelector('.map-column').getBoundingClientRect(),bar=document.getElementById('mobileBar').getBoundingClientRect();return {mview:document.documentElement.dataset.mview,listHidden:getComputedStyle(document.querySelector('.list-column')).display==='none',headerHidden:getComputedStyle(document.querySelector('.hf-header')).display==='none',mapBottom:Math.round(mc.bottom),barTop:Math.round(bar.top),mapH:Math.round(mc.height),label:document.getElementById('viewToggleText').textContent}});
      ok(T+'map view fills the screen between the tabs and the bottom bar; the list and header are hidden',mv.mview==='map'&&mv.listHidden&&mv.headerHidden&&Math.abs(mv.mapBottom-mv.barTop)<=2&&mv.mapH>300&&mv.label==='List view',JSON.stringify(mv));
      const pinN=m.cards[2];
      await p.evaluate(n=>markerByNum.get(n).fire('click'),pinN);await p.waitForTimeout(700);
      const pk=await p.evaluate(n=>{const e=document.getElementById('mapPeek'),b=e.getBoundingClientRect(),bar=document.getElementById('mobileBar').getBoundingClientRect();return {shown:!e.classList.contains('is-hidden'),aboveBar:b.bottom<=bar.top+1,name:!!e.querySelector('.map-popup__name'),add:!!e.querySelector('[data-peek-route]'),full:!!e.querySelector('[data-peek-full]'),sel:state.selected===n}},pinN);
      ok(T+'tapping a pin opens a preview card above the bottom bar with Add to route and Full details',pk.shown&&pk.aboveBar&&pk.name&&pk.add&&pk.full&&pk.sel,JSON.stringify(pk));
      await p.click('[data-peek-full]');await p.waitForTimeout(700);
      const fd=await p.evaluate(n=>{const c=document.querySelector(`#cardList [data-card="${n}"]`),b=c.getBoundingClientRect();return {mview:document.documentElement.dataset.mview,inView:b.top>=0&&b.bottom<=innerHeight,sel:c.classList.contains('is-selected')}},pinN);
      ok(T+'Full details switches to the list scrolled to that card, highlighted',fd.mview==='list'&&fd.inView&&fd.sel,JSON.stringify(fd));
      // card ◉ MAP opens the map with that pin selected; ⋯ reveals Host notes, Rate, Report, Share
      await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(200);
      const first=m.cards[0];
      await p.click(`#cardList [data-card="${first}"] .card__morebtn`);
      const more=await p.evaluate(n=>{const c=document.querySelector(`#cardList [data-card="${n}"]`);return {open:c.classList.contains('is-more-open'),links:[...c.querySelectorAll('.card__metalink,.card-rating,.card__notes summary')].filter(e=>e.getClientRects().length).length}},first);
      ok(T+'the ⋯ button reveals Rate, Report and Share (and Host notes when the listing has notes)',more.open&&more.links>=3,JSON.stringify(more));
      await p.click(`#cardList [data-card="${first}"] .card__mapbtn`);await p.waitForTimeout(900);
      const cm=await p.evaluate(n=>({mview:document.documentElement.dataset.mview,sel:state.selected===n,pin:!!document.querySelector(`.leaflet-marker-pane [data-pin="${n}"].is-selected`)||!!markerByNum.get(n).getElement()}),first);
      ok(T+'◉ Map opens the map view with that pin selected',cm.mview==='map'&&cm.sel,JSON.stringify(cm));
      await p.click('#viewToggle');await p.waitForTimeout(400);
      // filter sheet
      await p.click('#filtersBtn');await p.waitForTimeout(300);
      const fs0=await p.evaluate(()=>{const r=document.getElementById('filterRail').getBoundingClientRect();return {full:Math.round(r.width)===innerWidth&&Math.round(r.height)===innerHeight,groups:[...document.querySelectorAll('#filterRail .filter-rail__section h3')].map(h=>h.textContent),title:document.getElementById('sheetTitle').textContent,show:document.getElementById('sheetShow').textContent,btn:Math.round(document.getElementById('sheetShow').getBoundingClientRect().height)}});
      ok(T+'Filters opens a full-screen sheet with the desktop groups and a Show N footer',fs0.full&&fs0.groups.join('|')==='When|How to visit|Scare level|Features'&&/^Show \d+ displays$/.test(fs0.show)&&fs0.btn>=44,JSON.stringify(fs0));
      await p.click('#filterRail [data-rail-filter="show"][data-value="Drive-by"]');await p.waitForTimeout(300);
      const fs1=await p.evaluate(()=>({show:document.getElementById('sheetShow').textContent,btn:document.getElementById('filtersBtn').classList.contains('is-active'),count:document.getElementById('filtersBtnCount').textContent}));
      await p.click('#sheetShow');await p.waitForTimeout(300);
      const after=await mp();const nf=countOf(after.count);
      ok(T+'filters apply live: the sheet button, count line, cards, pins and tab count agree; the Filters button shows the active count',nf<total&&after.cards.length===nf&&after.pins.length===nf&&after.tabCount===nf&&fs1.show==='Show '+nf+' displays'&&fs1.btn&&fs1.count==='1',JSON.stringify({fs1,nf,total}));
      // route sheet
      await p.click('#cardList [data-route]');await p.waitForTimeout(200);
      await p.click('#routeBarBtn');await p.waitForTimeout(300);
      const rs=await p.evaluate(()=>{const pnl=document.getElementById('routePanel').getBoundingClientRect();return {open:document.documentElement.dataset.sheet==='route',stops:document.querySelectorAll('#routeStopsMini .route-stop').length,count:document.getElementById('routePanelCount').textContent,go:/^https:\/\/www\.google\.com\/maps\/dir\//.test(document.getElementById('routeDirections').href),bottom:Math.round(pnl.bottom)===innerHeight,badge:document.getElementById('routeBarCount').textContent}});
      ok(T+'Your route opens a bottom sheet with the stops, "N of 10 stops" and Get directions',rs.open&&rs.stops===1&&rs.count==='1 of 10 stops'&&rs.go&&rs.bottom&&rs.badge==='1',JSON.stringify(rs));
      // Route-sheet drag close: real mouse/pointer input on the header only. The stop list is deliberately not dragged.
      const drag=async fraction=>{const b=await p.locator('.route-panel__head').boundingBox(),panel=await p.locator('#routePanel').boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x,y+panel.height*fraction,{steps:5});await p.mouse.up();await p.waitForTimeout(260)};
      await drag(.1);
      const shortDrag=await p.evaluate(()=>({open:document.documentElement.dataset.sheet==='route',expanded:document.getElementById('routeBarBtn').getAttribute('aria-expanded'),offset:document.getElementById('routePanel').style.transform}));
      ok(T+'a short header drag springs the route sheet back open',shortDrag.open&&shortDrag.expanded==='true'&&shortDrag.offset==='',JSON.stringify(shortDrag));
      await drag(.3);
      const longDrag=await p.evaluate(()=>({open:document.documentElement.dataset.sheet==='route',expanded:document.getElementById('routeBarBtn').getAttribute('aria-expanded'),badge:document.getElementById('routeBarCount').textContent}));
      ok(T+'a header drag past 25% closes the route sheet and returns control to the route bar',!longDrag.open&&longDrag.expanded==='false'&&longDrag.badge==='1',JSON.stringify(longDrag));
      await p.click('#routeBarBtn');await p.waitForTimeout(150);await p.click('#routeClose');await p.waitForTimeout(150);
      const xClose=await p.evaluate(()=>!document.documentElement.dataset.sheet&&document.getElementById('routeBarBtn').getAttribute('aria-expanded')==='false');
      await p.click('#routeBarBtn');await p.waitForTimeout(150);await p.mouse.click(8,80);await p.waitForTimeout(150);
      const backdropClose=await p.evaluate(()=>!document.documentElement.dataset.sheet&&document.getElementById('routeBarBtn').getAttribute('aria-expanded')==='false');
      ok(T+'the route sheet × and backdrop tap still close it',xClose&&backdropClose,JSON.stringify({xClose,backdropClose}));
      await p.click('#routeBarBtn');await p.waitForTimeout(150);
      await p.click('[data-route-mini-remove="0"]');await p.waitForTimeout(200);await p.click('#routeClose');await p.waitForTimeout(200);
      ok(T+'the route sheet closes and the bar badge returns to 0',(await p.evaluate(()=>!document.documentElement.dataset.sheet&&document.getElementById('routeBarCount').textContent==='0'&&document.getElementById('routeBarCount').classList.contains('is-zero'))));
      await p.evaluate(()=>localStorage.clear());
      // menu drawer
      await p.click('#menuBtn');await p.waitForTimeout(250);
      const md=await p.evaluate(()=>({open:!document.getElementById('menuDrawer').hidden,links:[...document.querySelectorAll('#menuDrawer .menu-drawer__panel a,#menuDrawer .menu-drawer__panel>button:not(.sheet-close)')].map(a=>a.textContent.trim()),tag:document.querySelector('.menu-drawer__tag').textContent.length>40}));
      ok(T+'the menu drawer holds the site links and the tagline',md.open&&md.links.join('|')==='+ Submit a listing|Share this site|About|Get alerts|Contact us'&&md.tag,md.links.join('|'));
      await p.click('#menuDrawer .sheet-close');
      // Treat Stops and Events
      await p.click('#treatStopsTab');await p.waitForTimeout(400);
      const tr=await mp();const tn=countOf(tr.count);
      ok(T+'Treat Stops: cards, pins and counts agree',tr.cards.length===tn&&tr.pins.length===tn,`${tn}`);
      await go('?category=events');
      const ev=await p.evaluate(()=>({days:document.querySelectorAll('#cardList .ev-day').length,open:!!document.querySelector('#cardList .ev-open'),overflow:document.documentElement.scrollWidth>innerWidth,cal:getComputedStyle(document.getElementById('eventCalendar')).display}));
      ok(T+'Events: the day-by-day list (merged empty days, Open all week) with no overflow',ev.days>=3&&ev.open&&!ev.overflow&&ev.cal==='none',JSON.stringify(ev));
      await p.click('#viewToggle');await p.waitForTimeout(900);
      const evm=await p.evaluate(()=>({pins:document.querySelectorAll('.leaflet-marker-pane [data-event-pin]').length,withCoords:matchingEvents().filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)).length}));
      ok(T+'Events map view shows the type-coloured square pins',evm.pins===evm.withCoords&&evm.pins>0,JSON.stringify(evm));
      // deep links
      await go('?house=8&entity=drakestown-road-2026');
      ok(T+'?house=8&entity= selects its card',await p.evaluate(()=>state.selected===8&&!!document.querySelector('#cardList [data-card="8"].is-selected')));
      await go('?house=12&view=map',{keepRail:true});await p.waitForTimeout(600);
      const dm=await p.evaluate(()=>({mview:document.documentElement.dataset.mview,sel:state.selected===12,zoom:map.getZoom(),peek:!document.getElementById('mapPeek').classList.contains('is-hidden')}));
      ok(T+'?house=12&view=map opens the map view with pin 12 selected at zoom 15',dm.mview==='map'&&dm.sel&&dm.zoom===15&&dm.peek,JSON.stringify(dm));
      ok(T+'no horizontal overflow after deep links',!(await mp()).overflowX);
      ok(T+'no page errors',errors.length===0,errors.join(' | '));
      await ctx.close();continue;
    }

    // ---- Layout and scroll surfaces ----
    await go('?category=displays');
    let d=await p.evaluate(probe);
    const total=countOf(d.countText);
    ok(T+'layout order',desktop?d.filterRail.left<d.listRail.left&&d.listRail.left<d.mapFrame.left:d.mapFrame.bottom<=d.countLine.top&&d.countLine.bottom<=d.firstCard.top,JSON.stringify({rail:Math.round(d.listRail.left),map:Math.round(d.mapFrame.left)}));
    ok(T+(desktop?'nested scroll only in filter rail and results rail':'page is the only scroll surface'),desktop?d.scrollers.every(s=>s.includes('filter-rail')||s.includes('list-column')||s.includes('#filters')):d.scrollers.length===0,d.scrollers.join(', ')||'none');
    if(desktop){
      const rail=await p.evaluate(()=>{const e=document.querySelector('.list-column');return {scrolls:e.scrollHeight>e.clientHeight+1,docScrolls:document.documentElement.scrollHeight>innerHeight+1}});
      ok(T+'results rail scrolls, page does not',rail.scrolls&&!rail.docScrolls,JSON.stringify(rail));
    }else{
      ok(T+'page scrolls vertically',await p.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1));
    }
    ok(T+'no horizontal overflow',!d.overflowX);
    ok(T+'no pager element and no dialog',!d.hasPager&&!d.hasDialog);
    ok(T+'card column stays single',d.cardCols===1,`${d.cardCols}`);

    // ---- All cards render, all pins stay ----
    ok(T+'every matching card renders',total>0&&d.cardNums.length===total,`${d.cardNums.length} cards of ${total}`);
    ok(T+'every matching pin stays on the map',d.pins.length===total&&sorted(d.pins)===sorted(d.cardNums),`${d.pins.length} pins`);
    ok(T+'tab count == count line',d.tabCount===total,`tab ${d.tabCount}, count ${total}`);

    // ---- Pin click brings its card into view; card click selects its pin ----
    const last=d.cardNums[d.cardNums.length-1];
    await p.evaluate(()=>{document.querySelector('.list-column').scrollTop=0;scrollTo(0,0)});
    await p.evaluate(n=>markerByNum.get(n).fire('click'),last);await p.waitForTimeout(900);
    ok(T+'pin click selects and shows its card',await p.evaluate(n=>!!document.querySelector(`#cardList [data-card="${n}"].is-selected`)&&state.selected===n,last)&&await inView(last),`pin ${last}`);
    const first=d.cardNums[0];
    await p.evaluate(()=>{document.querySelector('.list-column').scrollTop=0});await p.waitForTimeout(100);
    await p.evaluate(n=>document.querySelector(`#cardList [data-card="${n}"]`).scrollIntoView({block:'center'}),first);
    await p.click(`#cardList [data-card="${first}"] .card__nametext`);await p.waitForTimeout(400);
    ok(T+'card click selects its pin',await p.evaluate(n=>!!document.querySelector(`.leaflet-marker-pane [data-pin="${n}"].is-selected`)&&state.selected===n,first),`card ${first}`);

    // ---- Filters and tabs update cards, pins and counts together ----
    if(desktop)await p.click('#filterRail button.filter--rail[data-value="Spooky"]');
    else await p.evaluate(()=>{state.filter='Spooky';renderFilters();renderCards()});
    await p.waitForTimeout(400);
    let f=await p.evaluate(probe);const spooky=countOf(f.countText);
    ok(T+'filter updates cards, pins and counts together',f.filter==='Spooky'&&f.cardNums.length===spooky&&f.pins.length===spooky&&f.tabCount===spooky&&spooky<total,`${spooky} of ${total}`);
    await p.evaluate(()=>{state.filter='All';renderFilters();renderCards()});await p.waitForTimeout(200);
    await p.click('#treatStopsTab');await p.waitForTimeout(400);
    let t=await p.evaluate(probe);const treats=countOf(t.countText);
    ok(T+'Treat Stops tab updates cards, pins and counts together',t.category==='treats'&&t.cardNums.length===treats&&t.pins.length===treats&&t.tabCount===treats,`${treats} treat stop(s)`);
    ok(T+'Treat Stops: no overflow, scroll surfaces unchanged',!t.overflowX&&(desktop?t.scrollers.every(s=>s.includes('filter-rail')||s.includes('list-column')||s.includes('#filters')):t.scrollers.length===0),t.scrollers.join(', ')||'none');
    await p.click('#displaysTab');await p.waitForTimeout(400);
    const back=await p.evaluate(probe);
    ok(T+'back to Displays restores cards, pins and counts',back.category==='displays'&&back.cardNums.length===total&&back.pins.length===total&&back.tabCount===total);

    // ---- Events ----
    await go('?category=events');
    const e=await p.evaluate(probe);
    ok(T+'Events: no overflow',!e.overflowX);
    ok(T+'Events: tab count matches events',e.tabCount===(await p.evaluate(()=>matchingEvents().length)));
    if(desktop){
      const ev=await p.evaluate(()=>{const days=[...document.querySelectorAll('#cardList .ev-day')];return {weekGrid:!!document.getElementById('eventCalendar')&&document.getElementById('eventCalendar').getClientRects().length>0,days:days.length,open:!!document.querySelector('#cardList .ev-open'),key:!!document.querySelector('#cardList .ev-key'),pins:[...document.querySelectorAll('.leaflet-marker-pane [data-event-pin]')].length,withCoords:matchingEvents().filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)).length,circle:document.querySelectorAll('.leaflet-overlay-pane path').length,count:document.getElementById('eventsDayHeading').textContent}});
      ok(T+'Events: merged empty days, Open all week box and key replace the week grid',!ev.weekGrid&&ev.days>=3&&ev.open&&ev.key,JSON.stringify(ev));
      ok(T+'Events: map shows one pin per mappable event, no radius circle',!!e.mapFrame&&ev.pins===ev.withCoords&&ev.pins>0&&ev.circle===0,JSON.stringify({pins:ev.pins,coords:ev.withCoords,circle:ev.circle}));
      ok(T+'Events: count line matches',countOf(ev.count)===e.tabCount,ev.count);
      ok(T+'Events: nested scroll only in filter rail and results rail',e.scrollers.every(x=>x.includes('filter-rail')||x.includes('list-column')||x.includes('#filters')),e.scrollers.join(', ')||'none');
      await p.click('#filterRail button.filter--rail[data-rail-filter="event-type"][data-value="Other"]');await p.waitForTimeout(400);
      const ft=await p.evaluate(()=>({pins:document.querySelectorAll('.leaflet-marker-pane [data-event-pin]').length,tab:+document.getElementById('eventCount').textContent.replace(/\D/g,''),cards:document.querySelectorAll('#cardList .event-card').length,count:document.getElementById('eventsDayHeading').textContent}));
      ok(T+'Events: Type chip updates cards, pins and counts together',ft.pins===ft.cards&&ft.tab===ft.cards&&countOf(ft.count)===ft.cards&&ft.cards<e.tabCount,JSON.stringify(ft));
      await p.click('#filterRail button.filter--rail[data-rail-filter="event-type"][data-value="Other"]');await p.waitForTimeout(300);
      const lastPin=await p.evaluate(()=>{const pins=[...document.querySelectorAll('.leaflet-marker-pane [data-event-pin]')];return pins.length});
      await p.click(`.leaflet-marker-pane [data-event-pin="${lastPin}"]`);await p.waitForTimeout(700);
      ok(T+'Events: pin click selects its card and brings it into view',await p.evaluate(()=>{const c=document.querySelector('#cardList .event-card.is-selected');if(!c)return false;const b=c.getBoundingClientRect(),a=document.querySelector('.list-column').getBoundingClientRect();return b.top>=a.top-1&&b.bottom<=a.bottom+1}));
    }else{
      ok(T+'Events (mobile): calendar day list shown, no map, no nested scroll',!!e.calendar&&!e.mapFrame&&e.scrollers.length===0,e.scrollers.join(', ')||'none');
    }

    // ---- Design review (2026-10-15) ----
    if(desktop){
      for(const [tab,accent,sel] of [['displays','rgb(255, 122, 26)','#displaysTab'],['treats','rgb(166, 226, 46)','#treatStopsTab'],['events','rgb(180, 140, 255)','#eventsTab']]){
        await go('?category='+tab);
        const r=await p.evaluate(sel=>{const t=document.querySelector(sel),cs=getComputedStyle(t),rail=document.getElementById('filterRail').getBoundingClientRect(),badge=t.querySelector('.tabs__badge');return {bg:cs.backgroundColor,bb:cs.borderBottomColor,bw:cs.borderBottomWidth,color:cs.color,railBottom:Math.round(rail.bottom),inner:innerHeight,badge:badge.textContent,doc:document.documentElement.scrollHeight}},sel);
        ok(T+tab+': filter panel reaches the bottom of the window',r.railBottom>=r.inner-1&&r.doc<=r.inner,JSON.stringify({railBottom:r.railBottom,inner:r.inner}));
        ok(T+tab+': active tab has no fill and a 3px accent underline',r.bg==='rgba(0, 0, 0, 0)'&&r.bb===accent&&r.bw==='3px'&&r.color==='rgb(246, 235, 211)',JSON.stringify({bg:r.bg,bb:r.bb,color:r.color}));
        ok(T+tab+': tab badge is a bare number',/^\d+$/.test(r.badge),r.badge);
      }
      await go('?category=displays');
      const dv=await p.evaluate(()=>({nums:document.querySelectorAll('.pin__num').length,pinText:[...document.querySelectorAll('.leaflet-marker-pane .pin')].every(p=>p.textContent.trim()===''),clusters:document.querySelectorAll('.hf-cluster').length,h:Math.round(document.querySelector('#cardList [data-card]').getBoundingClientRect().height)}));
      ok(T+'pins and card badges are icons only (no listing numbers shown)',dv.nums===0&&dv.pinText,JSON.stringify({nums:dv.nums}));
      ok(T+'overlapping pins cluster',dv.clusters>=1,`${dv.clusters} cluster(s)`);
      ok(T+'display card with tags is <=190px tall',dv.h<=190,`${dv.h}px`);
      const sb=await p.evaluate(()=>{const x=id=>document.getElementById(id).getBoundingClientRect().left;return {zip:x('zipInput'),within:document.querySelector('.within-dd').getBoundingClientRect().left,go:x('zipSearchBtn'),locate:x('locateBtn'),goText:document.getElementById('zipSearchBtn').textContent,within_text:document.getElementById('locbarWithin').textContent.trim(),bar:Math.round(document.querySelector('.nav-search').getBoundingClientRect().height)}});
      ok(T+'search bar order: ZIP, radius, GO, My location',sb.zip<sb.within&&sb.within<sb.go&&sb.go<sb.locate&&sb.goText==='GO'&&!/within/i.test(sb.within_text)&&sb.bar===48,JSON.stringify(sb));
      const chips=await p.evaluate(()=>[...document.querySelectorAll('#filterRail .filter-rail__section')].map(s=>s.querySelector('h3').textContent+': '+[...s.querySelectorAll('button')].map(b=>b.textContent.trim()).join('|')));
      ok(T+'How to visit shows all four options; Any night is on by default',chips.some(c=>c==='How to visit: Drive-by|Walk-up|Walk-through|Drive or walk by (both)')&&(await p.evaluate(()=>document.querySelector('#filterRail [data-rail-filter="when"][aria-pressed="true"]').textContent.trim()==='Any night')),chips.join(' / '));
      await go('?category=treats');
      const tw=await p.evaluate(()=>[...document.querySelectorAll('#filterRail [data-rail-filter="when"],#filterRail [data-rail-filter="when-date"]')].map(b=>b.textContent).join('|'));
      ok(T+'Treat Stops When: Any night, Tonight, Halloween',tw==='Any night|Tonight|Halloween',tw);
      const tc=await p.evaluate(()=>({top:getComputedStyle(document.querySelector('#cardList .treat-stop-card')).borderTopColor,prompt:!!document.querySelector('#cardList .treat-prompt__link[target="_blank"]'),notes:!!document.querySelector('#cardList .treat-stop-card .card__notes'),date:document.querySelector('#cardList .treat-stop-card .card__hours').textContent}));
      ok(T+'treat card: lime top border, no host notes, dated like events; add-your-home prompt below',tc.top==='rgb(166, 226, 46)'&&!tc.notes&&tc.prompt&&/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+/.test(tc.date),JSON.stringify(tc));
      await go('?category=events');
      const ec=await p.evaluate(()=>{const c=document.querySelector('#cardList .event-card');const types=[...document.querySelectorAll('#filterRail [data-rail-filter="event-type"]')].map(b=>b.textContent);return {name:getComputedStyle(c.querySelector('.event-card__name')).textTransform,venueRepeats:/Costume Closet ·/.test(c.querySelector('.card__address').textContent),clamp:getComputedStyle(c.querySelector('.event-card__clamp')).webkitLineClamp,tags:[...c.querySelectorAll('.chips .chip')].map(x=>x.textContent),noAll:!types.includes('All types'),stray:/\}\s*$/.test(c.querySelector('.event-card__details').textContent.trim()),h:[...document.querySelectorAll('#cardList .event-card')].map(e=>Math.round(e.getBoundingClientRect().height))}});
      ok(T+'event card: title case, address only, 3-line clamp, event-form tags only',ec.name==='none'&&!ec.venueRepeats&&ec.clamp==='3'&&!ec.tags.includes('Costumes Available')&&ec.noAll&&!ec.stray,JSON.stringify(ec));
      ok(T+'event cards stay compact (<=260px with a 3-line description)',ec.h.every(h=>h<=260||h===ec.h[0]&&h<=310),ec.h.join(','));
      // collapse toggle
      await go('?category=displays',{keepRail:true});
      const def=await p.evaluate(()=>({rail:document.documentElement.dataset.rail,w:Math.round(document.getElementById('filterRail').getBoundingClientRect().width)}));
      ok(T+'the filter panel is collapsed by default (44px)',def.rail==='collapsed'&&def.w===44,JSON.stringify(def));
      const col=await p.evaluate(()=>({w:Math.round(document.getElementById('filterRail').getBoundingClientRect().width),mapW:Math.round(document.getElementById('map').getBoundingClientRect().width),leaflet:map.getSize().x,label:document.querySelector('.filter-rail__expand-label').getBoundingClientRect().height>document.querySelector('.filter-rail__expand-label').getBoundingClientRect().width}));
      ok(T+'filter panel collapses to 44px, shows a vertical label, and the map resizes',col.w===44&&col.label&&Math.abs(col.mapW-col.leaflet)<=1,JSON.stringify(col));
      await p.click('#railToggle');await p.waitForTimeout(300);
      ok(T+'filter panel expands to 260px',(await p.evaluate(()=>Math.round(document.getElementById('filterRail').getBoundingClientRect().width)))===260);
      // route bar
      await p.click('#cardList [data-route]');await p.waitForTimeout(200);
      await p.click('#routeToggle');await p.waitForTimeout(200);
      const rb=await p.evaluate(()=>({open:!document.getElementById('routePanel').hidden,stops:document.querySelectorAll('#routeStopsMini .route-stop').length,href:document.getElementById('routeDirections').href,plan:document.getElementById('routeLink').getAttribute('href'),hint:document.getElementById('routeHint').textContent}));
      ok(T+'route bar expands to numbered stops, Get directions and the planner link',rb.open&&rb.stops===1&&/^https:\/\/www\.google\.com\/maps\/dir\//.test(rb.href)&&rb.plan==='route.html',JSON.stringify(rb));
      await p.click('[data-route-mini-remove="0"]');await p.waitForTimeout(200);
      ok(T+'route bar Remove drops the stop',(await p.evaluate(()=>document.querySelectorAll('#routeStopsMini .route-stop').length))===0);
      await p.evaluate(()=>localStorage.clear());
      // empty result
      await go('?category=displays');
      await p.evaluate(()=>{state.features=['Costumes Available','Actors','Animatronics','Fog','Lights','Music/Sound'];state.filter='Walk-through';renderFilters();renderCards()});await p.waitForTimeout(300);
      const em=await p.evaluate(()=>({text:document.querySelector('#noResults strong').textContent,btn:document.getElementById('showAllBtn').textContent,vis:document.getElementById('showAllBtn').getClientRects().length>0}));
      ok(T+'empty result: "Nothing matches these filters." with Clear all filters',em.text==='Nothing matches these filters.'&&em.btn==='Clear all filters'&&em.vis,JSON.stringify(em));
    }
    // ---- Design review round 2 ----
    if(desktop){
      await p.setViewportSize({width:1290,height:650});
      const seen=[];
      for(const tab of ['displays','treats','events']){
        await go('?category='+tab);
        await p.mouse.click(5,300);
        const t=await p.evaluate(tab=>{const sel={displays:'#displaysTab',treats:'#treatStopsTab',events:'#eventsTab'}[tab],b=document.querySelector(sel).getBoundingClientRect(),row=document.querySelector('.filterbar').getBoundingClientRect(),n=document.querySelector('.filterbar .nav-row').getBoundingClientRect(),e=tab==='events'?document.getElementById('eventsDayHeading'):document.getElementById('countLine'),rg=document.createRange();rg.selectNodeContents(e);const r=rg.getBoundingClientRect();const sub=document.querySelector('.filter-rail__links a').getBoundingClientRect();return {tabBottom:Math.round(b.bottom),rowBottom:Math.round(row.bottom),navH:Math.round(n.height),tabH:Math.round(b.height),count:Math.round(r.top+r.height/2),submitBottom:Math.round(sub.bottom),inner:innerHeight}},tab);
        seen.push(t.count);
        ok(T+tab+': tab underline sits on the tab row line (48px row)',t.tabBottom===t.rowBottom&&t.navH===48&&t.tabH===48,JSON.stringify(t));
        ok(T+tab+': + Submit a listing is visible without scrolling at 1290x650',t.submitBottom<=t.inner,String(t.submitBottom));
      }
      ok(T+'count line sits at the same height on every tab',Math.max(...seen)-Math.min(...seen)<=1,seen.join(','));
      await go('?category=treats');await p.click('#treatStopsTab');
      ok(T+'mouse-clicking a tab shows no focus box',(await p.evaluate(()=>{const cs=getComputedStyle(document.getElementById('treatStopsTab'));return cs.outlineStyle==='none'||cs.outlineWidth==='0px'})));
      await p.keyboard.press('Tab');
      await go('?category=displays');
      const g=await p.evaluate(()=>{const c=document.querySelector('.hf-cluster');const cs=c&&getComputedStyle(c);const z=document.querySelector('.leaflet-control-zoom a').getBoundingClientRect();return {cluster:!!c,size:c&&Math.round(c.getBoundingClientRect().width),bg:cs&&cs.backgroundColor,border:cs&&cs.borderTopColor,title:c&&c.getAttribute('title'),zoom:Math.round(z.width),scare:document.querySelectorAll('#cardList .card__scare').length,notSpec:[...document.querySelectorAll('#cardList .card__scare')].some(e=>/Not specified/.test(e.textContent))}});
      ok(T+'group marker: 36px, dark fill, accent border, tooltip; no pumpkin shape',g.cluster&&g.size===36&&g.bg==='rgb(28, 22, 38)'&&g.border==='rgb(255, 122, 26)'&&/click to zoom/.test(g.title),JSON.stringify(g));
      ok(T+'zoom buttons are 30px',g.zoom===30,String(g.zoom));
      ok(T+'scare dots are hidden when the level is not specified',!g.notSpec);
      // Search this area: hidden until the map moves, top centre of the map, cleared after click
      const sa0=await p.evaluate(()=>getComputedStyle(document.getElementById('searchAreaBtn')).visibility);
      {const mb=await p.evaluate(()=>{const r=document.getElementById('map').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});await p.mouse.move(mb.x,mb.y);await p.mouse.down();await p.mouse.move(mb.x+160,mb.y+90,{steps:8});await p.mouse.up()}await p.waitForTimeout(900);
      const sa=await p.evaluate(()=>{const b=document.getElementById('searchAreaBtn'),m=document.querySelector('.map-frame').getBoundingClientRect(),r=b.getBoundingClientRect();return {vis:getComputedStyle(b).visibility,h:Math.round(r.height),top:Math.round(r.top-m.top),mid:Math.abs((r.left+r.width/2)-(m.left+m.width/2))<4}});
      ok(T+'Search this area: hidden at rest, then a 32px pill at the top centre of the map after panning',sa0==='hidden'&&sa.vis==='visible'&&sa.h===32&&sa.top<=16&&sa.mid,JSON.stringify(sa));
      {await p.click('.tabs >> text=Treat Stops');await p.waitForTimeout(1200);
        const pm=()=>p.evaluate(()=>{const pin=document.querySelector('.leaflet-marker-icon .pin'),mk=pin.closest('.leaflet-marker-icon');return {w:Math.round(pin.getBoundingClientRect().width),z:+mk.style.zIndex,ring:getComputedStyle(pin,'::after').borderTopColor}});
        const rest=await pm();await p.hover('#cardList .card--compact');await p.waitForTimeout(400);const hov=await pm();await p.mouse.move(5,5);await p.waitForTimeout(300);
        ok(T+'round 4: a hovered card grows its pin from 34px to 44px, rings it in cream and raises it by 1000',rest.w===34&&hov.w===44&&hov.z-rest.z===1000&&hov.ring==='rgb(246, 235, 211)',JSON.stringify({rest,hov}));
        await p.click('.tabs >> text=Displays');await p.waitForTimeout(800)}
      for(const tab of ['Treat Stops','Events','Displays']){await p.click('.tabs >> text='+tab);await p.waitForTimeout(2800);const v=await p.evaluate(()=>getComputedStyle(document.getElementById('searchAreaBtn')).visibility);ok(T+'Search this area stays hidden after switching to '+tab+' (the app moved the map, not the visitor)',v==='hidden',v)}
      // One pin: centred at zoom 14
      await go('?category=treats',{keepRail:true});
      const one=await p.evaluate(()=>{const m=[...markerByNum.values()][0],c=map.getCenter(),x=listings.find(v=>v.num===[...markerByNum.keys()].find(n=>isTreatStop(listings.find(l=>l.num===n))));return {zoom:map.getZoom(),d:Math.hypot(c.lat-x.lat,c.lng-x.lng)}});
      ok(T+'one-pin tab centres on the pin at zoom 14',one.zoom===14&&one.d<0.002,JSON.stringify(one));
      // Route bar: compact when empty
      const rbe=await p.evaluate(()=>{const r=document.querySelector('.route-wrap').getBoundingClientRect(),m=document.querySelector('.map-frame').getBoundingClientRect();return {h:Math.round(r.height),hint:getComputedStyle(document.getElementById('routeHint')).display,text:getComputedStyle(document.querySelector('.route-toggle__empty')).display,left:Math.round(r.left-m.left),bottom:Math.round(m.bottom-r.bottom)}});
      ok(T+'empty route bar is a 40px "Add stops from the list" bar with no Expand',rbe.h<=44&&rbe.hint==='none'&&rbe.text!=='none'&&rbe.left===12&&rbe.bottom===12,JSON.stringify(rbe));
      // Panel scrollbars + footer layout
      if(await p.evaluate(()=>document.documentElement.dataset.rail==='collapsed')){await p.click('#railToggle');await p.waitForTimeout(300)}
      const pf=await p.evaluate(()=>{const f=document.querySelector('#filterRail .filters'),l=document.querySelector('.filter-rail__links');return {sb:getComputedStyle(f).scrollbarWidth,foot:getComputedStyle(l).display,cols:getComputedStyle(l).gridTemplateColumns.split(' ').length}});
      ok(T+'filter footer is a fixed 2-column link block; scrollbars are thin',pf.sb==='thin'&&pf.foot==='grid'&&pf.cols===2,JSON.stringify(pf));
      await p.setViewportSize({width:1280,height:800});
    }
    // ---- Design review round 3 ----
    if(desktop){
      await go('?category=displays');await p.waitForTimeout(2500);
      const r3=await p.evaluate(()=>({caret:getComputedStyle(document.querySelector('.filterbar__rail-caret')).display,sa:getComputedStyle(document.getElementById('searchAreaBtn')).visibility,att:!!document.querySelector('.leaflet-control-attribution img, .leaflet-attribution-flag'),visits:/Site visits/i.test(document.body.innerText),alc:[...document.querySelectorAll('#cardList .card__hours')].map(e=>e.textContent).find(t=>/Halloween weekend/.test(t)),scare:(()=>{const e=document.querySelector('#cardList .card__scare');return e?e.textContent.trim():''})(),pipsTitle:!!document.querySelector('#cardList .pips[title]')}));
      ok(T+'round 3: caret shown, Search this area hidden after 2.5s, no Leaflet flag, no Site visits, Alcrest hours without repetition, scare shows one level with a tooltip',r3.caret!=='none'&&r3.sa==='hidden'&&!r3.att&&!r3.visits&&r3.alc==='Halloween weekend'&&!/·/.test(r3.scare)&&r3.pipsTitle,JSON.stringify(r3));
      await p.click('#filterRail [data-rail-filter="show"][data-value="Drive-by"]');await p.waitForTimeout(250);
      const hc=await p.evaluate(()=>({head:document.getElementById('railHeadCount').textContent,shown:!document.getElementById('railHeadCount').hidden}));
      await p.click('#railToggle');await p.waitForTimeout(250);
      const col=await p.evaluate(()=>({caret:getComputedStyle(document.querySelector('.filterbar__rail-caret')).display}));
      await p.click('#railToggle');await p.waitForTimeout(250);
      ok(T+'round 3: the filter header shows the active count; the caret hides when collapsed',hc.shown&&hc.head==='1'&&col.caret==='none',JSON.stringify({hc,col}));
      await p.click('#filterRail .filter-rail__clear');await p.waitForTimeout(250);
      await p.click('#cardList [data-route]');await p.waitForTimeout(200);
      const row=await p.evaluate(()=>{const rows=[...document.querySelectorAll('#cardList .card__actions')].slice(0,4);return rows.map(a=>new Set([...a.children].filter(k=>k.getClientRects().length).map(k=>Math.round(k.getBoundingClientRect().top))).size)});
      await p.click('#routeToggle');await p.waitForTimeout(250);
      const rp=await p.evaluate(()=>({w:Math.round(document.querySelector('.route-wrap').getBoundingClientRect().width),outline:getComputedStyle(document.getElementById('routeToggle')).outlineStyle}));
      ok(T+'round 3: action rows stay on one line with a card on the route; route panel is at most 420px; no focus ring after a mouse click',row.every(n=>n===1)&&rp.w<=420&&rp.outline==='none',JSON.stringify({row,rp}));
      await p.click('#routeToggle');await p.evaluate(()=>localStorage.clear());
    }
    // ---- Owner decision: icons only; card and pin link by highlight; route stop numbers only while the route is open ----
    if(desktop){
      await go('?category=displays');
      const hl=await p.evaluate(()=>{const n=[...markerByNum.keys()].find(k=>markerByNum.get(k).getElement());return n});
      await p.hover(`#cardList [data-card="${hl}"]`);await p.waitForTimeout(250);
      const ring=await p.evaluate(n=>{const pin=markerByNum.get(n).getElement().querySelector('.pin');return {linked:pin.classList.contains('is-linked'),ring:getComputedStyle(pin,'::after').borderTopColor}},hl);
      ok(T+'hovering a card enlarges and rings its pin',ring.linked&&ring.ring!=='rgba(0, 0, 0, 0)',JSON.stringify(ring));
      await p.mouse.move(5,5);await p.waitForTimeout(150);
      await p.evaluate(n=>markerByNum.get(n).fire('mouseover'),hl);await p.waitForTimeout(150);
      ok(T+'hovering a pin outlines its card',await p.evaluate(n=>document.querySelector(`#cardList [data-card="${n}"]`).classList.contains('is-linked'),hl));
      await p.evaluate(n=>markerByNum.get(n).fire('mouseout'),hl);
      await p.evaluate(n=>toggleRoute(n),hl);await p.waitForTimeout(250);
      const closedBadges=await p.evaluate(()=>document.querySelectorAll('.leaflet-marker-pane .pin__stop').length);
      await p.click('#routeToggle');await p.waitForTimeout(300);
      const openBadge=await p.evaluate(()=>[...document.querySelectorAll('.leaflet-marker-pane .pin__stop')].map(b=>b.textContent));
      await p.click('#routeToggle');await p.waitForTimeout(200);
      const afterClose=await p.evaluate(()=>document.querySelectorAll('.leaflet-marker-pane .pin__stop').length);
      ok(T+'route stop numbers appear on pins only while the route is open',closedBadges===0&&openBadge.join()==='1'&&afterClose===0,JSON.stringify({closedBadges,openBadge,afterClose}));
      await p.evaluate(()=>localStorage.clear());
    }
    // ---- Codex QA defects: hover pin growth, scroll kept across filter changes ----
    if(desktop){
      await go('?category=displays');
      const hv=await p.evaluate(()=>{const lc=document.querySelector('.list-column'),c=[...document.querySelectorAll('#cardList [data-card]')].filter(c=>c.querySelector('[aria-label="Drive-by"]')).pop();c.scrollIntoView({block:'center'});return +c.dataset.card});
      await p.waitForTimeout(200);
      await p.click(`#cardList [data-card="${hv}"] .card__nametext`);await p.waitForTimeout(700);
      const before=await p.evaluate(n=>{const lc=document.querySelector('.list-column').getBoundingClientRect(),c=document.querySelector(`#cardList [data-card="${n}"]`).getBoundingClientRect();return {off:Math.round(c.top-lc.top),st:document.querySelector('.list-column').scrollTop}},hv);
      await p.click('#filterRail [data-rail-filter="show"][data-value="Drive-by"]');await p.waitForTimeout(500);
      const after=await p.evaluate(n=>{const lc=document.querySelector('.list-column').getBoundingClientRect(),c=document.querySelector(`#cardList [data-card="${n}"]`);if(!c)return null;const b=c.getBoundingClientRect();const l=document.querySelector('.list-column');return {off:Math.round(b.top-lc.top),visible:b.top>=lc.top-1&&b.bottom<=lc.bottom+1,clamped:l.scrollTop===0||l.scrollTop>=l.scrollHeight-l.clientHeight-1}},hv);
      ok(T+'filter change keeps the selected card where it was in the results rail',!!after&&after.visible&&(Math.abs(after.off-before.off)<=2||after.clamped),JSON.stringify({before,after}));
      await p.click('#filterRail .filter-rail__clear');await p.waitForTimeout(300);
      await p.hover('#cardList [data-card]');await p.waitForTimeout(300);
      const hp=await p.evaluate(()=>{const n=+document.querySelector('#cardList [data-card]').dataset.card,m=markerByNum.get(n),el=m.getElement(),par=el?null:listingCluster.getVisibleParent(m),t=el||(par&&par.getElement());const inner=el?el.querySelector('.pin'):t&&t.querySelector('.hf-cluster');const w0=inner.offsetWidth,w1=inner.getBoundingClientRect().width;return {clustered:!el,grew:w1>=w0+2,w0,w1:Math.round(w1)}});
      ok(T+'hovering a card enlarges its pin (or its cluster when grouped)',hp.grew,JSON.stringify(hp));
    }
    // ---- Header: the intro line shows at >=1024px only; below it moves into the menu (mobile spec) ----
    if(desktop){
      for(const [w,show] of [[759,false],[760,false],[900,false],[1023,false],[1024,true]]){
        await p.setViewportSize({width:w,height:800});await go('');
        const hd=await p.evaluate(()=>{const i=document.querySelector('.intro-strip__copy'),r=i.getBoundingClientRect(),l=document.querySelector('.banner__img').getBoundingClientRect();return {shown:getComputedStyle(i).display!=='none'&&r.height>0,overlap:r.height>0&&r.left<l.right-1,overflow:document.documentElement.scrollWidth>innerWidth}});
        ok(`${w}px: intro line ${show?'shown':'hidden'}, no logo overlap, no overflow`,hd.shown===show&&!hd.overlap&&!hd.overflow,JSON.stringify(hd));
      }
      await p.setViewportSize({width:1280,height:800});
    }
    // ---- Deep links ----
    await go('?house=8&entity=drakestown-road-2026');
    const d8=await p.evaluate(()=>{const pin=document.querySelector('.leaflet-marker-pane [data-pin="8"]');return {sel:state.selected,card:!!document.querySelector('#cardList [data-card="8"].is-selected'),pin:!!pin&&pin.classList.contains('is-selected')}});
    ok(T+'?house=8&entity= selects its card and pin',d8.sel===8&&d8.card&&d8.pin,JSON.stringify(d8));
    ok(T+'?house=8 card is in view',await inView(8));
    await go('?house=12&view=map',{keepRail:true});await p.waitForTimeout(800);
    const dl=await p.evaluate(()=>{const pin=document.querySelector('.leaflet-marker-pane [data-pin="12"]');const b=pin.getBoundingClientRect(),m=document.getElementById('map').getBoundingClientRect();
      return {zoom:map.getZoom(),selected:state.selected,card:!!document.querySelector('#cardList [data-card="12"].is-selected'),pinSelected:pin.classList.contains('is-selected'),dx:(b.left+b.width/2)-(m.left+m.width/2),tipDy:b.bottom-(m.top+m.height/2),mapTop:m.top,mapBottom:m.bottom,peek:!document.getElementById('mapPeek').classList.contains('is-hidden')}});
    // The open popup can legitimately cover the marker tip on a narrow map, so
    // selection, exact centering and the visible popup are the contract.
    ok(T+'?house=12&view=map selects, centers and shows its card',dl.zoom===15&&dl.selected===12&&dl.pinSelected&&dl.card&&Math.abs(dl.dx)<=3&&Math.abs(dl.tipDy)<=3&&dl.peek,JSON.stringify(dl));
    ok(T+'?house=12 card exists in the rail',await p.evaluate(()=>!!document.querySelector('#cardList [data-card="12"]')));
    ok(T+'map stays in its responsive position',dl.mapTop>=0&&dl.mapTop<vp.height&&(desktop||dl.mapBottom<=vp.height+2),JSON.stringify({top:Math.round(dl.mapTop),bottom:Math.round(dl.mapBottom)}));
    ok(T+'no horizontal overflow after deep links',!(await p.evaluate(probe)).overflowX);
    ok(T+'no page errors',errors.length===0,errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails?`\n${fails} check(s) FAILED`:'\nAll layout checks passed.');
  process.exit(fails?1:0);
})();
