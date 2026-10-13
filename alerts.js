(() => {
 // ---- Release 6 increment 2: optional ZIP/radius area alerts. ----
 // Pure helpers (Node-testable): the area choice is optional — an unchecked
 // toggle must produce a request byte-identical to the region-wide signup.
 const RADII=[5,10,25,50];
 function parseZipInput(v){const m=String(v||'').trim().match(/^\d{5}$/);return m?m[0]:null}
 // Decide the area payload from UI state. Disabled → no area. Enabled → a
 // valid {zip, radius} pair, or an error string (mirrors the server-side
 // areaPrefs validation so both reject the same input).
 function areaChoice(state){
  if(!state.enabled)return {area:null};
  const zip=parseZipInput(state.zip);
  if(!zip||!RADII.includes(state.radius))return {error:'Enter a 5-digit ZIP code and choose a distance (5, 10, 25 or 50 mi).'};
  return {area:{zip,radius:state.radius}};
 }
 // Build the subscribe POST body; zip/radius are sent only when a valid pair
 // exists, so the default (no area) request is unchanged.
 function buildSubscribePayload(fields){
  const body={action:'subscribe',email:fields.email,categories:fields.categories,seasons:fields.seasons,consent:fields.consent,website:fields.website};
  if(fields.area)Object.assign(body,{zip:fields.area.zip,radius:fields.area.radius});
  return body;
 }
 function describeArea(area){return area?`within ${area.radius} mi of ${area.zip}`:''}
 if(typeof document!=='undefined'&&document.getElementById('alertsForm')){
  const status=document.getElementById('alertsStatus'),form=document.getElementById('alertsForm'),actionForm=document.getElementById('alertsAction');
  const params=new URLSearchParams(location.search),action=params.get('action'),token=params.get('token');
  if(params.get('embed')==='1'&&window.parent!==window){document.body.classList.add('alerts-embedded');document.addEventListener('keydown',event=>{if(event.key==='Escape')window.parent.postMessage('close-alerts',location.origin)})}
  async function post(body){const r=await fetch('/api/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Please try again later.');return d}
  if((action==='confirm'||action==='unsubscribe')&&token){
   document.getElementById('alertsHeading').textContent=action==='confirm'?'Confirm your listing alerts':'Unsubscribe from listing alerts';
   document.getElementById('alertsIntro').textContent=action==='confirm'?'Confirm that you requested these email alerts.':'Stop all Halloween and Holiday listing alerts.';
   document.getElementById('alertsActionButton').textContent=action==='confirm'?'Confirm my subscription':'Unsubscribe';
   status.textContent='';actionForm.hidden=false;
   actionForm.addEventListener('submit',async e=>{e.preventDefault();const button=actionForm.querySelector('button');button.disabled=true;try{const d=await post({action,token});status.textContent=d.message;actionForm.hidden=true;history.replaceState(null,'','/alerts.html')}catch(e){status.textContent=e.message;button.disabled=false}});
   return;
  }
  const areaToggle=document.getElementById('alertsAreaToggle'),areaControls=document.getElementById('alertsAreaControls'),zipInput=document.getElementById('alertsZip'),radiusButtons=[...document.querySelectorAll('[data-alert-radius]')];
  let radius=25;
  if(areaToggle)areaToggle.onchange=()=>{areaControls.hidden=!areaToggle.checked};
  radiusButtons.forEach(b=>b.onclick=()=>{radius=+b.dataset.alertRadius;radiusButtons.forEach(x=>x.setAttribute('aria-checked',String(x===b)))});
  fetch('/api/subscriptions').then(r=>r.json()).then(d=>{form.hidden=!d.available;status.textContent=d.available?'':'Signup is being set up. Please check back soon.'}).catch(()=>{status.textContent='Signup is temporarily unavailable. Please try again later.'});
  form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button'),data=new FormData(form);button.disabled=true;const choice=areaChoice({enabled:Boolean(areaToggle&&areaToggle.checked),zip:zipInput?zipInput.value:'',radius});if(choice.error){status.textContent=choice.error;button.disabled=false;return}status.textContent='Sending your confirmation email…';try{const d=await post(buildSubscribePayload({email:data.get('email'),categories:data.getAll('categories'),seasons:data.getAll('seasons'),consent:data.has('consent'),website:data.get('website'),area:choice.area}));status.textContent=d.message+(choice.area?' Your area choice: '+describeArea(choice.area)+'.':'');form.hidden=true}catch(e){status.textContent=e.message}finally{button.disabled=false}});
 }
 if(typeof module!=='undefined')module.exports={RADII,parseZipInput,areaChoice,buildSubscribePayload,describeArea};
})();
