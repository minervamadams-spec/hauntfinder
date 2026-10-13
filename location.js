// Hauntfinder location search: pure helpers plus browser wiring.
// Loaded after app.js and before layout.js. Nothing here sends location
// anywhere: the only network read is the static ZIP centroid table, and the
// only persistence is the private hfsearch:v1 localStorage key.
const EARTH_MI=3958.8;
const DEFAULT_SEARCH={mode:'zip',zip:'07828',lat:40.884959,lng:-74.755657,radius:25};
const SEARCH_KEY='hfsearch:v1';
const ZIP_TABLE_URL='data/zip-centroids.json';
const RADII=[5,10,25,50];
const ERR_UNKNOWN_ZIP="We couldn't find that ZIP. Check the number, try a nearby ZIP, or use your location.";
const ERR_OUT_OF_COVERAGE='Hauntfinder covers New Jersey, New York and Pennsylvania right now. Try a ZIP in those states.';
const ERR_GEOLOCATION='Location access is off. Enter a ZIP instead, or allow location in your browser settings.';
function haversineMi(a,b){const rad=x=>x*Math.PI/180;const v=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;return EARTH_MI*2*Math.asin(Math.sqrt(Math.min(1,v)))}
function inRadius(distMi,radiusMi){return distMi<=radiusMi}
function sortByDistance(items,center,coordOf){return [...items].sort((x,y)=>haversineMi(coordOf(x),center)-haversineMi(coordOf(y),center))}
function parseZip(v){if(typeof v!=='string')return null;const m=v.trim().match(/^\d{5}$/);return m?m[0]:null}
function isLaunchStateZip(zip){const p=parseZip(zip);if(!p)return false;const n=+p.slice(0,3);return (n>=70&&n<=89)||(n>=100&&n<=149)||(n>=150&&n<=196)}
function nextRadius(r){return ({5:10,10:25,25:50})[r]??null}
const round2=v=>Math.round(v*100)/100;
function normalizeSearch(s){
 const clean={...DEFAULT_SEARCH};
 if(!s||typeof s!=='object')return clean;
 if(['zip','device','area'].includes(s.mode))clean.mode=s.mode;
 if(RADII.includes(s.radius))clean.radius=s.radius;
 const zip=parseZip(s.zip);if(zip)clean.zip=zip;
 if(Number.isFinite(s.lat))clean.lat=s.lat;
 if(Number.isFinite(s.lng))clean.lng=s.lng;
 return clean;
}
// Storage is injectable for tests; every read/write is failure-safe.
function loadSearch(storage){try{return normalizeSearch(JSON.parse(storage.getItem(SEARCH_KEY)||'null'))}catch{return {...DEFAULT_SEARCH}}}
function saveSearch(s,storage){const clean=normalizeSearch(s);if(clean.mode==='device'){clean.lat=round2(clean.lat);clean.lng=round2(clean.lng)}try{storage.setItem(SEARCH_KEY,JSON.stringify(clean))}catch{}return clean}
function describeSearch(s){if(s.mode==='device')return `Near your location · within ${s.radius} mi`;if(s.mode==='area')return `Map area · within ${s.radius} mi`;return `Within ${s.radius} mi of ${s.zip}${s.zip==='07828'?' (Mount Olive area)':''}`}

// ---- Browser wiring (skipped under Node) ----
let zipTablePromise=null;
function loadZipTable(fetchImpl){const f=fetchImpl||(typeof fetch!=='undefined'?fetch:null);if(!f)return Promise.resolve(null);if(!zipTablePromise)zipTablePromise=f(ZIP_TABLE_URL).then(r=>{if(!r.ok)throw new Error('ZIP table unavailable');return r.json()}).catch(()=>null);return zipTablePromise}
if(typeof document!=='undefined'&&typeof window!=='undefined'&&document.getElementById('zipInput')){
 const els={input:document.getElementById('zipInput'),search:document.getElementById('zipSearchBtn'),locate:document.getElementById('locateBtn'),status:document.getElementById('locStatus'),radii:[...document.querySelectorAll('[data-radius]')]};
 let state=loadSearch(localStorage);
 const announce=()=>document.dispatchEvent(new CustomEvent('hf:search-changed',{detail:{...state}}));
 const setStatus=msg=>{els.status.textContent=msg};
 function syncUI(){
  if(state.mode==='zip')els.input.value=state.zip;
  els.radii.forEach(b=>b.setAttribute('aria-checked',String(+b.dataset.radius===state.radius)));
  setStatus(describeSearch(state));
 }
 async function searchZip(){
  const zip=parseZip(els.input.value);
  if(!zip){setStatus(ERR_UNKNOWN_ZIP);els.input.focus();return}
  if(!isLaunchStateZip(zip)){setStatus(ERR_OUT_OF_COVERAGE);return}
  let center=null;
  if(zip==='07828')center={lat:DEFAULT_SEARCH.lat,lng:DEFAULT_SEARCH.lng};
  else{const table=await loadZipTable();const hit=table&&table[zip];if(!hit){setStatus(ERR_UNKNOWN_ZIP);return}center={lat:hit[0],lng:hit[1]}}
  state=saveSearch({...state,mode:'zip',zip,lat:center.lat,lng:center.lng},localStorage);
  syncUI();announce();
 }
 els.search.onclick=searchZip;
 els.input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchZip()}});
 els.locate.onclick=()=>{
  if(!navigator.geolocation){setStatus(ERR_GEOLOCATION);els.input.focus();return}
  setStatus('Locating…');
  navigator.geolocation.getCurrentPosition(
   pos=>{state=saveSearch({...state,mode:'device',lat:pos.coords.latitude,lng:pos.coords.longitude},localStorage);syncUI();announce()},
   ()=>{setStatus(ERR_GEOLOCATION);els.input.focus()},
   {enableHighAccuracy:false,timeout:10000}
  );
 };
 els.radii.forEach(b=>{b.onclick=()=>{state=saveSearch({...state,radius:+b.dataset.radius},localStorage);syncUI();announce()}});
 syncUI();
 announce();
}
if(typeof module!=='undefined')module.exports={haversineMi,inRadius,sortByDistance,parseZip,isLaunchStateZip,nextRadius,normalizeSearch,loadSearch,saveSearch,describeSearch,DEFAULT_SEARCH,SEARCH_KEY,ERR_UNKNOWN_ZIP,ERR_OUT_OF_COVERAGE,ERR_GEOLOCATION};
