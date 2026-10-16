// v7 mobile pass (below 1024px): one view at a time, filter sheet, route sheet, menu drawer.
// Spec: design/Hauntfinder Mobile Spec.dc.html. Sheets are plain in-page panels, not <dialog>.
(()=>{
 const root=document.documentElement,$=id=>document.getElementById(id),mq=matchMedia('(max-width:1023px)');
 const isMobile=()=>mq.matches;
 const noun=()=>state.category==='treats'?['treat stop','treat stops']:state.category==='events'?['event','events']:['display','displays'];
 const resultCount=()=>state.category==='events'?matchingEvents().length:activeListings().filter(x=>!x.placeholder).length;
 // ---- view: list or map, never both ----
 root.dataset.mview='list';
 function setView(v,opts={}){
  const next=v==='map'?'map':'list';root.dataset.mview=next;
  const t=$('viewToggle');if(t){t.setAttribute('aria-pressed',String(next==='map'));$('viewToggleText').textContent=next==='map'?'List view':'Map view';t.firstElementChild.textContent=next==='map'?'☰':'◉'}
  if(next==='map'){window.scrollTo(0,0);requestAnimationFrame(()=>{map.invalidateSize();if(state.category==='events')syncEventPins();else if(state.selected!=null&&opts.keepSelection)revealSelectedPin();else if(state.selected==null)fitVisiblePins()})}
  else hidePeek();
 }
 window.hfSetMobileView=v=>{if(isMobile())setView(v,{keepSelection:true})};
 $('viewToggle').addEventListener('click',()=>setView(root.dataset.mview==='map'?'list':'map'));
 // ---- sheets ----
 const routePanel=$('routePanel'),routeHead=routePanel.querySelector('.route-panel__head'),routeWrap=$('routeSection'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let routeDrag=null,routeSnapTimer=0;
 function resetRouteDrag(spring){
  routeDrag=null;clearTimeout(routeSnapTimer);routePanel.style.transition=spring&&!reducedMotion.matches?'transform 200ms ease-out':'none';routePanel.style.transform='';routeWrap.style.background='';
  if(spring&&!reducedMotion.matches)routeSnapTimer=setTimeout(()=>{routePanel.style.transition=''},210);else routePanel.style.transition='';
 }
 function openSheet(name){root.dataset.sheet=name;const b=name==='route'?$('routeBarBtn'):$('filtersBtn');if(b)b.setAttribute('aria-expanded','true');if(name==='route'){$('routePanel').hidden=false;$('routeBarBtn').setAttribute('aria-expanded','true');root.setAttribute('data-route-open','');syncRouteBadges()}}
 function closeSheet(){const was=root.dataset.sheet;if(was==='route')resetRouteDrag(false);delete root.dataset.sheet;if(was==='route'){$('routePanel').hidden=true;$('routeBarBtn').setAttribute('aria-expanded','false');root.removeAttribute('data-route-open');syncRouteBadges()}if(was==='filters')$('filtersBtn').setAttribute('aria-expanded','false')}
 $('filtersBtn').addEventListener('click',()=>{openSheet('filters');sheetSync()});
 $('sheetClose').addEventListener('click',closeSheet);$('sheetShow').addEventListener('click',closeSheet);
 $('sheetClear').addEventListener('click',()=>{const b=document.querySelector('#filters [data-rail-clear]');if(b)b.click();else{state.filter='All';state.features=[];renderFilters();renderCards()}sheetSync()});
 $('routeBarBtn').addEventListener('click',()=>{root.dataset.sheet==='route'?closeSheet():openSheet('route')});
 $('routeClose').addEventListener('click',closeSheet);
 // The header is the gesture target; keeping the scrolling stop list out of this
 // handler makes it possible to review a long route without accidental dismissal.
 routeHead.addEventListener('pointerdown',e=>{
  if(!isMobile()||root.dataset.sheet!=='route'||e.button!==0||e.target.closest('button,a,input,select,textarea'))return;
  routeDrag={id:e.pointerId,startY:e.clientY,lastY:e.clientY,lastTime:performance.now()};routeHead.setPointerCapture?.(e.pointerId);routePanel.style.transition='none';e.preventDefault();
 });
 routeHead.addEventListener('pointermove',e=>{
  if(!routeDrag||e.pointerId!==routeDrag.id)return;const dy=Math.max(0,e.clientY-routeDrag.startY);const now=performance.now();routeDrag.lastY=e.clientY;routeDrag.lastTime=now;routePanel.style.transform=`translateY(${dy}px)`;routeWrap.style.background=`rgba(0,0,0,${.6*(1-Math.min(1,dy/routePanel.getBoundingClientRect().height))})`;
 });
 const finishRouteDrag=e=>{
  if(!routeDrag||e.pointerId!==routeDrag.id)return;const drag=routeDrag,dy=Math.max(0,e.clientY-drag.startY),velocity=Math.max(0,e.clientY-drag.lastY)/Math.max(1,performance.now()-drag.lastTime),panel=routePanel;
  routeHead.releasePointerCapture?.(e.pointerId);if(dy>panel.getBoundingClientRect().height*.25||velocity>.5)closeSheet();else resetRouteDrag(true);
 };
 routeHead.addEventListener('pointerup',finishRouteDrag);routeHead.addEventListener('pointercancel',()=>{if(routeDrag)resetRouteDrag(true)});
 document.addEventListener('click',e=>{if(root.dataset.sheet==='route'&&isMobile()&&!e.target.closest('#routePanel,#routeBarBtn,[data-route-mini-remove]'))closeSheet()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('menuDrawer').hidden)closeMenu();else if(root.dataset.sheet)closeSheet()}});
 function sheetSync(){const [one,many]=noun(),n=resultCount();$('sheetShow').textContent=`Show ${n} ${n===1?one:many}`;$('sheetTitle').textContent='Filters · '+(state.category==='treats'?'Treat Stops':state.category==='events'?'Events':'Displays')}
 window.hfSheetSync=sheetSync;
 // ---- menu drawer ----
 function openMenu(){$('menuDrawer').hidden=false;$('menuBtn').setAttribute('aria-expanded','true');}
 function closeMenu(){$('menuDrawer').hidden=true;$('menuBtn').setAttribute('aria-expanded','false')}
 $('menuBtn').addEventListener('click',openMenu);
 $('menuDrawer').addEventListener('click',e=>{if(e.target.closest('[data-close-menu]'))closeMenu()});
 $('menuShare').addEventListener('click',()=>{closeMenu();const b=$('shareBtn');if(b)b.click()});
 // ---- card actions ----
 document.addEventListener('click',e=>{
  const mapBtn=e.target.closest('[data-card-map]');
  if(mapBtn){const n=+mapBtn.dataset.cardMap;setView('map',{keepSelection:true});selectListing(n);requestAnimationFrame(()=>{map.invalidateSize();revealSelectedPin();const m=markerByNum.get(n);if(m){const ll=m.getLatLng();map.setView(ll,Math.max(map.getZoom(),14),{animate:false})}});return}
  const evMap=e.target.closest('[data-event-map]');
  if(evMap){const id=evMap.dataset.eventMap,ev=events.find(x=>x.id===id);setView('map');requestAnimationFrame(()=>{map.invalidateSize();if(ev&&Number.isFinite(ev.lat))map.setView([ev.lat,ev.lng],14,{animate:false})});return}
  const more=e.target.closest('[data-card-more]');
  if(more){const card=more.closest('article'),open=card.classList.toggle('is-more-open');more.setAttribute('aria-expanded',String(open));return}
  const full=e.target.closest('[data-peek-full]');
  if(full){const n=+full.dataset.peekFull;setView('list');requestAnimationFrame(()=>{const c=document.querySelector(`#cardList [data-card="${n}"]`);if(c){c.scrollIntoView({block:'center'});document.querySelectorAll('#cardList .is-selected').forEach(x=>x.classList.remove('is-selected'));c.classList.add('is-selected')}})}
 });
 // ---- keep chrome in step with renders ----
 const prevRender=renderCards;renderCards=function(){prevRender();sheetSync();if(typeof railBadge==='function')railBadge()};
 mq.addEventListener('change',()=>{if(!isMobile()){closeSheet();closeMenu();root.dataset.mview='list'}map.invalidateSize()});
 sheetSync();
})();

// ZIP: search as soon as five digits are entered (the mobile search row has no GO button).
(()=>{const i=document.getElementById('zipInput'),go=document.getElementById('zipSearchBtn');if(!i||!go)return;let t;i.addEventListener('input',()=>{clearTimeout(t);if(/^\d{5}$/.test(i.value.trim())&&matchMedia('(max-width:1023px)').matches)t=setTimeout(()=>go.click(),450)})})();
