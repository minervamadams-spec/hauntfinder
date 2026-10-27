// 1A Phase H: shareable filter state in the URL (?category=displays&show=…).
// Loaded after chrome-filters.js: layout.js has already consumed ?category (and
// selectTab has reset the filters), so this module re-applies any show /
// features / when / view / zip / mi params on top of those defaults — URL
// params override defaults. Writes are silent (history.replaceState) and only
// ever touch the keys this module owns (category, show, features, when, zip,
// mi, view, day, week); deep-link keys (?house=, ?event=, ?route=, ?outing=) and any
// other foreign params are preserved untouched.

const HF_URL_OWNED=['category','show','features','when','zip','mi','view','day','week'];
const HF_URL_RADII=[5,10,25,50];
// Whitelists mirror chrome-filters.js option values (the canonical listing keys).
const HF_URL_SHOW={
 displays:['Family Friendly','Spooky','Scary','Walk-through','Drive-by','Walk-by'],
 events:['Trunk-or-treat','Parade','Festival','Donation drive/Community collection','Other']
};
const HF_URL_FEATURES={
 displays:['Animatronics','Fog','Music/Sound','Photo Opportunities','Lights','Actors','Costumes Available'],
 treats:['Stroller friendly','Porch light on'],
 events:['Free','Open to all','Registration required','Kid-friendly']
};

// when=tonight | weekend | date:YYYY-MM-DD  →  {kind,date} (null when absent/invalid)
function hfParseWhen(raw){
 if(raw==='tonight')return{kind:'tonight',date:null};
 if(raw==='weekend')return{kind:'weekend',date:null};
 const m=String(raw||'').match(/^date:(\d{4}-\d{2}-\d{2})$/);
 if(m)return{kind:'date',date:m[1]};
 return null;
}
// {kind,date} → when= param value (null when no active filter)
function hfFormatWhen(df){
 if(!df||!df.kind)return null;
 if(df.kind==='date'&&df.date)return'date:'+df.date;
 return df.kind==='tonight'?'tonight':df.kind==='weekend'?'weekend':null;
}

if(typeof module!=='undefined')module.exports={HF_URL_OWNED,HF_URL_RADII,HF_URL_SHOW,HF_URL_FEATURES,hfParseWhen,hfFormatWhen};

if(typeof document==='undefined'){/* Node (tests): parse/format helpers only, no DOM wiring. */}
else{(function(){
'use strict';
const $=id=>document.getElementById(id);

function hfWriteURL(){
 try{
  const u=new URL(location.href);
  HF_URL_OWNED.forEach(k=>u.searchParams.delete(k));
  u.searchParams.set('category',state.category);
  if(state.category!=='treats'&&state.filter&&state.filter!=='All')u.searchParams.set('show',state.filter);
  if(Array.isArray(state.features)&&state.features.length)u.searchParams.set('features',state.features.join(','));
  const when=hfFormatWhen(state.dateFilter);
  if(when)u.searchParams.set('when',when);
  if(state.search&&/^\d{5}$/.test(String(state.search.zip||''))){
   u.searchParams.set('zip',String(state.search.zip));
   u.searchParams.set('mi',String(state.search.radius));
  }
  if(state.category==='events'&&state.eventWeek)u.searchParams.set('week',state.eventWeek);
  if(state.category==='events'&&state.eventDay)u.searchParams.set('day',String(+state.eventDay.slice(8,10)));
  history.replaceState(null,'',u);
 }catch(err){/* never break rendering over a URL write */}
}

// Write after every render (covers filters, when, zip/mi via hf:search-changed,
// day toggles). view=map is a one-shot instruction (show the map, see
// restore) and is never written back: the map-first layout has no Map/List
// state to share.
const prevRenderCards=renderCards;
renderCards=function(){const out=prevRenderCards.apply(this,arguments);hfWriteURL();return out};

// ---- Restore: URL params override the tab defaults selectTab just reset. ----
(function restore(){
 const params=new URLSearchParams(location.search),category=state.category;
 // show (single-select): whitelist per category; treats has no Show filter.
 const showWhitelist=HF_URL_SHOW[category]||[];
 const show=params.get('show');
 if(show&&showWhitelist.includes(show))state.filter=show;
 // features (multi-select): keep only canonical keys for this category.
 const featRaw=params.get('features');
 if(featRaw){
  const known=HF_URL_FEATURES[category]||[];
  state.features=featRaw.split(',').map(s=>s.trim()).filter(v=>known.includes(v));
 }
 // when: session-only, mirroring the Release-2 hotfix (no hfdate:v1 write).
 const when=hfParseWhen(params.get('when'));
 if(when&&typeof normalizeDateFilter==='function')state.dateFilter=normalizeDateFilter(when);
 else if(when)state.dateFilter=when;
 // view=map: bring the map on screen (and center a linked ?house= pin).
 if(params.get('view')==='map'&&typeof window.hfApplyView==='function')window.hfApplyView('map');
 renderFilters();
 renderCards();
 // zip + mi: hand the zip to the existing location.js pipeline (it validates
 // launch-state coverage), then widen the radius if the URL asks.
 const zip=params.get('zip'),miRaw=params.get('mi'),mi=Number(miRaw);
 if(zip&&/^\d{5}$/.test(zip)){
  const input=$('zipInput'),btn=$('zipSearchBtn');
  if(input&&btn){
   input.value=zip;
   btn.click();
   if(miRaw==='all')document.dispatchEvent(new CustomEvent('hf:expand-radius',{detail:{radius:'all'}}));
   else if(HF_URL_RADII.includes(mi))document.dispatchEvent(new CustomEvent('hf:expand-radius',{detail:{radius:mi}}));
  }
 }
})();
})();}
