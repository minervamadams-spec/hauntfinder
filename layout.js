// Compact desktop panels and a single mobile route planner.
(() => {
 const $=id=>document.getElementById(id),desktop=()=>matchMedia('(min-width:1024px)').matches;
 const sheet=$('routeSheet'),section=$('routeSection'),panels=$('contentPanels');
 let currentTab='displays';
 function updateHint(){const panel=$('displaysPanel');$('listMore').hidden=currentTab!=='displays'||!desktop()||document.querySelectorAll('.card').length<4||panel.scrollTop+panel.clientHeight>=panel.scrollHeight-3}
 function sync(){const count=state.route.length;$('routeBadge').textContent=count;$('displayTabCount').textContent='('+listings.filter(matchFilter).length+')';$('mobileRouteBar').classList.remove('is-hidden');$('mobileRouteCount').textContent=count+' stop'+(count===1?'':'s')+' added';$('mobileMapRouteBtn').disabled=count===0;$('mobileMapRouteBtn').textContent='Plan route ▴';updateHint()}
 function selectTab(name,focus=false){currentTab=name;const route=name==='route';$('displaysTab').setAttribute('aria-selected',String(!route));$('routeTab').setAttribute('aria-selected',String(route));$('displaysTab').tabIndex=route?-1:0;$('routeTab').tabIndex=route?0:-1;$('displaysPanel').hidden=route;section.hidden=!route;if(focus)$(route?'routeTab':'displaysTab').focus();updateHint()}
 for(const [id,name] of [['displaysTab','displays'],['routeTab','route']]){$(id).onclick=()=>selectTab(name);$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectTab(e.key==='Home'?'displays':e.key==='End'?'route':currentTab==='route'?'displays':'route',true)}}}
 $('displaysPanel').addEventListener('scroll',updateHint);
 const oldCards=renderCards,oldRoute=renderRoute;
 renderCards=function(){oldCards();sync()};renderRoute=function(){oldRoute();sync()};
 $('mobileMapRouteBtn').onclick=()=>{if(!state.route.length)return;section.hidden=false;$('sheetContent').append(section);sheet.showModal()};
 $('closeRouteSheet').onclick=()=>sheet.close();sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)sheet.close()}});
 sheet.addEventListener('close',()=>{panels.append(section);section.hidden=!desktop()||currentTab!=='route'});
 function resize(){if(desktop()&&sheet.open)sheet.close();if(desktop()){selectTab(currentTab)}else{$('displaysPanel').hidden=false;section.hidden=!sheet.open}map.invalidateSize();sync()}
 window.addEventListener('resize',resize);resize();
})();
