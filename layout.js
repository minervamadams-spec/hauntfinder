// The route planner stays below the map in both listing categories.
(() => {
 const $=id=>document.getElementById(id);
 function updateHint(){const panel=$('displaysPanel');$('listMore').hidden=!matchMedia('(min-width:1024px)').matches||document.querySelectorAll('.card').length<4||panel.scrollTop+panel.clientHeight>=panel.scrollHeight-3}
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
  updateHint();
 }
 function selectTab(name,focus=false){const treats=name==='treats';state.category=name;state.selected=null;$('mapPeek').classList.add('is-hidden');
  $('displaysTab').setAttribute('aria-selected',String(!treats));$('treatStopsTab').setAttribute('aria-selected',String(treats));
  $('displaysTab').tabIndex=treats?-1:0;$('treatStopsTab').tabIndex=treats?0:-1;
  $('displaysPanel').scrollTop=0;renderCards();
  markerByNum.forEach(m=>m.getElement()?.querySelector('.pin')?.classList.remove('is-selected'));
  if(focus)$(treats?'treatStopsTab':'displaysTab').focus();
 }
 for(const [id,name] of [['displaysTab','displays'],['treatStopsTab','treats']]){$(id).onclick=()=>selectTab(name);$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectTab(e.key==='Home'?'displays':e.key==='End'?'treats':state.category==='treats'?'displays':'treats',true)}}}
 $('displaysPanel').addEventListener('scroll',updateHint);
 const oldCards=renderCards,oldRoute=renderRoute;
 renderCards=function(){oldCards();sync()};renderRoute=function(){oldRoute();sync()};
 // Markers finish loading asynchronously; apply the current category as they arrive.
 const oldLoad=loadMarkers;loadMarkers=async function(){await oldLoad();renderCards()};
 const observer=new MutationObserver(()=>{markerByNum.forEach((m,n)=>{const x=listings.find(v=>v.num===n);if(x&&!matchFilter(x))map.removeLayer(m)})});
 observer.observe(document.getElementById('map'),{childList:true,subtree:true});
 window.addEventListener('resize',()=>{map.invalidateSize();updateHint()});sync();
})();
