// /listing.html?id={n}[&entity=…]#feedback | #report-update | #share
// Page-first replacement for the feedback, listing-report and house-share
// dialogs (docs/page-first-interactions-plan.md step 3). The page never guesses
// a listing: it needs an explicit, known, non-placeholder id. Listing data is
// read from app.js's data block (everything before `const filters=`), the same
// slice the API uses, so there is one source of truth.
(function () {
'use strict';
const SECTIONS=['feedback','report-update','share'];
const SITE='https://hauntfinder.vercel.app/';
const REPORT_TO='MTOCommunityFinder@gmail.com';
const isReused=(typeof isReusedSlot==='function')?isReusedSlot:require('./routing').isReusedSlot;
// Shared with the homepage: hours/category formatting (listing-format.js) and
// the hfroute:2026 route store (routing.js).
const fmt=(typeof listingHoursText==='function')?{listingHoursText,listingCategory}:require('./listing-format');
const routeStore=(typeof toggleListingStop==='function')?{loadSavedRoute,saveRoute,toggleListingStop}:require('./routing');

function loadListingData(src){return new Function(String(src).split('const filters=')[0]+';return {listings,events,FORM_URL}')()}
function parseSection(hash){const h=String(hash||'').replace(/^#/,'');return SECTIONS.includes(h)?h:null}
function parseListingParams(search,listings){
  const p=new URLSearchParams(search),ids=p.getAll('id');
  if(ids.length!==1||!/^[1-9]\d*$/.test(ids[0]))return {ok:false,reason:'This page needs a listing id, like listing.html?id=12.'};
  const listing=listings.find(x=>x.num===Number(ids[0]));
  if(!listing||listing.placeholder)return {ok:false,reason:'We could not find that listing.'};
  if(isReused(listing)&&p.get('entity')!==listing.entityId)return {ok:false,reason:'That listing number now belongs to a different listing.'};
  return {ok:true,listing};
}
// Category + type, as the homepage tab and card chips show them.
function kindSummary(house){return {category:fmt.listingCategory(house),types:Array.isArray(house.type)?house.type.slice():[]}}
// "See on the map": the homepage deep link (entity-gated for reused slots),
// opened in map view so phones land on the map, not the card list.
function mapLink(house){return '/?house='+house.num+(isReused(house)?'&entity='+encodeURIComponent(house.entityId):'')+'&view=map'}
// Map preview only for a stored, verified street-address pin; never geocoded.
function mapTarget(house){
  if(!house||!Number.isFinite(house.lat)||!Number.isFinite(house.lng)||typeof house.geoVerified!=='string'||!house.geoVerified.trim())return null;
  return {lat:house.lat,lng:house.lng,kind:fmt.listingCategory(house)==='Treat stop'?'treat':'display',href:mapLink(house)};
}
function houseLink(house,reused){return SITE+'?house='+house.num+(reused?'&entity='+encodeURIComponent(house.entityId):'')}
function housePost(house,link,formUrl){return `We're on the 2026 Hauntfinder!\n\nVisit ${house.name}\n${house.address}\n${[house.dates,house.times].filter(Boolean).join(' · ')||'Check the listing for viewing details.'}\n\nSee our listing: ${link}\nFind more displays near you and build your route: ${SITE}\nHave a display to add or update? ${formUrl}\n\n#MountOliveNJ #Halloween2026 #HauntFinder`}
function reportMailto(house,r){
  const closure=['Weather cancellation','Temporarily closed'].includes(r.type),notes=String(r.notes||'').trim();
  if(closure&&r.through&&r.through<r.from)return {error:'The end date must be on or after the affected date.'};
  if(!closure&&!notes)return {error:'Please add the details visitors should know.'};
  const body=`House: ${house.name}\nAddress: ${house.address}\nListing: ${houseLink(house,isReused(house))}\nReport type: ${r.type}\n${closure?'Affected dates: '+r.from+(r.through?' through '+r.through:'')+'\n':''}\n${notes}`;
  return {href:'mailto:'+REPORT_TO+'?subject='+encodeURIComponent('Haunt Finder listing report: '+r.type+' — '+house.name)+'&body='+encodeURIComponent(body)};
}
if(typeof module!=='undefined')module.exports={SECTIONS,loadListingData,parseSection,parseListingParams,houseLink,housePost,reportMailto,kindSummary,mapLink,mapTarget};
if(typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function skeletonIcon(){return '<svg viewBox="0 0 32 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 14v17M10 18h12M10 22l6 2 6-2M11 26l5 2 5-2M10 17l-5 7 3 8m14-15 5 7-3 8M11 31l5 3 5-3M12 34l-2 6 1 5m9-11 2 6-1 5M7 46h5m8 0h5"/></g><path fill="currentColor" d="M9 7a7 7 0 0 1 14 0v3l-3 2v3h-8v-3l-3-2Z"/><g fill="#0B0910"><ellipse cx="13" cy="7" rx="2" ry="2.3"/><ellipse cx="19" cy="7" rx="2" ry="2.3"/><path d="m16 9-1.5 3h3Z"/><path d="M14 13h1v2h-1zm3 0h1v2h-1z"/></g></svg>'}
function fail(msg){$('listingTitle').textContent='Listing not found';$('listingStatus').innerHTML=escapeHTML(msg)+' <a href="/">Return to the Hauntfinder map</a>';document.title='Listing not found · Hauntfinder'}

async function start(){
  let data;
  try{const r=await fetch('app.js');if(!r.ok)throw new Error('status '+r.status);data=loadListingData(await r.text())}
  catch{return fail('The listing data could not be loaded right now.')}
  const parsed=parseListingParams(location.search,data.listings);
  if(!parsed.ok)return fail(parsed.reason);
  render(parsed.listing,data);
}

function render(house,data){
  const reused=isReused(house),link=houseLink(house,reused),kind=kindSummary(house);
  document.title=house.name+' · Hauntfinder';
  $('listingTitle').textContent=house.name;
  $('listingStatus').hidden=true;$('listingBody').hidden=false;
  $('listingCategory').textContent=kind.category;
  $('listingTypes').innerHTML=kind.types.map(t=>`<span class="chip chip--type">${escapeHTML(t)}</span>`).join('');
  $('listingMeta').textContent=house.address;
  $('listingHours').textContent=fmt.listingHoursText(house);
  $('listingOnMap').href=mapLink(house);
  wireRoute(house,data);renderMap(house,kind);
  wireFeedback(house);wireReport(house);wireShare(house,link,data.FORM_URL);
  const section=parseSection(location.hash);
  if(section)$(section).scrollIntoView();
}

// ---- Add to route (same hfroute:2026 store and entries as the homepage) ----
function wireRoute(house,data){
  const btn=$('listingRouteBtn'),status=$('listingRouteStatus');
  const storage=(()=>{try{return window.localStorage}catch{return null}})();
  const current=()=>routeStore.loadSavedRoute(storage,data.listings,data.events);
  const paint=()=>{const on=current().some(r=>r.num===house.num);btn.setAttribute('aria-pressed',String(on));btn.textContent=on?'✓ On your route':'+ Add to route'};
  btn.addEventListener('click',()=>{
    const r=routeStore.toggleListingStop(current(),house);
    if(r.error){status.textContent=r.error;return}
    if(!routeStore.saveRoute(storage,r.route)){status.textContent='Your route could not be saved on this device.';return}
    paint();
    status.innerHTML=r.added?`Added to your route (${r.route.length} of 10 stops). <a href="/">Open the map</a> to plan directions.`:'Removed from your route.';
  });
  window.addEventListener('storage',e=>{if(e.key===null||e.key==='hfroute:2026')paint()});
  paint();
}

// ---- Map preview (stored verified pin, same tiles and pin art as the homepage) ----
function renderMap(house,kind){
  const t=mapTarget(house),wrap=$('listingMapWrap');
  $('listingMapLink').href=mapLink(house);
  if(!t||typeof L==='undefined'){wrap.hidden=true;return}
  wrap.hidden=false;
  const el=$('listingMap');
  el.setAttribute('role','img');el.setAttribute('aria-label',`Map preview: ${kind.category}, ${house.name}, ${house.address}`);
  const m=L.map(el,{zoomControl:false,dragging:false,touchZoom:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false}).setView([t.lat,t.lng],15);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'}).addTo(m);
  const w=matchMedia('(max-width:767px)').matches?28:38,h=Math.round(w*56/48);
  const pin=`<div class="pin pin--${t.kind}" data-pin="${house.num}"><img class="pin__art" src="assets/icons/pin-${t.kind==='treat'?'treat-stop':'display'}.svg" alt=""></div>`;
  L.marker([t.lat,t.lng],{icon:L.divIcon({className:'',html:pin,iconSize:[w,h],iconAnchor:[w/2,h]}),interactive:false,keyboard:false}).addTo(m);
  m.on('click',()=>{location.href=t.href});
}

// ---- Feedback (same /api/feedback contract the dialog used) ----
function wireFeedback(house){
  const form=$('feedbackForm'),status=$('feedbackStatus'),formStatus=$('feedbackFormStatus'),submit=$('feedbackSubmit');
  $('crowChoices').innerHTML=[1,2,3,4,5].map(n=>`<label class="crow-choice"><input type="radio" name="rating" value="${n}" required aria-label="${n} skeleton${n===1?'':'s'}"><span>${skeletonIcon()}<b>${n}</b></span></label>`).join('');
  const paint=()=>{const chosen=Number(form.querySelector('[name="rating"]:checked')?.value||0);document.querySelectorAll('.crow-choice').forEach(l=>l.classList.toggle('is-filled',Number(l.querySelector('input').value)<=chosen))};
  form.addEventListener('change',paint);
  function show(d){
    const reviews=d.reviews||[],avg=reviews.length?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):null;
    status.textContent=reviews.length?`${avg} / 5 skeletons · ${reviews.length} visitor review${reviews.length===1?'':'s'} (latest first)`:'No feedback yet. Be the first to share your visit.';
    $('feedbackList').innerHTML=reviews.map(r=>`<article class="visitor-review"><div class="review-meta"><strong>${escapeHTML(r.name)}</strong><span aria-label="${r.rating} out of 5 skeletons" class="review-crows">${Array.from({length:5},(_,i)=>`<span class="${i<r.rating?'is-filled':''}">${skeletonIcon()}</span>`).join('')}</span></div><time datetime="${escapeHTML(r.timestamp)}">${escapeHTML(new Date(r.timestamp).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}))}</time><p>${escapeHTML(r.comment)}</p><a class="review-report" href="mailto:${REPORT_TO}?subject=${encodeURIComponent('Haunt Finder feedback report: '+r.id)}">Report this feedback</a></article>`).join('');
  }
  status.textContent='Loading visitor feedback…';
  fetch('/api/feedback?house='+house.num).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'');show(d);submit.disabled=false})
    .catch(()=>{status.textContent='Feedback is temporarily unavailable. Please try again later.'});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!form.reportValidity())return;
    const f=new FormData(form);submit.disabled=true;formStatus.textContent='Posting your feedback…';
    try{
      const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({house:house.num,name:f.get('name'),rating:Number(f.get('rating')),comment:f.get('comment'),website:f.get('website')})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Your feedback was not saved. Please try again.');
      show(d);form.reset();paint();formStatus.textContent='Your feedback is posted. Thank you for visiting!';
    }catch(err){formStatus.textContent=/^(Feedback|Please)/.test(err.message)?err.message:'Your feedback was not saved. Please try again.'}
    finally{submit.disabled=false}
  });
}

// ---- Listing report (prepares an email; nothing is stored here) ----
function wireReport(house){
  const type=$('listingReportType'),from=$('listingReportFrom'),through=$('listingReportThrough'),status=$('listingReportStatus');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  from.value=today;through.min=today;
  function fields(){const closure=['Weather cancellation','Temporarily closed'].includes(type.value);$('listingReportDates').hidden=!closure;from.required=closure;$('listingReportNotes').required=!closure;$('listingReportNotesLabel').textContent=closure?'Note (optional)':'Details'}
  type.onchange=fields;from.onchange=()=>{through.min=from.value};fields();
  $('listingReportForm').addEventListener('submit',e=>{
    e.preventDefault();if(!e.target.reportValidity())return;
    const r=reportMailto(house,{type:type.value,from:from.value,through:through.value,notes:$('listingReportNotes').value});
    if(r.error){status.textContent=r.error;return}
    const a=document.createElement('a');a.href=r.href;a.click();
    status.textContent='Your email app opens with the report. Review it and press Send there to submit.';
  });
}

// ---- Sharing ----
function listingImage(house,link){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const c=canvas.getContext('2d');
  c.fillStyle='#100b1e';c.fillRect(0,0,1080,1080);c.strokeStyle='#7837cf';c.lineWidth=8;c.strokeRect(28,28,1024,1024);
  c.fillStyle='#b2e51a';c.font='bold 28px sans-serif';c.fillText('HAUNTFINDER HALLOWEEN GUIDE • 2026',70,100);
  c.fillStyle='#ff8614';c.font='bold 68px sans-serif';c.fillText('HAUNTFINDER',70,192);c.fillStyle='#f5ecd1';c.font='bold 40px sans-serif';c.fillText('LOCAL HOMES. HALLOWEEN FUN.',70,250);
  function lines(text,y,size,color,maxLines){c.font=`${size}px sans-serif`;c.fillStyle=color;let line='',count=0;for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(c.measureText(next).width>930&&line){if(++count>=maxLines){while(c.measureText(line+'…').width>930)line=line.slice(0,-1);c.fillText(line+'…',70,y);return y+size*1.3}c.fillText(line,70,y);y+=size*1.3;line=word}else line=next}if(line){while(c.measureText(line).width>930)line=line.slice(0,-2)+'…';c.fillText(line,70,y);y+=size*1.3}return y}
  let y=lines(house.name,370,52,'#ff8614',2);y=lines(house.address,y+15,34,'#f5ecd1',2);y=lines([house.dates,house.times].filter(Boolean).join(' · ')||'Check the site for viewing details',y+15,30,'#f5ecd1',3);
  lines([...(house.levels||[]),...(house.type||[])].join(' · '),y+35,28,'#b2e51a',2);
  c.fillStyle='#7837cf';c.fillRect(70,875,940,3);c.fillStyle='#f5ecd1';c.font='bold 34px sans-serif';c.fillText('Find this house. Plan your route.',70,940);c.font='28px sans-serif';c.fillText(link.replace('https://',''),70,994);
  return canvas.toDataURL('image/png');
}
function wireShare(house,link,formUrl){
  const text=$('houseShareText'),status=$('houseShareStatus');
  text.value=housePost(house,link,formUrl);
  const url=listingImage(house,link),name='hauntfinder-house-'+house.num+'-2026.png';
  $('houseShareImage').src=url;const dl=$('downloadHouseImage');dl.href=url;dl.download=name;
  const file=new File([Uint8Array.from(atob(url.split(',')[1]),ch=>ch.charCodeAt(0))],name,{type:'image/png'});
  $('copyHousePost').onclick=async()=>{try{await navigator.clipboard.writeText(text.value);status.textContent='Post copied. Paste it into your social app and attach the saved image.'}catch{text.focus();text.select();status.textContent='Select and copy the suggested post above.'}};
  $('shareHousePost').onclick=async()=>{if(!navigator.share){$('copyHousePost').click();return}try{await navigator.share({title:house.name,text:text.value})}catch(e){if(e.name!=='AbortError')status.textContent='Use Copy post and Save / share image to share.'}};
  $('saveHouseImage').onclick=async()=>{try{if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:house.name});else{dl.click();status.textContent='Image downloaded. On a phone, open it or press and hold the preview to save to Photos.'}}catch(e){if(e.name!=='AbortError')status.textContent='Use Download image, or press and hold the preview to save it.'}};
}

start();
})();
