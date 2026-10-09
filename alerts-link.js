(() => {
 const dialog=document.getElementById('alertsDialog'),frame=dialog.querySelector('iframe');
 let opener;
 function close(){dialog.close();opener?.focus()}
 document.querySelectorAll('[data-alerts-link]').forEach(link=>link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();opener=link;
  if(!frame.getAttribute('src'))frame.src='/alerts.html?embed=1';
  dialog.showModal();
 }));
 dialog.querySelector('button').addEventListener('click',close);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close()}});
 dialog.addEventListener('close',()=>opener?.focus());
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data==='close-alerts')close()});
 fetch('/api/subscriptions').then(r=>r.json()).then(d=>{if(d.available)document.querySelectorAll('[data-alerts-link]').forEach(x=>{x.hidden=false})}).catch(()=>{});
})();
