// Card ratings: read-only summaries painted onto each card's rating link.
const ratingSummaries=new Map();
function paintRatingSummaries(){document.querySelectorAll('[data-rating-summary]').forEach(b=>{const summary=ratingSummaries.get(+b.dataset.ratingSummary);if(!summary)return;b.innerHTML=summary.count?`<span class="card-rating__stars" aria-hidden="true">★★★★★</span><span class="card-rating__text">${summary.average} · ${summary.count} ratings</span>`:'<span class="card-rating__text">No ratings yet · <span class="card-rating__rate">Rate</span></span>';b.setAttribute('aria-label',summary.count?`${summary.average} out of 5 skeletons, ${summary.count} reviews. Read reviews`:'No ratings yet. Read or write a review')})}
new MutationObserver(paintRatingSummaries).observe(document.getElementById('cardList'),{childList:true});
// One batched, CDN-cached read (/api/feedback?summary=1) feeds every card's rating
// and photo index; photos-ui.js reuses the same promise. A rating this visitor
// just posted (hfrated:v1, written by listing.js) wins over a summary generated
// before it, so their own view is current while the shared cache catches up.
function ownRatings(){try{return JSON.parse(localStorage.getItem('hfrated:v1'))||{}}catch{return {}}}
window.hfSummary=fetch('/api/feedback?summary=1').then(r=>r.ok?r.json():null).catch(()=>null).then(data=>{
  if(!data||typeof data!=='object')return null;
  const own=ownRatings(),made=Date.parse(data.generatedAt)||0;
  listings.forEach(house=>{
    if(house.placeholder)return;
    const mine=own[house.num],shared=data.ratings&&data.ratings[house.num];
    const pick=mine&&Number.isFinite(mine.at)&&mine.at>made?mine:shared;
    ratingSummaries.set(house.num,{count:pick?pick.count:0,average:pick?pick.average:null});
  });
  paintRatingSummaries();
  return data;
});
// Feedback, listing reports and house sharing live on /listing.html (#feedback,
// #report-update, #share; page-first plan steps 3 and 5). The homepage keeps no
// dialogs: card links open those sections. About and submission live at
// /about.html and /submit.html.
// 1A Phase G: Share this site (spec 9.1).
const shareSiteBtn=document.getElementById('shareSiteBtn');
shareSiteBtn.onclick=async()=>{
  const shareData={title:'Hauntfinder',text:'Find Halloween displays, treat stops, and events near you.',url:'https://hauntfinder.vercel.app/'};
  if(navigator.share){try{await navigator.share(shareData);return}catch(e){if(e&&e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(shareData.url);shareSiteBtn.textContent='Link copied';setTimeout(()=>{shareSiteBtn.textContent='Share this site'},3000)}catch{window.prompt('Copy this link:',shareData.url)}
};
