// 1A Phase C: card photo/flyer flips (spec 8.4/8.5).
// - Listing cards render their spec anatomy in app.js without any photo
//   knowledge; this module watches the per-session photo index from
//   photos-ui.js (hfPhotoHas/hfPhotoURL) and upgrades cards that have an
//   approved photo: the name becomes a flip trigger, a "↻ Photo" pill appears,
//   and the front rows get wrapped in a Y-flip structure with a photo back.
// - Event cards (layout.js) already render their flip scaffolding when a flyer
//   URL exists; the same delegated toggler handles both card kinds.
// Loaded after layout.js and photos-ui.js.

function flyerURLForEvent(x){return x&&typeof x==='object'?(x.flyer||x.photo||null):null}

if(typeof module!=='undefined')module.exports={flyerURLForEvent};

if(typeof document==='undefined'){/* Node (tests): pure helpers only. */}
else{(function(){
'use strict';
const cardList=document.getElementById('cardList');
if(!cardList)return;

function toggleFlip(card){
  if(!card)return;
  card.classList.toggle('is-flipped');
  const flipped=card.classList.contains('is-flipped');
  const front=card.querySelector('.card-face--front'),back=card.querySelector('.card-face--back');
  if(front)front.setAttribute('aria-hidden',String(flipped));
  if(back)back.setAttribute('aria-hidden',String(!flipped));
  card.querySelectorAll('[data-flip-open]').forEach(b=>b.setAttribute('aria-pressed',String(flipped)));
}

cardList.addEventListener('click',e=>{
  const opener=e.target.closest('[data-flip-open]');
  if(opener){toggleFlip(opener.closest('.card'));return}
  const closer=e.target.closest('[data-flip-close]');
  if(closer){toggleFlip(closer.closest('.card'));return}
  const share=e.target.closest('[data-share-event]');
  if(share){shareEvent(share.dataset.shareEvent);return}
});

function shareEvent(id){
  const ev=typeof events!=='undefined'?events.find(x=>x.id===id):null;
  if(!ev)return;
  const url=location.origin+location.pathname+'?category=events&event='+encodeURIComponent(id);
  const payload={title:ev.name,text:`${ev.name} — ${ev.venue||ev.address}`.trim(),url};
  if(navigator.share)navigator.share(payload).catch(()=>{});
  else if(navigator.clipboard)navigator.clipboard.writeText(url).catch(()=>{});
}

// Upgrade one listing card to a photo flip card. Idempotent per render.
window.hfPaintCardFlip=function(num){
  if(typeof hfPhotoHas!=='function'||!hfPhotoHas(num))return;
  const card=cardList.querySelector(`[data-card="${num}"]`);
  if(!card||card.dataset.flipReady)return;
  card.dataset.flipReady='1';
  card.classList.add('card--flip');
  const nameEl=card.querySelector('.card__name');
  const nameText=nameEl?nameEl.textContent.trim():('Listing '+num);
  if(nameEl){
    const nameBtn=document.createElement('button');
    nameBtn.type='button';
    nameBtn.className='card__namebtn';
    nameBtn.dataset.flipOpen=String(num);
    nameBtn.setAttribute('aria-pressed','false');
    nameBtn.setAttribute('aria-label','Show the photo for '+nameText);
    nameBtn.textContent=nameText;
    nameEl.replaceChildren(nameBtn);
    const pill=document.createElement('button');
    pill.type='button';
    pill.className='card__photo-pill';
    pill.dataset.flipOpen=String(num);
    pill.setAttribute('aria-pressed','false');
    pill.textContent='↻ Photo';
    nameEl.after(pill);
  }
  const town=card.dataset.town||'',dist=card.querySelector('.card__distance');
  const subline=[town,dist&&dist.textContent].filter(Boolean).join(' · ');
  const back=document.createElement('div');
  back.className='card-face card-face--back';
  back.setAttribute('aria-hidden','true');
  const img=document.createElement('img');
  img.className='card__photo';
  img.src=hfPhotoURL(num);
  img.alt='Host photo for listing '+num;
  img.loading='lazy';
  img.decoding='async';
  const bar=document.createElement('div');
  bar.className='card__back-bar';
  const meta=document.createElement('div');
  meta.className='card__back-meta';
  const strong=document.createElement('strong');
  strong.textContent=nameText;
  meta.appendChild(strong);
  if(subline){const span=document.createElement('span');span.textContent=subline;meta.appendChild(span)}
  const details=document.createElement('button');
  details.type='button';
  details.className='btn card__details-btn';
  details.dataset.flipClose=String(num);
  details.textContent='↻ Details';
  bar.append(meta,details);
  back.append(img,bar);
  const front=document.createElement('div');
  front.className='card-face card-face--front';
  const inner=document.createElement('div');
  inner.className='card-flip__inner';
  while(card.firstChild)front.appendChild(card.firstChild);
  inner.append(front,back);
  const wrap=document.createElement('div');
  wrap.className='card-flip';
  wrap.appendChild(inner);
  card.appendChild(wrap);
};

// Re-apply upgrades after every card re-render (filter changes, pagination).
new MutationObserver(()=>{
  if(typeof hfPhotoHas!=='function')return;
  cardList.querySelectorAll('[data-card]:not([data-flip-ready])').forEach(el=>{
    const n=+el.dataset.card;
    if(Number.isFinite(n)&&hfPhotoHas(n))window.hfPaintCardFlip(n);
  });
}).observe(cardList,{childList:true});
})();}
