// Shared listing presentation helpers for the homepage cards and /listing.html,
// so a listing's category and hours read the same everywhere. Classic script
// with a Node dual-export like routing.js. Loaded before app.js on the
// homepage (cards render during app.js) and before listing.js on the listing
// page. Pure: no DOM, no storage.
const LISTING_TREAT_KIND='Trick-or-treat stop';
// "6:00 PM–10:00 PM" -> "6–10 PM"; ranges that cross AM/PM keep both markers.
function compactTime(value){return String(value).replace(/:00/g,'').replace(/(\d+)\s*(AM|PM)–(\d+)\s*\2/g,'$1–$3 $2')}
// The singular of the homepage tab a listing lives under.
function listingCategory(x){return x&&x.kind===LISTING_TREAT_KIND?'Treat stop':'Display'}
// Card and detail hours line: dates · compact times, or an honest fallback.
// hasScheduleInfo comes from schedules.js; on the homepage's very first render
// schedules.js has not loaded yet, so the check is made at call time.
function listingHoursText(x){
 // "Halloween weekend" + "All weekend" says the same thing twice: show the dates alone.
 const timesText=x.times?compactTime(x.times):'',repeats=timesText&&x.dates&&/^all\s+weekend$/i.test(timesText.trim())&&/weekend/i.test(x.dates);
 const text=[x.dates,repeats?'':timesText].filter(Boolean).join(' · ');
 if(text)return text;
 const scheduled=typeof hasScheduleInfo==='function'?hasScheduleInfo:(typeof require==='function'?require('./schedules').hasScheduleInfo:null);
 if(scheduled&&scheduled(x))return listingCategory(x)==='Treat stop'?'Candy hours not specified':'Dates and hours not specified';
 return 'Hours not listed';
}
// Event-card feature chips. "Free" comes from the listing only when the event
// is actually free (cost "Free", or a Free feature with no paid cost).
// Haunted Trails is "$12 per person", so it never gets a Free chip.
const EVENT_FEATURE_CHIPS=['Free','Open to all','Registration required','Kid-friendly'];
function eventFeatureChips(x){
 const listed=(x&&Array.isArray(x.features)?x.features:[]).filter(f=>EVENT_FEATURE_CHIPS.includes(f)&&f!=='Free');
 const cost=String(x&&x.cost||'').trim();
 const paid=Boolean(cost)&&!/^free\b/i.test(cost);
 const free=!paid&&(/^free\b/i.test(cost)||(x&&Array.isArray(x.features)&&x.features.includes('Free')));
 return free?['Free'].concat(listed):listed;
}
if(typeof module!=='undefined')module.exports={compactTime,listingCategory,listingHoursText,LISTING_TREAT_KIND,eventFeatureChips};
