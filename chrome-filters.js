// 1A Phase B: global chrome — Show / Features / When dropdown filters.
// Loaded after layout.js. Overrides renderFilters a third time: app.js ships
// the original chip renderer, layout.js wraps it for treats/events, and this
// file wraps that wrapper, rendering spec dropdowns for displays and treats
// while delegating the events branch untouched. All interaction uses new
// data-dd-* attribute names so the legacy [data-filter]/[data-category-filter]/
// [data-reset-filters]/[data-date-filter] listeners in app.js/layout.js never
// fire on this markup.

const CHROME_SHOW_OPTIONS=[
 {label:'All types',value:'All'},
 {label:'Family Friendly',value:'Family Friendly'},
 {label:'Spooky',value:'Spooky'},
 {label:'Scary',value:'Scary'},
 {label:'Walk-through',value:'Walk-through'},
 {label:'Drive-by',value:'Drive-by'},
 {label:'Walk-up',value:'Walk-by'}
];
// Spec 7.1 wording, verbatim (slash spacing and capitalization differ from
// listing data on purpose — value holds the canonical listing-data key).
const CHROME_FEATURE_OPTIONS=[
 {label:'Animatronics',value:'Animatronics'},
 {label:'Fog',value:'Fog'},
 {label:'Music / Sound',value:'Music/Sound'},
 {label:'Photo opportunities',value:'Photo Opportunities'},
 {label:'Lights',value:'Lights'},
 {label:'Live Actors',value:'Actors'},
 {label:'Costumes Available',value:'Costumes Available'}
];
// Spec 7.2: treat stops get Features and When only — no Town filter.
const CHROME_TREAT_FEATURE_OPTIONS=[
 {label:'Stroller friendly',value:'Stroller friendly'},
 {label:'Porch light on',value:'Porch light on'}
];
// 1A Phase E: events get the same dropdown chrome — Type (single, spec 7.3
// wording verbatim) and Features (multi). Values stay the canonical listing
// keys ('Trunk-or-treat', etc.) so matchingEvents keeps working unchanged.
const CHROME_EVENT_TYPE_OPTIONS=[
 {label:'All types',value:'All'},
 {label:'Trunk-or-Treat',value:'Trunk-or-treat'},
 {label:'Parade',value:'Parade'},
 {label:'Festival',value:'Festival'},
 {label:'Donation drive/Community collection',value:'Donation drive/Community collection'},
 {label:'Other',value:'Other'}
];
const CHROME_EVENT_FEATURE_OPTIONS=['Free','Open to all','Registration required','Kid-friendly'].map(v=>({label:v,value:v}));
function chromeEventTypeLabelForValue(value){const hit=CHROME_EVENT_TYPE_OPTIONS.find(o=>o.value===value);return hit?hit.label:'All types'}
function chromeValueForEventTypeLabel(label){const hit=CHROME_EVENT_TYPE_OPTIONS.find(o=>o.label===label);return hit?hit.value:'All'}
const CHROME_WHEN_OPTIONS=[
 {kind:'',label:'Any night'},
 {kind:'tonight',label:'Tonight'},
 {kind:'weekend',label:'This weekend'},
 {kind:'date',label:'Choose a date'}
];

function chromeShowLabelForValue(value){const hit=CHROME_SHOW_OPTIONS.find(o=>o.value===value);return hit?hit.label:'All types'}
function chromeValueForShowLabel(label){const hit=CHROME_SHOW_OPTIONS.find(o=>o.label===label);return hit?hit.value:'All'}
// Resolve a spec feature label to the canonical listing-data key. The table
// is the source of truth; the featureKey() fallback only covers unknowns in
// the browser and keeps Node (tests) consistent with app.js semantics.
function chromeFeatureValue(label){const raw=String(label).trim();const hit=CHROME_FEATURE_OPTIONS.concat(CHROME_TREAT_FEATURE_OPTIONS).find(o=>o.label===raw);if(hit)return hit.value;if(typeof featureKey==='function')return featureKey(raw);const squashed=raw.toLowerCase().replace(/\s*\/\s*/g,'/');if(squashed==='live actors')return 'Actors';return raw}
function chromeFeatureLabelForValue(value){const hit=CHROME_FEATURE_OPTIONS.concat(CHROME_TREAT_FEATURE_OPTIONS).find(o=>o.value===value);return hit?hit.label:value}
function chromeWhenLabel(df){if(!df||!df.kind)return 'Any night';if(typeof dateFilterLabel==='function'){const l=dateFilterLabel(df);if(l)return l}return df.kind==='tonight'?'Tonight':df.kind==='weekend'?'This weekend':'Choose a date'}
// Live result count for a staged filter session: temporarily swap the state
// fields, count through the real listing pipeline, then restore (no render).
// Only ever called in the browser; kept top-level so tests can require it.
function chromePreviewCount(session){const keepF=state.filter,keepFe=state.features,keepD=state.dateFilter;state.filter=session.filter;state.features=session.features;state.dateFilter=session.dateFilter;let n=0;try{n=state.category==='events'&&typeof matchingEvents==='function'?matchingEvents().length:typeof activeListings==='function'?activeListings().length:0}catch(err){n=0}state.filter=keepF;state.features=keepFe;state.dateFilter=keepD;return n}

if(typeof module!=='undefined')module.exports={CHROME_SHOW_OPTIONS,CHROME_FEATURE_OPTIONS,CHROME_TREAT_FEATURE_OPTIONS,CHROME_EVENT_TYPE_OPTIONS,CHROME_EVENT_FEATURE_OPTIONS,CHROME_WHEN_OPTIONS,chromeShowLabelForValue,chromeValueForShowLabel,chromeEventTypeLabelForValue,chromeValueForEventTypeLabel,chromeFeatureValue,chromeFeatureLabelForValue,chromeWhenLabel,chromePreviewCount};

if(typeof document==='undefined'){/* Node (tests): mapping helpers only, no DOM wiring. */}
else{(function(){
'use strict';
const $=id=>document.getElementById(id);
const filtersEl=$('filters');
if(!filtersEl)return;
const mobileSheets=()=>typeof matchMedia==='function'&&matchMedia('(max-width:767px)').matches;
// The compact rail is for listings and treat stops. Events intentionally keep
// their calendar presentation and existing compact filter controls.
const desktopRail=()=>typeof matchMedia==='function'&&matchMedia('(min-width:1024px)').matches;
const noun=()=>state.category==='treats'?'treat stops':state.category==='events'?'events':'displays';
const featureOptions=()=>state.category==='treats'?CHROME_TREAT_FEATURE_OPTIONS:CHROME_FEATURE_OPTIONS;

function snapshot(){return{filter:state.filter,features:Array.isArray(state.features)?state.features.slice():[],dateFilter:Object.assign({kind:null,date:null},state.dateFilter)}}
function applyText(session){return mobileSheets()?`Show ${chromePreviewCount(session)} ${noun()}`:'Apply'}

function sheetHead(title){return `<div class="dd__sheet-head"><span class="dd__handle" aria-hidden="true"></span><h2 class="dd__title">${title}</h2>${mobileSheets()?'<button type="button" class="dd__clear-all" data-dd-clear-all>Clear all</button>':''}</div>`}
function showMenuHTML(session){
 const rows=CHROME_SHOW_OPTIONS.map(o=>`<label class="dd__row"><input type="radio" name="chrome-show" value="${o.label}"${chromeShowLabelForValue(session.filter)===o.label?' checked':''}><span>${o.label}</span></label>`).join('');
 const foot=mobileSheets()?`<div class="dd__foot"><button type="button" class="btn btn--outline" data-dd-cancel>Cancel</button><button type="button" class="btn btn--primary" data-dd-apply>${applyText(session)}</button></div>`:'';
 return `${sheetHead('Show')}<fieldset class="dd__group"><legend>Show</legend>${rows}</fieldset>${foot}`}
function featuresMenuHTML(session){
 const rows=featureOptions().map(o=>`<label class="dd__row"><input type="checkbox" name="chrome-feature" value="${o.label}"${session.features.includes(o.value)?' checked':''}><span>${o.label}</span></label>`).join('');
 const foot=`<div class="dd__foot"><button type="button" class="btn btn--outline" data-dd-clear>Clear</button><button type="button" class="btn btn--primary" data-dd-apply>${applyText(session)}</button></div>`;
 return `${sheetHead('Features')}<fieldset class="dd__group"><legend>Features</legend>${rows}</fieldset>${foot}`}
function whenMenuHTML(session){
 const df=session.dateFilter||{kind:null,date:null},kind=df.kind||'';
 const rows=CHROME_WHEN_OPTIONS.map(o=>`<label class="dd__row"><input type="radio" name="chrome-when" value="${o.kind}"${kind===o.kind?' checked':''}><span>${o.label}</span></label>`).join('');
 const dateRow=kind==='date'?`<label class="dd__daterow">Date <input type="date" class="dd__date" value="${df.date||''}" aria-label="Filter date"></label>`:'';
 const foot=mobileSheets()?`<div class="dd__foot"><button type="button" class="btn btn--outline" data-dd-cancel>Cancel</button><button type="button" class="btn btn--primary" data-dd-apply>${applyText(session)}</button></div>`:'';
 return `${sheetHead('When')}<fieldset class="dd__group"><legend>When</legend>${rows}</fieldset>${dateRow}${foot}`}
function typeMenuHTML(session){
 const rows=CHROME_EVENT_TYPE_OPTIONS.map(o=>`<label class="dd__row"><input type="radio" name="chrome-etype" value="${o.label}"${chromeEventTypeLabelForValue(session.filter)===o.label?' checked':''}><span>${o.label}</span></label>`).join('');
 const foot=mobileSheets()?`<div class="dd__foot"><button type="button" class="btn btn--outline" data-dd-cancel>Cancel</button><button type="button" class="btn btn--primary" data-dd-apply>${applyText(session)}</button></div>`:'';
 return `${sheetHead('Type')}<fieldset class="dd__group"><legend>Type</legend>${rows}</fieldset>${foot}`}
function efeaturesMenuHTML(session){
 const rows=CHROME_EVENT_FEATURE_OPTIONS.map(o=>`<label class="dd__row"><input type="checkbox" name="chrome-efeature" value="${o.label}"${session.features.includes(o.value)?' checked':''}><span>${o.label}</span></label>`).join('');
 const foot=`<div class="dd__foot"><button type="button" class="btn btn--outline" data-dd-clear>Clear</button><button type="button" class="btn btn--primary" data-dd-apply>${applyText(session)}</button></div>`;
 return `${sheetHead('Features')}<fieldset class="dd__group"><legend>Features</legend>${rows}</fieldset>${foot}`}
function menuBody(kind,session){return kind==='show'?showMenuHTML(session):kind==='features'?featuresMenuHTML(session):kind==='type'?typeMenuHTML(session):kind==='efeatures'?efeaturesMenuHTML(session):whenMenuHTML(session)}
function ddHTML(kind,label,valueText,active,session){return `<details class="dd${active?' dd--active':''}" data-dd="${kind}"><summary class="dd__btn" aria-expanded="false"><span class="dd__label">${label}</span><span class="dd__value">${valueText}</span><span class="dd__caret" aria-hidden="true">▾</span></summary><div class="dd__menu">${menuBody(kind,session)}</div></details>`}

function railChip(action,value,label,pressed){return `<button type="button" class="filter filter--rail" data-rail-filter="${action}" data-value="${String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" aria-pressed="${pressed}">${label}</button>`}
function railSection(label,body){return `<section class="filter-rail__section"><h3>${label}</h3><div class="filter-rail__chips">${body}</div></section>`}
function railActiveCount(){return (state.dateFilter&&state.dateFilter.kind?1:0)+(state.filter&&state.filter!=='All'?1:0)+((state.features||[]).length)}
function railClearHTML(){return railActiveCount()?'<button type="button" class="filter-rail__clear" data-rail-clear>Clear all filters</button>':''}
function railFiltersHTML(){
 const kind=(state.dateFilter&&state.dateFilter.kind)||'',isHalloween=Boolean(state.dateFilter&&state.dateFilter.kind==='date'&&/\-10-31$/.test(state.dateFilter.date||''));
 const whenOpts=state.category==='treats'?CHROME_WHEN_OPTIONS.slice(0,2):CHROME_WHEN_OPTIONS.slice(0,3);
 const when=whenOpts.map(o=>railChip('when',o.kind,o.label,o.kind===''?(!kind):kind===o.kind)).concat(railChip('when-date','halloween','Halloween',isHalloween)).join('');
 let body;
 if(state.category==='treats')body=railSection('When',when)+railSection('Features',featureOptions().map(o=>railChip('feature',o.value,o.label,state.features.includes(o.value))).join(''));
 else if(state.category==='events')body=railSection('Type',CHROME_EVENT_TYPE_OPTIONS.filter(o=>o.value!=='All').map(o=>railChip('event-type',o.value,o.label,state.filter===o.value)).join(''))+railSection('Features',CHROME_EVENT_FEATURE_OPTIONS.map(o=>railChip('event-feature',o.value,o.label,state.features.includes(o.value))).join(''));
 else{
  const visit=[['Drive-by','Drive-by'],['Walk-by','Walk-up'],['Walk-through','Walk-through'],['Drive or walk by (both)','Drive or walk by (both)']].map(([v,l])=>railChip('show',v,l,state.filter===v)).join('');
  const scares=CHROME_SHOW_OPTIONS.filter(o=>['Family Friendly','Spooky','Scary'].includes(o.value)).map(o=>railChip('show',o.value,o.label,state.filter===o.value)).join('');
  body=railSection('When',when)+railSection('How to visit',visit)+railSection('Scare level',scares)+railSection('Features',featureOptions().map(o=>railChip('feature',o.value,o.label,state.features.includes(o.value))).join(''));
 }
 return body+railClearHTML();
}
// Filter panel collapse (v7): 260px <-> 44px. Starts collapsed below 1100px.
const railRoot=document.documentElement;
function railSetCollapsed(on){railRoot.dataset.rail=on?'collapsed':'open';const t=document.getElementById('railToggle');if(t)t.setAttribute('aria-expanded',String(!on));const b=document.getElementById('railExpand');if(b)b.setAttribute('aria-expanded',String(!on));railBadge();setTimeout(()=>{if(typeof map!=='undefined'&&map&&map.invalidateSize)map.invalidateSize()},60)}
function railBadge(){const n=railActiveCount(),el=document.getElementById('railBadge');if(el){el.textContent=String(n);el.hidden=!n}}
if(typeof matchMedia==='function'&&document.getElementById('railToggle')){railSetCollapsed(innerWidth<1100);
 document.getElementById('railToggle').addEventListener('click',()=>railSetCollapsed(railRoot.dataset.rail!=='collapsed'));
 document.getElementById('railExpand').addEventListener('click',()=>railSetCollapsed(false))}

const prevRenderFilters=renderFilters;
renderFilters=function(){
 if(desktopRail()){filtersEl.innerHTML=railFiltersHTML();railBadge();return}
 if(state.category==='events'){const session=snapshot(),fN=session.features.length;filtersEl.innerHTML=ddHTML('type','Type',chromeEventTypeLabelForValue(session.filter),session.filter!=='All',session)+ddHTML('efeatures','Features',fN?`${fN} selected`:'Any',fN>0,session);return}
 const session=snapshot(),features=session.features;
 const featuresText=features.length?`${features.length} selected`:'Any';
 const parts=state.category==='treats'
  ?ddHTML('features','Features',featuresText,features.length>0,session)+ddHTML('when','When',chromeWhenLabel(session.dateFilter),Boolean(session.dateFilter.kind),session)
  :ddHTML('show','Show',chromeShowLabelForValue(session.filter),session.filter!=='All',session)+ddHTML('features','Features',featuresText,features.length>0,session)+ddHTML('when','When',chromeWhenLabel(session.dateFilter),Boolean(session.dateFilter.kind),session);
 filtersEl.innerHTML=parts;
};

function commit(session){state.filter=session.filter;state.features=session.features.slice();state.dateFilter=typeof saveDateFilter==='function'?saveDateFilter(session.dateFilter,localStorage):session.dateFilter;renderFilters();renderCards()}
function paintMenu(dd){const session=dd._chrome||snapshot(),menu=dd.querySelector('.dd__menu');if(menu)menu.innerHTML=menuBody(dd.dataset.dd,session)}
function updateApply(dd){const session=dd._chrome;if(!session)return;const btn=dd.querySelector('[data-dd-apply]');if(btn)btn.textContent=applyText(session)}

// One open dropdown at a time; a fresh staging snapshot on every open.
filtersEl.addEventListener('toggle',e=>{
 const dd=e.target&&e.target.closest?e.target.closest('details.dd'):null;
 if(!dd||!filtersEl.contains(dd))return;
 const summary=dd.querySelector('summary');
 if(dd.open){dd._chrome=snapshot();if(summary)summary.setAttribute('aria-expanded','true');filtersEl.querySelectorAll('details.dd[open]').forEach(o=>{if(o!==dd)o.open=false})}
 else if(summary)summary.setAttribute('aria-expanded','false');
},true);

filtersEl.addEventListener('click',e=>{
 if(e.target.closest('[data-rail-clear]')){state.filter='All';state.features=[];state.categoryFeature='';state.dateFilter={kind:null,date:null};if(typeof saveDateFilter==='function')try{state.dateFilter=saveDateFilter(state.dateFilter,localStorage)}catch{}renderFilters();renderCards();return}
 const rail=e.target.closest('[data-rail-filter]');
 if(rail){
  const action=rail.dataset.railFilter,value=rail.dataset.value;
  if(action==='show')state.filter=state.filter===value?'All':value;
  else if(action==='feature'||action==='event-feature'){const i=state.features.indexOf(value);if(i>=0)state.features.splice(i,1);else state.features.push(value)}
  else if(action==='event-type')state.filter=state.filter===value?'All':value;
  else if(action==='when')state.dateFilter={kind:state.dateFilter&&state.dateFilter.kind===value?null:value,date:null};
  else if(action==='when-date'){const year=(typeof todayParts==='function'?todayParts().dateStr.slice(0,4):String(new Date().getFullYear()));const date=`${year}-10-31`;state.dateFilter=state.dateFilter&&state.dateFilter.kind==='date'&&state.dateFilter.date===date?{kind:null,date:null}:{kind:'date',date};}
  renderFilters();renderCards();return;
 }
 const apply=e.target.closest('[data-dd-apply]');
 if(apply){const dd=apply.closest('details.dd');if(dd&&dd._chrome)commit(dd._chrome);return}
 const cancel=e.target.closest('[data-dd-cancel]');
 if(cancel){const dd=cancel.closest('details.dd');if(dd)dd.open=false;return}
 const clearAll=e.target.closest('[data-dd-clear-all]');
 if(clearAll){const dd=clearAll.closest('details.dd');if(dd){dd._chrome=snapshot();dd._chrome.filter='All';dd._chrome.features=[];dd._chrome.dateFilter={kind:null,date:null};paintMenu(dd);updateApply(dd)}return}
 const clearFeatures=e.target.closest('[data-dd-clear]');
 if(clearFeatures){const dd=clearFeatures.closest('details.dd');if(dd){if(!dd._chrome)dd._chrome=snapshot();dd._chrome.features=[];paintMenu(dd);updateApply(dd)}return}
});

filtersEl.addEventListener('change',e=>{
 const dd=e.target.closest('details.dd');
 if(!dd)return;
 if(!dd._chrome)dd._chrome=snapshot();
 const session=dd._chrome,t=e.target;
 if(t.name==='chrome-show'){session.filter=chromeValueForShowLabel(t.value);if(!mobileSheets()){commit(session);return}updateApply(dd);return}
 if(t.name==='chrome-when'){
  if(t.value==='date'){const existing=session.dateFilter&&session.dateFilter.kind==='date'&&session.dateFilter.date;session.dateFilter={kind:'date',date:existing||(typeof todayParts==='function'?todayParts().dateStr:'')}}
  else session.dateFilter={kind:t.value||null,date:null};
  if(!mobileSheets()){commit(session);return}
  if(t.value==='date')paintMenu(dd);
  updateApply(dd);return}
 if(t.name==='chrome-etype'){session.filter=chromeValueForEventTypeLabel(t.value);if(!mobileSheets()){commit(session);return}updateApply(dd);return}
 if(t.name==='chrome-efeature'){const i=session.features.indexOf(t.value);if(i>=0)session.features.splice(i,1);else session.features.push(t.value);updateApply(dd);return}
 if(t.name==='chrome-feature'){
  const v=chromeFeatureValue(t.value),i=session.features.indexOf(v);
  if(i>=0)session.features.splice(i,1);else session.features.push(v);
  updateApply(dd);return}
 if(t.classList.contains('dd__date')){
  if(!t.value)return;
  session.dateFilter={kind:'date',date:t.value};
  if(!mobileSheets()){commit(session);return}
  updateApply(dd);return}
});

// Escape and click-outside close any open dropdown or the Within menu.
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 const open=document.querySelector('#filters details.dd[open], details.within-dd[open]');
 if(open){const summary=open.querySelector('summary');open.open=false;if(summary)summary.focus()}
});
document.addEventListener('click',e=>{
 if(e.target.closest&&e.target.closest('#filters details.dd, details.within-dd, .within-dd__menu'))return;
 document.querySelectorAll('#filters details.dd[open], details.within-dd[open]').forEach(d=>{d.open=false});
});

// Tabs reset the legacy single-select filters (layout.js selectTab); clear the
// multi-select Feature set alongside so a tab switch never smuggles filters in.
function clearFeaturesWithTab(){if(Array.isArray(state.features)&&state.features.length){state.features=[];renderFilters();renderCards()}}
['displaysTab','treatStopsTab','eventsTab'].forEach(id=>{
 const tab=$(id);
 if(!tab)return;
 tab.addEventListener('click',clearFeaturesWithTab);
 tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key))clearFeaturesWithTab()});
});

// "Within 25 mi" dropdown: the radiogroup keeps its data-radius buttons and
// location.js wiring untouched; this layer only closes the menu and mirrors
// the radius into the summary label.
const withinDD=document.querySelector('details.within-dd');
document.addEventListener('toggle',e=>{
 const t=e.target;
 if(t&&t.classList&&t.classList.contains('within-dd')){
  const summary=t.querySelector(':scope>summary');
  if(summary)summary.setAttribute('aria-expanded',String(t.open));
 }
},true);
document.addEventListener('click',e=>{
 const radius=e.target.closest&&e.target.closest('[data-radius]');
 if(radius&&withinDD)withinDD.open=false;
});
function paintWithin(){const label=document.querySelector('.within-dd__value');if(label&&state.search)label.textContent=state.search.radius+' mi'}
document.addEventListener('hf:search-changed',paintWithin);
paintWithin();

let railWasDesktop=desktopRail();
window.addEventListener('resize',()=>{const next=desktopRail();if(next!==railWasDesktop){railWasDesktop=next;renderFilters()}});

// Replace the chips layout.js painted during its own load.
renderFilters();
})();}
