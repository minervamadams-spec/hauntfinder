(() => {
 const dialog=document.getElementById('alertsDialog'),frame=dialog.querySelector('iframe');
 const SEEN_KEY='hf_alerts_seen';
 let opener;
 // Load the signup frame eagerly at page init, not at dialog-open time:
 // setting src inside a freshly-shown <dialog> raced the frame's first paint
 // in Chrome and left the dialog blank.
 frame.src='/alerts.html?embed=1';
 const markSeen=()=>{try{localStorage.setItem(SEEN_KEY,'1')}catch{}};
 const hasSeen=()=>{try{return localStorage.getItem(SEEN_KEY)==='1'}catch{return true}};
 function open(from){opener=from||null;markSeen();dialog.showModal()}
 function close(){dialog.close();opener?.focus()}
 document.querySelectorAll('[data-alerts-link]').forEach(link=>link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  open(link);
 }));
 // Any close — × button, Esc, scrim, Not now, or the iframe's own
 // confirmation — counts as seen, so the first-visit popup never repeats.
 dialog.addEventListener('close',()=>{markSeen();opener?.focus()});
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data==='close-alerts')close()});
 document.getElementById('alertsSubscribeBtn').addEventListener('click',()=>{
  try{frame.contentWindow.focus()}
  catch(e){window.open('/alerts.html','_blank','noopener')}
 });
 document.getElementById('alertsNotNowBtn').addEventListener('click',()=>close());
 fetch('/api/subscriptions').then(r=>r.json()).then(d=>{
  if(!d.available)return;
  document.querySelectorAll('[data-alerts-link]').forEach(x=>{x.hidden=false});
  if(new URLSearchParams(location.search).get('src')==='alert'||hasSeen())return;
  // First visit: offer the alert signup once, after a short delay, and never
  // on top of another dialog.
  setTimeout(()=>{
    if(document.querySelector('dialog[open]'))return;
    open(null);
  },2000);
 }).catch(()=>{});
})();
