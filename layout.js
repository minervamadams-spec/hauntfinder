// The route planner stays below the map in both listing categories.
(() => {
 const $=id=>document.getElementById(id);
 function updatePages(){const count=listings.filter(matchFilter).length,pages=Math.ceil(count/3);$('listingPages').hidden=pages<2;$('previousListings').disabled=state.page===0;$('nextListings').disabled=state.page>=pages-1;$('listingPageSummary').textContent=count?`${state.page*3+1}–${Math.min(count,state.page*3+3)} of ${count}`:'';}
 function sync(){const treats=state.category==='treats',shown=listings.filter(matchFilter).length;
  $('routeBadge').textContent=state.route.length;
  $('displayTabCount').textContent='('+listings.filter(x=>!isTreatStop(x)).length+')';
  $('treatStopCount').textContent='('+listings.filter(isTreatStop).length+')';
  $('displaysPanel').setAttribute('aria-labelledby',treats?'treatStopsTab':'displaysTab');
  $('treatStopsIntro').hidden=!treats;
  $('filters').hidden=treats;
  $('mapCategoryHint').textContent=treats?'Candy stops for trick-or-treaters':'Click or tap a pumpkin for details';
  $('noResults').querySelector('strong').textContent=treats?'Be the first treat stop':'Nothing here yet';
  $('noResultsText').textContent=treats?'No homes have signed up for this list yet. Welcome trick-or-treaters by adding your home.':`No displays match “${state.filter}” right now.`;
  $('showAllBtn').hidden=treats;
  $('mobileRouteBar').classList.add('is-hidden');
  updatePages();
 }
 function selectTab(name,focus=false){const treats=name==='treats';state.category=name;state.page=0;state.selected=null;$('mapPeek').classList.add('is-hidden');
  $('displaysTab').setAttribute('aria-selected',String(!treats));$('treatStopsTab').setAttribute('aria-selected',String(treats));
  $('displaysTab').tabIndex=treats?-1:0;$('treatStopsTab').tabIndex=treats?0:-1;
  $('displaysPanel').scrollTop=0;renderCards();
  markerByNum.forEach(m=>m.getElement()?.querySelector('.pin')?.classList.remove('is-selected'));
  if(focus)$(treats?'treatStopsTab':'displaysTab').focus();
 }
 for(const [id,name] of [['displaysTab','displays'],['treatStopsTab','treats']]){$(id).onclick=()=>selectTab(name);$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectTab(e.key==='Home'?'displays':e.key==='End'?'treats':state.category==='treats'?'displays':'treats',true)}}}
 $('previousListings').onclick=()=>{state.page=Math.max(0,state.page-1);renderCards()};
 $('nextListings').onclick=()=>{state.page++;renderCards()};
 const oldCards=renderCards,oldRoute=renderRoute;
 let lastFilter=state.filter;
 renderCards=function(){if(lastFilter!==state.filter){state.page=0;lastFilter=state.filter}oldCards();sync()};renderRoute=function(){oldRoute();sync()};
 const oldSelect=selectListing;
 selectListing=function(n,scroll=false){const x=listings.find(v=>v.num===n);if(x){const category=isTreatStop(x)?'treats':'displays';if(category!==state.category)selectTab(category);if(!matchFilter(x)){state.filter='All';lastFilter='All';renderFilters()}const position=listings.filter(matchFilter).findIndex(v=>v.num===n);if(position>=0&&Math.floor(position/3)!==state.page){state.page=Math.floor(position/3);renderCards()}}oldSelect(n,scroll)};
 // Markers finish loading asynchronously; apply the current category as they arrive.
 const oldLoad=loadMarkers;loadMarkers=async function(){await oldLoad();renderCards()};
 const observer=new MutationObserver(()=>{markerByNum.forEach((m,n)=>{const x=listings.find(v=>v.num===n);if(x&&!matchFilter(x))map.removeLayer(m)})});
 observer.observe(document.getElementById('map'),{childList:true,subtree:true});
 window.addEventListener('resize',()=>{map.invalidateSize();updatePages()});renderCards();
})();
