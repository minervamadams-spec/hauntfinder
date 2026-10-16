// Release 3 increment 2: approved host photos in the listing peek panel.
// renderPeek (app.js) calls loadPeekPhotos after rendering; photos are an
// enhancement — any fetch or render failure leaves the peek untouched.
(function(){
  const lightbox=document.createElement('div');
  lightbox.className='photo-lightbox';
  lightbox.hidden=true;
  lightbox.setAttribute('role','dialog');
  lightbox.setAttribute('aria-label','Enlarged host photo');
  lightbox.innerHTML='<button type="button" class="photo-lightbox__close" aria-label="Close enlarged photo">✕</button><img alt="Enlarged host photo">';
  document.body.appendChild(lightbox);
  const lightboxImg=lightbox.querySelector('img');
  function closeLightbox(){lightbox.hidden=true;lightboxImg.removeAttribute('src')}
  lightbox.addEventListener('click',e=>{if(e.target===lightbox||e.target.closest('.photo-lightbox__close'))closeLightbox()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lightbox.hidden)closeLightbox()});
  // 1A Phase C: per-session photo index. The card photo pill and flip read
  // hfPhotoHas()/hfPhotoURL() synchronously; the index fills in after a lazy
  // per-listing fetch, then hfPaintCardFlip() (card-flip.js) upgrades any
  // on-screen cards. The map peek keeps its own strip via loadPeekPhotos.
  const photoIndex=new Map(),photoRequests=new Map();
  window.hfPhotoHas=num=>photoIndex.has(num);
  window.hfPhotoURL=num=>photoIndex.get(num)||null;
  function rememberPhotos(num,data){
    if(!data||!Array.isArray(data.photos))return;
    const approved=data.photos.filter(p=>p&&p.url);
    if(approved.length)photoIndex.set(num,approved[0].url);
    if(typeof window.hfPaintCardFlip==='function')window.hfPaintCardFlip(num);
  }
  window.hfFetchPhotos=function(num){
    if(photoRequests.has(num))return photoRequests.get(num);
    const request=fetch('/api/photos?num='+num)
      .then(r=>r.ok?r.json():null)
      .then(data=>{rememberPhotos(num,data);return data})
      .catch(()=>null);
    photoRequests.set(num,request);
    return request;
  };
  // Deferred background indexing, mirroring the per-listing feedback fetch in
  // community.js, so pills appear shortly after load without blocking cards.
  setTimeout(()=>{listings.forEach(x=>{if(!x.placeholder)window.hfFetchPhotos(x.num)})},800);
  window.loadPeekPhotos=function(num,listing){
    if(!listing||listing.placeholder)return;
    if(typeof inCurrentSeason==='function'&&!inCurrentSeason(listing))return;
    const peek=document.getElementById('mapPeek');
    if(!peek)return;
    window.hfFetchPhotos(num)
      .then(data=>{
        if(!data||!Array.isArray(data.photos)||!data.photos.length)return;
        if(!peek.querySelector('[data-peek-route="'+num+'"]'))return;
        // K4 popup (1A Phase F): one owner photo fills the 130px slot; without
        // photos the slot stays empty and the section is visually omitted.
        const slot=peek.querySelector('[data-peek-photo]');
        if(!slot)return;
        slot.innerHTML='';
        const img=document.createElement('img');
        img.loading='lazy';
        img.decoding='async';
        img.src=data.photos[0].url;
        img.alt='Photo of '+((peek.querySelector('.map-popup__name')||{}).textContent||(listing&&listing.name)||'this listing');
        const btn=document.createElement('button');
        btn.type='button';btn.className='photo-trigger map-popup__photo-btn';
        const nm=(peek.querySelector('.map-popup__name')||{}).textContent||(listing&&listing.name)||'this listing';
        btn.dataset.name=nm;btn.dataset.sub=((peek.querySelector('.map-popup__meta')||{}).textContent||'').trim();
        btn.setAttribute('aria-label','View larger photo of '+nm);
        const zoom=document.createElement('span');zoom.className='photo-trigger__icon';zoom.setAttribute('aria-hidden','true');zoom.innerHTML=window.hfLightboxIcon||'⤢';
        btn.append(img,zoom);
        slot.appendChild(btn);
      })
      .catch(()=>{});
  };
})();
