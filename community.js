const feedbackDialog=document.getElementById('feedbackDialog');
const feedbackForm=document.getElementById('feedbackForm');
let feedbackHouseId=null,feedbackRequest=null;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function crowIcon(){return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M12 34 3 43l12-3 4-6c4 3 10 2 13-2 3-4 3-10 1-15l-1-4 12-2-12-4c-2-5-9-6-13-2-2 2-2 5-2 8-5 5-8 12-5 21Z"/><path d="m18 18 8 4-7 10m3 3-1 8m8-9 1 9M17 44h9m1 0h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m18 18 8 4-7 10" fill="none" stroke="#0B0910" stroke-width="1.5" stroke-linecap="round"/><circle cx="27" cy="8" r="1.3" fill="#0B0910"/></svg>'}
document.getElementById('crowChoices').innerHTML=[1,2,3,4,5].map(n=>`<label class="crow-choice"><input type="radio" name="rating" value="${n}" required aria-label="${n} crow${n===1?'':'s'}"><span>${crowIcon()}<b>${n}</b></span></label>`).join('');
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('.site-dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}));
feedbackDialog.addEventListener('close',()=>feedbackRequest?.abort());
document.getElementById('cardList').addEventListener('click',e=>{const b=e.target.closest('[data-feedback]');if(b)openFeedback(+b.dataset.feedback)});
document.getElementById('mobileMapRouteBtn').onclick=buildRoute;
function displayFeedback(data){
  const reviews=data.reviews||[];
  const average=reviews.length?(reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length).toFixed(1):null;
  document.getElementById('feedbackStatus').textContent=reviews.length?`${average} / 5 crows · ${reviews.length} visitor review${reviews.length===1?'':'s'} (latest first)`:'No feedback yet. Be the first to share your visit.';
  document.getElementById('feedbackList').innerHTML=reviews.map(r=>`<article class="visitor-review"><div class="review-meta"><strong>${escapeHTML(r.name)}</strong><span aria-label="${r.rating} out of 5 crows" class="review-crows">${Array.from({length:5},(_,i)=>`<span class="${i<r.rating?'is-filled':''}">${crowIcon()}</span>`).join('')}</span></div><time datetime="${escapeHTML(r.timestamp)}">${escapeHTML(new Date(r.timestamp).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}))}</time><p>${escapeHTML(r.comment)}</p><a class="review-report" href="mailto:minervamadams@gmail.com?subject=${encodeURIComponent('Haunt Finder feedback report: '+r.id)}">Report this feedback</a></article>`).join('');
}
async function openFeedback(id){
  const house=listings.find(x=>x.num===id);if(!house)return;
  feedbackRequest?.abort();feedbackRequest=new AbortController();feedbackHouseId=id;
  document.getElementById('feedbackHouse').textContent=house.name+' · '+house.town;
  document.getElementById('feedbackList').replaceChildren();
  document.getElementById('feedbackStatus').textContent='Loading visitor feedback…';
  document.getElementById('feedbackFormStatus').textContent='';feedbackForm.reset();
  document.getElementById('feedbackSubmit').disabled=true;feedbackDialog.showModal();
  try{
    const response=await fetch('/api/feedback?house='+id,{signal:feedbackRequest.signal});
    const data=await response.json();if(id!==feedbackHouseId)return;
    if(!response.ok)throw new Error(data.error||'Feedback is temporarily unavailable. Please try again later.');
    displayFeedback(data);document.getElementById('feedbackSubmit').disabled=false;
  }catch(e){if(e.name!=='AbortError')document.getElementById('feedbackStatus').textContent=e.message.startsWith('Feedback')?e.message:'Feedback is temporarily unavailable. Please try again later.'}
}
feedbackForm.addEventListener('submit',async e=>{
  e.preventDefault();if(!feedbackForm.reportValidity())return;
  const button=document.getElementById('feedbackSubmit'),status=document.getElementById('feedbackFormStatus');
  const id=feedbackHouseId,form=new FormData(feedbackForm);
  button.disabled=true;status.textContent='Posting your feedback…';
  try{
    const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({house:id,name:form.get('name'),rating:Number(form.get('rating')),comment:form.get('comment'),website:form.get('website')})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Your feedback was not saved. Please try again.');
    if(feedbackHouseId===id&&feedbackDialog.open){displayFeedback(data);feedbackForm.reset();status.textContent='Your feedback is posted. Thank you for visiting!'}
  }catch(e){if(feedbackHouseId===id)status.textContent=e.message.startsWith('Feedback')||e.message.startsWith('Please')?e.message:'Your feedback was not saved. Please try again.'}
  finally{if(feedbackHouseId===id)button.disabled=false}
});
document.getElementById('aboutBtn').onclick=()=>document.getElementById('aboutDialog').showModal();
document.getElementById('flyersBtn').onclick=()=>{
  document.getElementById('printGuide').innerHTML=`<h2>Mount Olive &amp; Surrounding Area</h2><h3>Halloween Display &amp; Haunt Finder 2026</h3><p>Updated house list · hauntfinder.vercel.app · Printed ${escapeHTML(new Date().toLocaleDateString())}</p>${listings.map(x=>`<article><h3>${x.num}. ${escapeHTML(x.name)}</h3><p>${escapeHTML(x.address)}</p><p>${escapeHTML([x.dates,x.times].filter(Boolean).join(' · ')||'Viewing times not specified')}</p><p>${escapeHTML([...x.levels,...x.type,...x.features].join(' · '))}</p>${x.notes?`<p><strong>Host notes:</strong> ${escapeHTML(x.notes)}</p>`:''}</article>`).join('')}<p>Community guide. This is not a contest. Visit the site for current details.</p>`;
  document.getElementById('flyerDialog').showModal();
};
document.getElementById('printGuideBtn').onclick=()=>{document.body.classList.add('printing-guide');window.print()};
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-guide'));
