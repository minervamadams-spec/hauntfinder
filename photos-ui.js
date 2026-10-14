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
  window.loadPeekPhotos=function(num,listing){
    if(!listing||listing.placeholder)return;
    if(typeof inCurrentSeason==='function'&&!inCurrentSeason(listing))return;
    const peek=document.getElementById('mapPeek');
    if(!peek)return;
    fetch('/api/photos?num='+num)
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        if(!data||!Array.isArray(data.photos)||!data.photos.length)return;
        if(!peek.querySelector('[data-peek-route="'+num+'"]'))return;
        peek.querySelector('.peek-photos')?.remove();
        const strip=document.createElement('div');
        strip.className='peek-photos';
        for(const photo of data.photos){
          const button=document.createElement('button');
          button.type='button';
          button.className='peek-photos__thumb';
          button.setAttribute('aria-label','View host photo larger');
          const img=document.createElement('img');
          img.loading='lazy';
          img.src=photo.url;
          img.alt='Host photo for listing '+num;
          button.appendChild(img);
          button.onclick=()=>{lightboxImg.src=photo.url;lightbox.hidden=false};
          strip.appendChild(button);
        }
        peek.appendChild(strip);
      })
      .catch(()=>{});
  };
})();
