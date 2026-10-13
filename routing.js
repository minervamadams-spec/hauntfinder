// Small, exact shortest open path through at most ten stops, from a fixed origin.
function bestStopOrder(matrix){
 const n=matrix.length-1;if(n<1||n>10)throw new Error('Choose up to 10 stops.');
 const size=1<<n,cost=Array.from({length:size},()=>Array(n).fill(Infinity)),prev=Array.from({length:size},()=>Array(n).fill(-1));
 for(let i=0;i<n;i++)cost[1<<i][i]=Number.isFinite(matrix[0][i+1])?matrix[0][i+1]:Infinity;
 for(let mask=1;mask<size;mask++)for(let i=0;i<n;i++)if(mask&(1<<i))for(let j=0;j<n;j++)if(!(mask&(1<<j))&&Number.isFinite(matrix[i+1][j+1])){const next=mask|(1<<j),v=cost[mask][i]+matrix[i+1][j+1];if(v<cost[next][j]){cost[next][j]=v;prev[next][j]=i}}
 let mask=size-1,last=cost[mask].indexOf(Math.min(...cost[mask]));if(!Number.isFinite(cost[mask][last]))throw new Error('No complete driving route found.');const result=[];while(mask){result.unshift(last);const p=prev[mask][last];mask^=1<<last;last=p}return result;
}
// Slot-identity helpers. Deep links are entity-gated and reviews are
// namespaced only for slots REUSED IN PLACE: a former published entity
// occupied the number before the current one. For Halloween 2026 that is
// recorded in REUSED_SLOTS_2026 (slot 8: Skully's display was replaced by
// Drakestown Road; docs/update-workflow.md). #11 was a fresh allocation with
// its own entityId, keeps its plain review key and ungated deep links, and
// its entityId still anchors cross-season identity. Other seasons follow the
// generic convention: any entityId outside the legacy form marks a reuse.
const REUSED_SLOTS_2026={8:'drakestown-road-2026'};
function legacyEntityId(num){return 'hauntfinder:2026:listing:'+num+':original'}
function isReusedSlot(listing){
 if(!listing)return false;
 const season=listing.season||'halloween',year=Number(listing.year||2026);
 if(season==='halloween'&&year===2026)return Boolean(listing.entityId)&&REUSED_SLOTS_2026[listing.num]===listing.entityId;
 return Boolean(listing.entityId)&&listing.entityId!==legacyEntityId(listing.num);
}
// Route entries are {num, entityId}. migrateRoute accepts the legacy saved
// formats (a JSON array of plain numbers, possibly mixed with new-format
// objects and garbage) and returns verified entries against the current
// listings: unknown numbers, placeholders and entity mismatches are dropped,
// never silently kept; order is preserved and numbers deduped.
// legacyEntityMap holds old hfentity:n values still on a device; a legacy
// number saved for a slot whose recorded entity no longer matches is dropped.
function migrateRoute(saved,listings,legacyEntityMap){
 const byNum=new Map(listings.map(x=>[x.num,x])),seen=new Set(),out=[];
 const consider=entry=>{
  let num,entityId;
  if(typeof entry==='number'||typeof entry==='string'){num=+entry}
  else if(entry&&typeof entry==='object'){num=+entry.num;entityId=entry.entityId}
  if(!Number.isInteger(num)||seen.has(num))return;
  const listing=byNum.get(num);
  if(!listing||listing.placeholder)return;
  if(legacyEntityMap&&Object.prototype.hasOwnProperty.call(legacyEntityMap,num)&&legacyEntityMap[num]!==listing.entityId)return;
  if(entityId!==undefined&&entityId!==listing.entityId)return;
  seen.add(num);out.push({num,entityId:listing.entityId});
 };
 try{const parsed=typeof saved==='string'?JSON.parse(saved):saved;if(Array.isArray(parsed))parsed.forEach(consider)}catch{}
 return out;
}
function moveRouteStop(id,direction){if(state.optimizing)return;const i=state.route.findIndex(r=>r.num===id),j=i+direction;if(i<0||j<0||j>=state.route.length)return;[state.route[i],state.route[j]]=[state.route[j],state.route[i]];state.routeMessage='Stop order updated.';try{localStorage.setItem('hfroute:2026',JSON.stringify(state.route))}catch{}renderRoute()}
async function optimizeRoute(){
 if(state.optimizing||state.route.length<2)return;const route=[...state.route];state.optimizing=true;state.routeMessage='Suggesting an order…';renderRoute();
 try{
 if(route.length>10)throw new Error('Suggest an order for up to 10 stops at a time.');
 const points=[];for(const stop of route){const house=listings.find(x=>x.num===stop.num);points.push(state.coords[stop.num]||{lat:house.lat,lng:house.lng})}
 const rad=x=>x*Math.PI/180;
 const matrix=points.map(a=>points.map(b=>{const v=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,v)))}));
 const order=bestStopOrder(matrix);if(JSON.stringify(route)!==JSON.stringify(state.route))throw new Error('Your stops changed. Suggest an order again.');state.route=[route[0],...order.map(i=>route[i+1])];try{localStorage.setItem('hfroute:2026',JSON.stringify(state.route))}catch{}state.routeMessage='Suggested by distance, keeping your first stop. Check roads and hours in Google Maps.';
 }catch(e){state.routeMessage=e.message||'Could not suggest an order. Use the arrows.'}finally{state.optimizing=false;renderRoute()}
}
// Favorites are stored entity-aware at hffavs:v1, following the route pattern
// exactly: same verified {num, entityId} entries, same legacy-number migration,
// same drop rules (unknown numbers, placeholders, entity mismatches). They are
// a personal saved-list, entirely separate from route stops (hfroute:2026).
const FAVORITES_KEY='hffavs:v1';
function loadFavorites(saved,listings,legacyEntityMap){return migrateRoute(saved,listings,legacyEntityMap)}
// Pure add/remove for favorites: matching num toggles off; anything else is
// appended at the end. Order is otherwise preserved.
function toggleFavoriteEntry(favs,num,entityId){
 const out=(favs||[]).filter(f=>f.num!==num);
 if(out.length===(favs||[]).length)out.push({num,entityId});
 return out;
}
// Outing deep links (?outing=) carry entity ids only — slot numbers are
// ambiguous on reused slots, so plain nums are never accepted. Each id is
// URI-decoded, mapped back to its listing, and unverified/missing/duplicate
// entries are dropped. Returns the same verified {num, entityId} shape.
function parseOutingParam(str,listings){
 const byEntity=new Map(listings.map(x=>[x.entityId,x])),seen=new Set(),out=[];
 String(str==null?'':str).split(',').forEach(piece=>{
  let id;try{id=decodeURIComponent(String(piece).trim())}catch(e){return}
  if(!id)return;
  const listing=byEntity.get(id);
  if(!listing||listing.placeholder)return;
  if(seen.has(listing.num))return;
  seen.add(listing.num);out.push({num:listing.num,entityId:listing.entityId});
 });
 return out;
}
// Inverse of parseOutingParam: build a shareable ?outing= URL from route stops.
function outingLink(stops,base){
 const root=typeof base==='string'&&base?base:'https://hauntfinder.vercel.app/';
 const ids=(stops||[]).map(s=>encodeURIComponent(s.entityId)).filter(Boolean);
 return root+'?outing='+ids.join(',');
}
if(typeof module!=='undefined')module.exports={bestStopOrder,migrateRoute,isReusedSlot,legacyEntityId,REUSED_SLOTS_2026,FAVORITES_KEY,loadFavorites,toggleFavoriteEntry,parseOutingParam,outingLink};
