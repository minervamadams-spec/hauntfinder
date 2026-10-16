// Photo lightbox (PHOTO-PORTRAIT-FIX.md, second section; mock panel P6).
// Tapping a listing photo (map popup, card back) opens it full screen: contain, never cropped.
// Closes with x, Esc, a tap outside the photo, or Back (one history entry is pushed on open).
// Mobile: edge to edge, swipe down closes (not while pinch-zoomed), page scroll locked.
// The overlay is created on demand as a div role="dialog" (the homepage keeps no <dialog>).
(function(){
'use strict';
if(typeof document==='undefined')return;
const ICON='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
window.hfLightboxIcon=ICON;
let box=null,trigger=null,openFlag=false,scrollY=0;
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function build(name,sub,url){
  const el=document.createElement('div');
  el.className='lightbox';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Photo of '+name);
  const bar=document.createElement('div');bar.className='lightbox__bar';
  const meta=document.createElement('div');meta.className='lightbox__meta';
  const strong=document.createElement('strong');strong.textContent=name;meta.appendChild(strong);
  if(sub){const span=document.createElement('span');span.textContent=sub;meta.appendChild(span)}
  const close=document.createElement('button');close.type='button';close.className='lightbox__close';close.setAttribute('aria-label','Close photo');close.textContent='×';
  bar.append(meta,close);
  const stage=document.createElement('div');stage.className='lightbox__stage';
  const img=document.createElement('img');img.className='lightbox__img';img.alt='Photo of '+name;img.decoding='async';img.src=url;
  stage.appendChild(img);el.append(bar,stage);
  return el;
}
function teardown(){
  if(!box)return;
  const el=box;box=null;openFlag=false;
  document.removeEventListener('keydown',onKey,true);
  document.documentElement.classList.remove('lightbox-open');
  const done=()=>{el.remove();const t=trigger;trigger=null;if(t&&document.contains(t))t.focus({preventScroll:true})};
  if(reduce()){done()}else{el.classList.remove('is-in');setTimeout(done,150)}
}
function requestClose(){
  if(!box)return;
  if(history.state&&history.state.hfLightbox)history.back();else teardown();
}
function onKey(e){
  if(!box)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();requestClose();return}
  if(e.key==='Tab'){e.preventDefault();const c=box.querySelector('.lightbox__close');if(c)c.focus()}
}
window.addEventListener('popstate',()=>{if(box)teardown()});
function open(url,name,sub,from){
  if(box||!url)return;
  trigger=from||null;
  box=build(name||'Photo',sub||'',url);
  document.body.appendChild(box);
  document.documentElement.classList.add('lightbox-open');
  try{history.pushState({hfLightbox:1},'',location.href)}catch{}
  openFlag=true;
  document.addEventListener('keydown',onKey,true);
  box.addEventListener('click',e=>{
    if(e.target.closest('.lightbox__close')){requestClose();return}
    if(e.target.closest('.lightbox__bar'))return;
    const img=box.querySelector('.lightbox__img');
    if(e.target===img){
      // object-fit:contain leaves dark bars inside the <img> box: only the photo itself keeps it open.
      const r=img.getBoundingClientRect(),nw=img.naturalWidth,nh=img.naturalHeight;
      if(nw&&nh){const s=Math.min(r.width/nw,r.height/nh),w=nw*s,h=nh*s,l=r.left+(r.width-w)/2,tp=r.top+(r.height-h)/2;
        if(e.clientX>=l&&e.clientX<=l+w&&e.clientY>=tp&&e.clientY<=tp+h)return}
    }
    requestClose();
  });
  // swipe down to close (mobile): single finger, not pinch-zoomed, > 80px
  let y0=null,dy=0;
  box.addEventListener('touchstart',e=>{y0=(e.touches.length===1&&!(window.visualViewport&&window.visualViewport.scale>1.02))?e.touches[0].clientY:null;dy=0},{passive:true});
  box.addEventListener('touchmove',e=>{if(y0==null)return;if(e.touches.length!==1){y0=null;box.style.transform='';return}dy=e.touches[0].clientY-y0;if(dy>0)box.style.transform='translateY('+dy+'px)'},{passive:true});
  box.addEventListener('touchend',()=>{if(y0==null)return;const d=dy;y0=null;dy=0;box.style.transform='';if(d>80)requestClose()},{passive:true});
  const closeBtn=box.querySelector('.lightbox__close');
  if(reduce())box.classList.add('is-in');else requestAnimationFrame(()=>box&&box.classList.add('is-in'));
  closeBtn.focus({preventScroll:true});
}
window.hfOpenLightbox=open;
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.photo-trigger');
  if(!b)return;
  e.preventDefault();e.stopPropagation();
  const img=b.querySelector('img');
  open(img&&(img.currentSrc||img.src||img.dataset.src),b.dataset.name,b.dataset.sub,b);
},true);
// Test hook (read-only): is the lightbox open?
window.hfLightboxOpen=()=>openFlag;
})();
