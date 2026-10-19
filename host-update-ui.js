// Release 3 increment 3: host update panel. A host arriving at
// /?update=TOKEN sees this panel instead of the map: token check, photo
// upload (direct to Vercel Blob via the increment 1 client-upload flow),
// and a structured update request that lands in the organizer's existing
// review queue. Requires assets/blob-client.js (vendored @vercel/blob
// browser build; regenerate with esbuild if the npm version changes).

// Round 5 (photo never cropped): phone photos carry an EXIF orientation. Re-draw JPEGs
// through a canvas so the stored bytes are upright, and the EXIF block (including GPS) is dropped.
// Long side capped at 2400px to stay well under the 5 MB limit. Other types pass through.
window.hfNormalizePhoto=async function(file){
  try{
    if(!file||file.type!=='image/jpeg'||typeof createImageBitmap!=='function')return file;
    const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
    const scale=Math.min(1,2400/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');if(!ctx)return file;ctx.drawImage(bmp,0,0,w,h);if(bmp.close)bmp.close();
    const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.9));
    if(!blob||!blob.size||blob.size>5*1024*1024)return file;
    return new File([blob],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'});
  }catch{return file}
};

(function(){
  const token=new URLSearchParams(location.search).get('update');
  if(!token)return;
  const escapeHTML=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const overlay=document.createElement('div');
  overlay.className='host-panel';
  document.body.appendChild(overlay);
  document.body.classList.add('host-panel-open');
  function closePanel(){overlay.remove();document.body.classList.remove('host-panel-open');history.replaceState(null,'',location.pathname)}
  function invalid(){overlay.innerHTML=`<div class="host-panel__card" role="alert"><h2>This update link isn't valid</h2><p>It may have been revoked or typed incorrectly. Email <a href="mailto:MTOCommunityFinder@gmail.com">MTOCommunityFinder@gmail.com</a> for a new link.</p><button type="button" class="btn" data-host-close>Back to the map</button></div>`;wireClose()}
  function wireClose(){overlay.querySelector('[data-host-close]').onclick=closePanel}
  function render(listing){
    overlay.innerHTML=`<div class="host-panel__card">
      <h2>Update your listing</h2>
      <p class="host-panel__listing"><strong>${escapeHTML(listing.name)}</strong> · ${escapeHTML(listing.town)}</p>
      <section class="host-panel__section"><h3>Add a photo</h3>
        <p class="form-note">JPEG, PNG, WebP or GIF, up to 5 MB. Your photo goes live right away.</p>
        <input type="file" id="hostPhotoInput" accept="image/jpeg,image/png,image/webp,image/gif">
        <div id="hostPhotoPreview" class="host-photo-preview" hidden><img alt="Preview of your photo as visitors will see it"><button type="button" class="btn btn--outline" id="hostPhotoChange">Choose a different photo</button><button type="button" class="btn" id="hostPhotoBtn">Post photo</button></div>
        <p class="host-panel__status" id="hostPhotoStatus" role="status"></p>
        <div id="hostCurrentPhotos" class="host-current-photos"></div>
      </section>
      <section class="host-panel__section"><h3>Request a listing update</h3>
        <p class="form-note">Dates, hours, description or closures. The organizer reviews every change before it goes live.</p>
        <label for="hostDates">Dates</label><input id="hostDates" maxlength="300" placeholder="e.g. Oct 28–31">
        <label for="hostHours">Hours</label><input id="hostHours" maxlength="300" placeholder="e.g. 6–10 PM nightly">
        <label for="hostDetails">Description / visitor details</label><textarea id="hostDetails" rows="4" maxlength="1500"></textarea>
        <label for="hostClosures">Closures</label><input id="hostClosures" maxlength="500" placeholder="Rain dates, cancellations…">
        <label for="hostEmail">Your email <span class="form-note">(optional — so we can tell you when updates are approved)</span></label><input id="hostEmail" type="email" maxlength="120">
        <button type="button" class="btn" id="hostUpdateBtn">Send update request</button>
        <p class="host-panel__status" id="hostUpdateStatus" role="status"></p>
      </section>
      <button type="button" class="btn btn--outline" data-host-close>Back to the map</button>
    </div>`;
    wireClose();
    const photoStatus=document.getElementById('hostPhotoStatus');
    const input=document.getElementById('hostPhotoInput'),preview=document.getElementById('hostPhotoPreview'),previewImage=preview.querySelector('img');let normalized=null,previewUrl=null;
    const clearPreview=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;normalized=null;preview.hidden=true;input.value=''};
    input.onchange=async()=>{const file=input.files[0];photoStatus.textContent='';clearPreview();if(!file)return;if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){photoStatus.textContent=file.type==='image/heic'?'Your browser could not prepare this HEIC photo. Please choose a JPEG or PNG.':'Please choose a JPEG, PNG, WebP or GIF photo.';return}try{normalized=await hfNormalizePhoto(file);if(normalized.size>5*1024*1024){photoStatus.textContent='This photo is over 5 MB after preparation. Please choose a smaller image.';return}previewUrl=URL.createObjectURL(normalized);previewImage.src=previewUrl;preview.hidden=false;}catch{photoStatus.textContent='This photo could not be prepared. Please choose a JPEG or PNG.'}};
    document.getElementById('hostPhotoChange').onclick=clearPreview;
    document.getElementById('hostPhotoBtn').onclick=async()=>{
      const file=normalized;
      photoStatus.textContent='';
      if(!file){photoStatus.textContent='Please choose a photo first.';return}
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){photoStatus.textContent='Please choose a JPEG, PNG, WebP or GIF photo.';return}
      if(file.size>5*1024*1024){photoStatus.textContent='Please choose a photo under 5 MB.';return}
      if(typeof HFBlob==='undefined'||!HFBlob.upload){photoStatus.textContent='Photo upload is unavailable right now.';return}
      photoStatus.textContent='Uploading…';
      try{
        await HFBlob.upload('host-photos/'+listing.num+'/'+Date.now()+'-'+file.name.replace(/[^\w.-]+/g,'-'),file,{access:'public',contentType:file.type,handleUploadUrl:'/api/upload',clientPayload:JSON.stringify({listingNum:listing.num,contentType:file.type,token})});
        photoStatus.textContent='Thanks! Your photo is live. It can take up to a minute to show on the site.';
        clearPreview();loadOwned();
      }catch(e){photoStatus.textContent='Upload failed — please try again.'}
    };
    async function loadOwned(){const box=document.getElementById('hostCurrentPhotos');try{const data=await fetch('/api/photo-manage?listingNum='+listing.num+'&token='+encodeURIComponent(token)).then(r=>r.ok?r.json():{photos:[]});box.innerHTML=(data.photos||[]).map(p=>`<figure><img src="${escapeHTML(p.url)}" alt="Your posted listing photo"><button class="btn btn--outline" type="button" data-remove="${escapeHTML(p.id)}">Remove my photo</button></figure>`).join('');box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{await fetch('/api/photo-manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingNum:listing.num,id:b.dataset.remove,token})});loadOwned()})}catch{box.textContent=''} }loadOwned();
    const updateStatus=document.getElementById('hostUpdateStatus');
    document.getElementById('hostUpdateBtn').onclick=async()=>{
      updateStatus.textContent='';
      const payload={token,dates:document.getElementById('hostDates').value,hours:document.getElementById('hostHours').value,details:document.getElementById('hostDetails').value,closures:document.getElementById('hostClosures').value,email:document.getElementById('hostEmail').value};
      try{
        const response=await fetch('/api/host-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data=await response.json().catch(()=>({}));
        if(!response.ok){updateStatus.textContent=data.error||'Please try again.';return}
        updateStatus.textContent='Thanks — the organizer will review your update.';
        for(const id of ['hostDates','hostHours','hostDetails','hostClosures'])document.getElementById(id).value='';
      }catch{updateStatus.textContent='Please try again.'}
    };
  }
  fetch('/api/host-link?token='+encodeURIComponent(token)).then(r=>r.ok?r.json():null).then(data=>{if(data&&data.valid)render(data);else invalid()}).catch(invalid);
})();
