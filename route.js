// /route.html — the route planner as an ordinary page (page-first plan step 4).
// Replaces the homepage route sheet. The route is the same hfroute:2026 store
// and {num, entityId} / {eventId} entries the homepage uses (routing.js), and
// shareable links use the established ?route= encoder/parser (legacy ?outing=
// links still load). Listing data comes from app.js's data block, the same
// slice listing.js and the API read, so there is one source of truth.
(function () {
'use strict';
const lib=(typeof routeLink==='function')?{routeLink,parseRouteParam,parseOutingParam,loadSavedRoute,saveRoute,routeEntryKey,removeRouteEntry,moveRouteEntry,dropRouteEntry,directionsURL,suggestRouteOrder,isReusedSlot,ROUTE_MAX}:require('./routing');
const fmt=(typeof listingHoursText==='function')?{compactTime,listingCategory}:require('./listing-format');
const loc=(typeof haversineMi==='function')?{haversineMi,formatDistance,describeSearch,loadSearch,stopsWithAreaFlags}:require('./location');
const PAGE='route.html',CAP_MESSAGE='Routes can have up to 10 stops.';

function loadRouteData(src){return new Function(String(src).split('const filters=')[0]+';return {listings,events}')()}
// Initial route: a ?route= (or legacy ?outing=) link wins and becomes the saved
// route, as on the homepage; otherwise the saved route. Links longer than ten
// stops keep the first ten.
function resolveInitialRoute(search,storage,listings,events){
  const p=new URLSearchParams(search||''),raw=p.get('route'),outing=p.get('outing');
  if(raw!==null||outing!==null){
    let route=raw!==null?lib.parseRouteParam(raw,listings,events):lib.parseOutingParam(outing,listings,events);
    if(route.length){
      let message='Shared route loaded.';
      if(route.length>lib.ROUTE_MAX){route=route.slice(0,lib.ROUTE_MAX);message=CAP_MESSAGE+' The first 10 were loaded.'}
      lib.saveRoute(storage,route);
      return {route,message,fromLink:true};
    }
    return {route:lib.loadSavedRoute(storage,listings,events),message:'We could not find the stops in that route link, so your saved route is shown.',fromLink:false};
  }
  return {route:lib.loadSavedRoute(storage,listings,events),message:'',fromLink:false};
}
function routePageURL(route){return route&&route.length?lib.routeLink(route,PAGE):PAGE}
function eventDateLine(x){if(x.ongoing)return 'Open all season';const sch=(typeof eventUpcomingDates==='function')?{eventUpcomingDates}:(typeof require==='function'?require('./schedules'):{});const upcoming=sch.eventUpcomingDates?sch.eventUpcomingDates(x):[];const dates=upcoming.length?upcoming:(x.date?[x.date]:[]);const fmtDay=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});const fmtShort=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});if(!dates.length){const d=x.date||String(x.startAt||'').slice(0,10);return d?fmtDay(d):'Date TBA'}if(dates.length===1)return fmtDay(dates[0]);return fmtDay(dates[0])+' · also '+dates.slice(1).map(fmtShort).join(', ')}
// One stop as the page shows it: title, category, address (listings) or date
// (events), and a link back to the item. Unknown entries return null.
function stopView(entry,{listings,events,search}){
  if(entry&&entry.eventId!=null){
    const x=events.find(e=>e.id===entry.eventId);if(!x)return null;
    return {key:lib.routeEntryKey(entry),name:x.name,category:'Event',detail:[eventDateLine(x),x.hours?fmt.compactTime(x.hours):'',x.venue||x.address||''].filter(Boolean).join(' · '),href:'/?event='+encodeURIComponent(x.id),icon:'v2/icon-event',outOfArea:false};
  }
  const x=listings.find(l=>l.num===entry.num&&l.entityId===entry.entityId&&!l.placeholder);if(!x)return null;
  const outOfArea=Boolean(search)&&Boolean(loc.stopsWithAreaFlags([x],search)[0].outOfArea);
  const category=fmt.listingCategory(x);
  return {key:lib.routeEntryKey(entry),name:x.name,category,detail:x.address,href:'listing.html?id='+x.num+(lib.isReusedSlot(x)?'&entity='+encodeURIComponent(x.entityId):''),icon:category==='Treat stop'?'v2/icon-treat-stop':'v2/icon-display',outOfArea};
}
if(typeof module!=='undefined')module.exports={loadRouteData,resolveInitialRoute,routePageURL,stopView};
if(typeof document==='undefined')return;

// ---- Page ----
const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage=(()=>{try{return window.localStorage}catch{return null}})();
let data=null,route=[],message='',search=null;
const ui={startMode:'current',startAddr:'',startEditing:false};

function stopsNow(){return route.map(r=>stopView(r,{...data,search})).filter(Boolean)}
function resolved(){return route.map(r=>r.eventId!=null?data.events.find(e=>e.id===r.eventId):data.listings.find(l=>l.num===r.num)).filter(Boolean)}
function startLabel(){if(ui.startMode==='address'&&ui.startAddr.trim())return ui.startAddr.trim();return search?loc.describeSearch(search):'your location'}
// Every edit goes through commit: storage, the page URL (replaceState, so Back
// leaves the page instead of stepping through edits) and the view stay in step.
function commit(next,msg,focus){route=next;message=msg||'';lib.saveRoute(storage,route);history.replaceState(null,'',routePageURL(route));render(focus)}

function render(focus){
  const stops=stopsNow(),n=stops.length;
  $('routeSummary').textContent=n?`${n} of 10 stop${n===1?'':'s'}`+(search?` · distances from ${loc.describeSearch(search).replace(/^Within \d+ mi of /,'')}`:''):'No stops yet';
  $('routeEmpty').hidden=n>0;$('routeBody').hidden=n===0;
  hideConfirm(false);
  if(!n){$('routeEmptyStatus').textContent=message;return}
  $('routePlanner').innerHTML=`<div class="route__start"><div class="route__start-summary"><span class="route__start-label">Starting from</span><strong class="route__start-loc">${esc(startLabel())}</strong><button type="button" class="route__linkbtn route__change" id="startEditBtn" aria-expanded="${ui.startEditing}" aria-controls="startEdit">Change</button></div><div class="route__start-edit" id="startEdit"${ui.startEditing?'':' hidden'}><label class="route__label" for="startAddr">Starting point</label><div class="route__start-row"><input class="route__input" id="startAddr" value="${esc(ui.startAddr)}" placeholder="Enter your starting address" autocomplete="street-address"><button type="button" class="route__locate" data-locate aria-label="Use my current location">◎</button></div><div class="seg" role="radiogroup" aria-label="Starting point"><button type="button" data-mode="current" role="radio" aria-checked="${ui.startMode==='current'}">My location</button><button type="button" data-mode="address" role="radio" aria-checked="${ui.startMode==='address'}">Enter address</button></div>${ui.startMode==='current'?'<div class="current-note"><span class="current-dot"></span>Google Maps uses your location when you open directions</div>':''}</div></div>
<div class="route__stops"><ol class="route__timeline" id="routeStops">${stops.map((s,i)=>`<li class="route-stop" draggable="true" data-stop-key="${esc(s.key)}"><span class="route-stop__grip" aria-hidden="true"></span><span class="route-stop__num" aria-hidden="true">${i+1}</span><img class="route-stop__icon" src="assets/icons/${s.icon}.svg" alt="" width="30" height="35"><div class="route-stop__meta"><a class="route-stop__name" href="${esc(s.href)}">${esc(s.name)}</a><span class="route-stop__category">${esc(s.category)}</span><small>${esc(s.detail)}${s.outOfArea?' · Outside your current search area':''}</small></div><div class="route-stop__controls"><button type="button" data-move-stop="${esc(s.key)}" data-direction="-1" ${i===0?'disabled':''} aria-label="Move ${esc(s.name)} earlier">↑</button><button type="button" data-move-stop="${esc(s.key)}" data-direction="1" ${i===n-1?'disabled':''} aria-label="Move ${esc(s.name)} later">↓</button></div><button type="button" class="route-stop__remove route__linkbtn" data-remove-stop="${esc(s.key)}" aria-label="Remove ${esc(s.name)}"><span class="route-stop__remove-label">Remove</span><span class="route-stop__remove-x" aria-hidden="true">×</span></button></li>`).join('')}</ol></div>
<div class="route__foot"><p class="route__status" id="routeOrderStatus" role="status">${esc(message)}</p><p class="route__helper route__foot-helper">Up to 10 stops. Drag or use the arrows to reorder.</p><div class="route__foot-row"><button class="btn btn--primary route__directions" id="mapRouteBtn" type="button">Get directions ↗</button><div class="route__links"><button type="button" class="route__linkbtn" id="optimizeRouteBtn" ${n<2?'disabled':''}>Suggest order</button><button type="button" class="route__linkbtn" id="shareRouteBtn">Copy route link</button></div></div></div>`;
  wire();
  if(focus)restoreFocus(focus);
}
function restoreFocus(f){
  let el=null;
  if(f.move){el=document.querySelector(`[data-move-stop="${CSS.escape(f.move)}"][data-direction="${f.dir}"]`);if(el&&el.disabled)el=document.querySelector(`[data-move-stop="${CSS.escape(f.move)}"][data-direction="${-f.dir}"]`)}
  else if(f.removedAt!=null){const rest=[...document.querySelectorAll('[data-remove-stop]')];el=rest[Math.min(f.removedAt,rest.length-1)]||null}
  else if(f.id)el=$(f.id);
  (el||$('routeSummary')).focus();
}
function wire(){
  document.querySelectorAll('[data-move-stop]').forEach(b=>b.onclick=()=>{const key=b.dataset.moveStop,dir=+b.dataset.direction;commit(lib.moveRouteEntry(route,key,dir),'Stop order updated.',{move:key,dir})});
  document.querySelectorAll('[data-remove-stop]').forEach(b=>b.onclick=()=>{const key=b.dataset.removeStop,at=route.findIndex(r=>lib.routeEntryKey(r)===key),name=(stopsNow().find(s=>s.key===key)||{}).name||'Stop';commit(lib.removeRouteEntry(route,key),name+' removed from your route.',{removedAt:at})});
  document.querySelectorAll('.route-stop').forEach(li=>{
    li.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',li.dataset.stopKey);e.dataTransfer.effectAllowed='move'});
    li.addEventListener('dragover',e=>{e.preventDefault();li.classList.add('is-dragover')});
    li.addEventListener('dragleave',()=>li.classList.remove('is-dragover'));
    li.addEventListener('drop',e=>{e.preventDefault();li.classList.remove('is-dragover');const from=e.dataTransfer.getData('text/plain');if(from&&from!==li.dataset.stopKey)commit(lib.dropRouteEntry(route,from,li.dataset.stopKey),'Stop order updated.')});
  });
  $('startEditBtn').onclick=()=>{ui.startEditing=!ui.startEditing;render({id:ui.startEditing?'startAddr':'startEditBtn'})};
  document.querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>{ui.startMode='current';message='';render({id:'startAddr'})});
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ui.startMode=b.dataset.mode;message='';render({id:'startAddr'})});
  const addr=$('startAddr');if(addr)addr.addEventListener('input',e=>{ui.startAddr=e.target.value;ui.startMode='address';document.querySelector('.route__start-loc').textContent=startLabel();document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.mode==='address')))});
  $('mapRouteBtn').onclick=()=>{const r=lib.directionsURL(resolved(),ui);if(r.error){message=r.error;render({id:'mapRouteBtn'});return}window.open(r.url,'_blank','noopener')};
  $('optimizeRouteBtn').onclick=()=>{if(route.length<2)return;const origin=search&&Number.isFinite(search.lat)&&Number.isFinite(search.lng)?{lat:search.lat,lng:search.lng}:null;commit(lib.suggestRouteOrder(route,data.listings,data.events,origin),'Suggested nearest-first from your starting point. Event times stay in order. Check roads and hours in Google Maps.',{id:'optimizeRouteBtn'})};
  $('shareRouteBtn').onclick=async()=>{const link=lib.routeLink(route,location.origin+'/'+PAGE);try{await navigator.clipboard.writeText(link);message='Route link copied. Send it to friends.'}catch{message='Copy this link: '+link}render({id:'shareRouteBtn'})};
}

// ---- Clear: inline confirmation, never a dialog ----
function showConfirm(){const n=route.length;$('clearConfirmText').textContent=`Remove all ${n} stop${n===1?'':'s'} from your route?`;$('clearConfirm').hidden=false;$('clearRouteBtn').setAttribute('aria-expanded','true');$('clearNo').focus()}
function hideConfirm(refocus){if(!$('clearConfirm'))return;const was=!$('clearConfirm').hidden;$('clearConfirm').hidden=true;$('clearRouteBtn').setAttribute('aria-expanded','false');if(was&&refocus)$('clearRouteBtn').focus()}

document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(!$('clearConfirm').hidden){e.preventDefault();hideConfirm(true);return}
  if(ui.startEditing){e.preventDefault();ui.startEditing=false;render({id:'startEditBtn'})}
});

async function start(){
  try{const r=await fetch('app.js');if(!r.ok)throw new Error('status '+r.status);data=loadRouteData(await r.text())}
  catch{$('routeSummary').textContent='Your route could not be loaded right now. Please try again.';return}
  try{search=loc.loadSearch(storage)}catch{search=null}
  const init=resolveInitialRoute(location.search,storage,data.listings,data.events);
  route=init.route;message=init.message;
  history.replaceState(null,'',routePageURL(route));
  $('clearRouteBtn').onclick=showConfirm;
  $('clearNo').onclick=()=>hideConfirm(true);
  $('clearYes').onclick=()=>commit([],'Your route is cleared.',{id:'routeSummary'});
  // Another tab (or the homepage in another window) changed the route.
  window.addEventListener('storage',e=>{if(e.key===null||e.key==='hfroute:2026'){route=lib.loadSavedRoute(storage,data.listings,data.events);message='';history.replaceState(null,'',routePageURL(route));render()}});
  render();
}
start();
})();
