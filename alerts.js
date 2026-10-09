(() => {
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
 fetch('/api/subscriptions').then(r=>r.json()).then(d=>{form.hidden=!d.available;status.textContent=d.available?'':'Signup is being set up. Please check back soon.'}).catch(()=>{status.textContent='Signup is temporarily unavailable. Please try again later.'});
 form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button'),data=new FormData(form);button.disabled=true;status.textContent='Sending your confirmation email…';try{const d=await post({action:'subscribe',email:data.get('email'),categories:data.getAll('categories'),seasons:data.getAll('seasons'),consent:data.has('consent'),website:data.get('website')});status.textContent=d.message;form.hidden=true}catch(e){status.textContent=e.message}finally{button.disabled=false}});
})();
