// Small, exact shortest open path through at most ten stops, from a fixed origin.
function bestStopOrder(matrix){
 const n=matrix.length-1;if(n<1||n>10)throw new Error('Choose up to 10 stops.');
 const size=1<<n,cost=Array.from({length:size},()=>Array(n).fill(Infinity)),prev=Array.from({length:size},()=>Array(n).fill(-1));
 for(let i=0;i<n;i++)cost[1<<i][i]=Number.isFinite(matrix[0][i+1])?matrix[0][i+1]:Infinity;
 for(let mask=1;mask<size;mask++)for(let i=0;i<n;i++)if(mask&(1<<i))for(let j=0;j<n;j++)if(!(mask&(1<<j))&&Number.isFinite(matrix[i+1][j+1])){const next=mask|(1<<j),v=cost[mask][i]+matrix[i+1][j+1];if(v<cost[next][j]){cost[next][j]=v;prev[next][j]=i}}
 let mask=size-1,last=cost[mask].indexOf(Math.min(...cost[mask]));if(!Number.isFinite(cost[mask][last]))throw new Error('No complete driving route found.');const result=[];while(mask){result.unshift(last);const p=prev[mask][last];mask^=1<<last;last=p}return result;
}
function moveRouteStop(id,direction){if(state.optimizing)return;const i=state.route.indexOf(id),j=i+direction;if(i<0||j<0||j>=state.route.length)return;[state.route[i],state.route[j]]=[state.route[j],state.route[i]];state.routeMessage='Stop order updated.';try{localStorage.setItem('hfroute:2026',JSON.stringify(state.route))}catch{}renderRoute()}
async function optimizeRoute(){
 if(state.optimizing||state.route.length<2)return;const route=[...state.route];state.optimizing=true;state.routeMessage='Suggesting an order…';renderRoute();
 try{
 if(route.length>10)throw new Error('Suggest an order for up to 10 stops at a time.');
 const points=[];for(const id of route){const house=listings.find(x=>x.num===id);points.push(state.coords[id]||await geocodeAddress(house.address))}
 const rad=x=>x*Math.PI/180;
 const matrix=points.map(a=>points.map(b=>{const v=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,v)))}));
 const order=bestStopOrder(matrix);if(JSON.stringify(route)!==JSON.stringify(state.route))throw new Error('Your stops changed. Suggest an order again.');state.route=[route[0],...order.map(i=>route[i+1])];try{localStorage.setItem('hfroute:2026',JSON.stringify(state.route))}catch{}state.routeMessage='Suggested by distance, keeping your first stop. Check roads and hours in Google Maps.';
 }catch(e){state.routeMessage=e.message||'Could not suggest an order. Use the arrows.'}finally{state.optimizing=false;renderRoute()}
}
if(typeof module!=='undefined')module.exports={bestStopOrder};
