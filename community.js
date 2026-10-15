// Card ratings: read-only summaries painted onto each card's rating link.
const ratingSummaries=new Map();
function paintRatingSummaries(){document.querySelectorAll('[data-rating-summary]').forEach(b=>{const summary=ratingSummaries.get(+b.dataset.ratingSummary);if(!summary)return;b.innerHTML=summary.count?`<span class="card-rating__stars" aria-hidden="true">★★★★★</span><span class="card-rating__text">${summary.average} · ${summary.count} ratings</span>`:'<span class="card-rating__text">No ratings yet · <span class="card-rating__rate">Rate</span></span>';b.setAttribute('aria-label',summary.count?`${summary.average} out of 5 skeletons, ${summary.count} reviews. Read reviews`:'No ratings yet. Read or write a review')})}
function rememberRating(id,data){const reviews=data.reviews||[];ratingSummaries.set(id,{count:reviews.length,average:reviews.length?(reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length).toFixed(1):null});paintRatingSummaries()}
new MutationObserver(paintRatingSummaries).observe(document.getElementById('cardList'),{childList:true});
listings.forEach(async house=>{try{const response=await fetch('/api/feedback?house='+house.num);if(response.ok)rememberRating(house.num,await response.json())}catch{}});
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
