const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const layout=fs.readFileSync(path.join(__dirname,'../layout.js'),'utf8');
const community=fs.readFileSync(path.join(__dirname,'../community.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');

test('collapsed planner: persistent toggle lives outside the re-rendered planner, region hidden by default',()=>{
  assert.ok(html.includes('id="routeToggle"'),'toggle button exists');
  assert.ok(html.includes('class="route-toggle" id="routeToggle" aria-expanded="false" aria-controls="routeRegion"'),'toggle starts collapsed and names its region');
  assert.ok(html.includes('id="routeRegion" hidden'),'expandable region starts hidden');
  assert.ok(html.includes('id="routePlanner"'),'routePlanner preserved inside the region');
  assert.ok(html.includes('id="routeBadge"'),'count badge preserved (now inside the toggle)');
  assert.ok(html.includes('id="routeHeading"'),'section heading id preserved');
  // toggle markup must be a sibling of routePlanner, not inside it — renderRoute rewrites routePlanner.innerHTML
  const toggleIdx=html.indexOf('id="routeToggle"'),plannerIdx=html.indexOf('id="routePlanner"');
  assert.ok(toggleIdx>-1&&plannerIdx>toggleIdx,'toggle precedes planner in the section');
  assert.ok(html.indexOf('id="routeRegion"')>toggleIdx,'toggle sits outside the expandable region');
});

test('expanded state keeps every existing planner control in the render template',()=>{
  ['route__setup','data-mode="current"','data-mode="address"','id="startAddr"','route__stops-band','id="optimizeRouteBtn"','Suggest order','id="shareOutingBtn"','Share outing','data-move-stop=','data-remove=','No stops yet','id="routeOrderStatus"','route__handoff','up to 10 stops','id="mapRouteBtn"','Map My Route'].forEach(s=>assert.ok(app.includes(s),'planner template lost '+s));
});

test('expand/collapse state machine: aria-expanded, hidden region, hint swap, focus management',()=>{
  assert.ok(app.includes('let routeExpanded=false;'),'session-only flag, no storage key');
  assert.ok(app.includes("t.setAttribute('aria-expanded',String(open))"));
  assert.ok(app.includes('r.hidden=!open'));
  assert.ok(app.includes("hint.textContent=open?'Collapse':'Expand'"));
  assert.ok(app.includes("const f=r.querySelector('button,input');f&&f.focus()"),'focus moves into the planner on expand');
  assert.ok(app.includes('else t.focus()'),'focus returns to the toggle on collapse');
  assert.ok(app.includes("document.getElementById('routeToggle').onclick=()=>setRouteExpanded(!routeExpanded,true)"),'toggle click flips state with focus');
  assert.equal(/localStorage\.setItem\('hfexpand/.test(app),false,'expansion is not persisted');
});

test('adding a stop auto-expands the planner, for listings and events alike',()=>{
  assert.ok(app.includes('const had=state.route.length;state.route=state.route.some(r=>r.num===n)'),'toggleRoute captures the prior length');
  assert.ok(app.includes('const had=state.route.length;state.route=toggleRouteEntry(state.route,{eventId:ev.id})'),'toggleEventRoute captures the prior length');
  assert.equal((app.match(/if\(state\.route\.length>had\)setRouteExpanded\(true,false\)/g)||[]).length,2,'both toggles auto-expand only when the route grew');
});

test('renderRoute serves both the desktop region and the mobile sheet body',()=>{
  assert.ok(app.includes("sheetBody=document.getElementById('routeSheetBody')"),'sheet body is a render target');
  assert.ok(app.includes('plannerTargets=[planner,sheetBody].filter(Boolean)'),'missing sheet tolerated');
  assert.ok(app.includes('plannerTargets.forEach(planner=>{planner.innerHTML=html;'),'same markup written to both containers');
  assert.ok(app.includes("if(sheetBadge)sheetBadge.textContent=state.route.length"),'sheet count badge syncs with the route');
  assert.ok(app.includes("document.getElementById('mobileRouteCount').textContent="),'mobile summary count syncs');
  assert.ok(app.includes("document.getElementById('mobileMapRouteBtn').disabled=!state.route.length"),'mobile button enabled exactly when stops exist');
});

test('mobile sheet dialog is accessible: labelled heading, grabber, close affordance',()=>{
  assert.ok(html.includes('id="routeSheet"'),'sheet dialog exists');
  assert.ok(html.includes('class="route-sheet" id="routeSheet" aria-labelledby="routeSheetHeading"'),'sheet is labelled');
  assert.ok(html.includes('id="routeSheetBadge"'),'sheet has its own count badge');
  assert.ok(html.includes('id="routeSheetBody"'),'sheet has its own planner body');
  assert.ok(html.includes('data-close-dialog>Close planner</button>'),'sheet close button reuses the global dialog closer');
  assert.ok(community.includes('[data-close-dialog]'),'global closer still wired');
  assert.ok(css.includes('.route-sheet{position:fixed;inset:auto 0 0'),'sheet keeps its bottom-sheet styling');
  assert.ok(css.includes('.sheet-grab{'),'grabber styling kept');
});

test('mobile summary bar opens the sheet instead of building the route directly',()=>{
  assert.ok(community.includes("document.getElementById('mobileMapRouteBtn').onclick=openRouteSheet;"),'bar button opens the sheet');
  assert.equal(community.includes('onclick=buildRoute'),false,'bar button no longer builds the route directly');
  assert.ok(app.includes('function openRouteSheet(){renderRoute();'),'sheet opener re-renders before showing');
  assert.ok(app.includes("s.showModal()"),'sheet shown modally');
  assert.equal(layout.includes("$('mobileRouteBar').classList.add('is-hidden')"),false,'sync no longer re-hides the bar after renderRoute shows it');
  assert.ok(layout.includes("$('routeBadge').textContent=state.route.length"),'tab badge still syncs from the route');
});

test('shared route storage and outing links untouched by the collapse work',()=>{
  assert.ok(app.includes("localStorage.setItem('hfroute:2026',JSON.stringify(state.route))"));
  assert.ok(app.includes('function shareOuting(){'),'share outing preserved');
  assert.ok(app.includes('outingLink(state.route)'),'outing link builder still used');
  assert.ok(app.includes('function buildRoute(){'),'Google Maps handoff preserved');
  assert.ok(app.includes('Google Maps supports up to 10 stops'),'ten-stop cap copy preserved');
});

test('toggle bar meets the 44px target size and reads as a compact bar',()=>{
  assert.ok(css.includes('.route-toggle{'),'toggle styles exist');
  assert.ok(css.includes('min-height:52px'),'toggle target is 52px tall');
  assert.ok(css.includes('.route-region{margin-top:14px}'),'region spacing');
  assert.ok(css.includes('.route-sheet>.btn{'),'sheet close button styled');
  assert.ok(css.includes('min-height:44px'),'sheet close button hits 44px');
});
