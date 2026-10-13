// One storage-key builder. Halloween 2026 keys are the frozen legacy mapping:
// renaming any of them would orphan reviews and resend alerts, so they are
// returned exactly as they exist today. The season-scoped convention
// hauntfinder:{season}:{year}:... applies only to seasons other than
// Halloween 2026. Identity mirrors lib/newsletter.js: entityId when present,
// else the legacy per-slot original-identity form.
function storageKeys({season,year,num,entityId}){
 const suffix=entityId?':'+entityId:'';
 if(season==='halloween'&&Number(year)===2026){
  return {review:'hauntfinder:2026:reviews:'+num+suffix,identity:entityId||'hauntfinder:2026:listing:'+num+':original'};
 }
 return {review:`hauntfinder:${season}:${year}:reviews:${num}${suffix}`,identity:`hauntfinder:${season}:${year}:listing:${num}${suffix}`};
}
if(typeof module!=='undefined')module.exports={storageKeys};
