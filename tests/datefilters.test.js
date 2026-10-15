const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sch=require('../schedules');
const loc=require('../location');
function appData(){const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];return vm.runInNewContext(code+';({listings,inCurrentSeason})')}
function mockStorage(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),_map:m}}
// Fixed "now": Friday 2026-10-30, 7:30 PM local.
const NOW=new Date('2026-10-30T19:30:00');
const openNow={num:1,schedule:{weekly:[{dow:5,open:'18:00',close:'23:00'}]}};
test('Tonight keeps only listings open right now; unknown hours are excluded, not guessed',()=>{
 assert.equal(sch.schedulesDateMatch(openNow,{kind:'tonight'},NOW),true);
 assert.equal(sch.schedulesDateMatch({num:2,schedule:{weekly:[{dow:5,open:'20:00',close:'23:00'}]}},{kind:'tonight'},NOW),false,'before open');
 assert.equal(sch.schedulesDateMatch({num:3,schedule:{weekly:[{dow:5,open:'18:00'}],exceptions:[{date:'2026-10-30',closed:true}]}},{kind:'tonight'},NOW),false,'closed exception');
 assert.equal(sch.schedulesDateMatch({num:4},{kind:'tonight'},NOW),false,'no schedule at all');
 assert.equal(sch.schedulesDateMatch({num:5,schedule:{startDate:'2026-10-01'}},{kind:'tonight'},NOW),false,'date-only schedule has no hours tonight');
 assert.equal(sch.schedulesDateMatch({num:6,schedule:{weekly:[{dow:6,open:'18:00'}]}},{kind:'tonight'},NOW),false,'open tomorrow, not tonight');
});
test('This weekend resolves the coming Sat/Sun pair and catches either day',()=>{
 const satOnly={num:1,schedule:{weekly:[{dow:6,open:'18:00'}]}};
 const sunOnly={num:2,schedule:{weekly:[{dow:0,open:'18:00'}]}};
 const monOnly={num:3,schedule:{weekly:[{dow:1,open:'18:00'}]}};
 const fri=new Date('2026-10-30T10:00:00');
 assert.deepEqual(sch.nextWeekendDates('2026-10-30'),['2026-10-31','2026-11-01']);
 assert.equal(sch.schedulesDateMatch(satOnly,{kind:'weekend'},fri),true);
 assert.equal(sch.schedulesDateMatch(sunOnly,{kind:'weekend'},fri),true);
 assert.equal(sch.schedulesDateMatch(monOnly,{kind:'weekend'},fri),false);
 const saturday=new Date('2026-10-31T10:00:00');
 assert.deepEqual(sch.nextWeekendDates('2026-10-31'),['2026-10-31','2026-11-01'],'Saturday resolves to the current weekend');
 assert.equal(sch.schedulesDateMatch(satOnly,{kind:'weekend'},saturday),true);
 const sunday=new Date('2026-11-01T10:00:00');
 assert.deepEqual(sch.nextWeekendDates('2026-11-01'),['2026-10-31','2026-11-01'],'Sunday resolves back to the current weekend');
 assert.equal(sch.schedulesDateMatch(monOnly,{kind:'weekend'},sunday),false);
});
test('Choose a date keeps listings with hours on exactly that date',()=>{
 const filter={kind:'date',date:'2026-10-31'};
 assert.equal(sch.schedulesDateMatch({num:1,schedule:{exceptions:[{date:'2026-10-31',open:'16:00',close:'20:00'}]}},filter,NOW),true);
 assert.equal(sch.schedulesDateMatch({num:2,schedule:{weekly:[{dow:6,open:'18:00'}]}},filter,NOW),true,'Halloween 2026 is a Saturday');
 assert.equal(sch.schedulesDateMatch({num:3,schedule:{weekly:[{dow:5,open:'18:00'}]}},filter,NOW),false);
 assert.equal(sch.schedulesDateMatch({num:4},filter,NOW),false);
 assert.equal(sch.schedulesDateMatch({num:5,schedule:{startDate:'2026-10-30',endDate:'2026-10-31'}},filter,NOW),false,'in range but no hours defined');
});
test('date filters AND-compose with feature filters through the real visibleSet',()=>{
 const items=[
  {num:1,features:['Lights'],schedule:{weekly:[{dow:5,open:'18:00',close:'23:00'}]}},
  {num:2,features:['Fog'],schedule:{weekly:[{dow:5,open:'18:00',close:'23:00'}]}},
  {num:3,features:['Lights'],schedule:{weekly:[{dow:6,open:'18:00'}]}},
 ];
 const pred=x=>x.features.includes('Lights')&&sch.schedulesDateMatch(x,{kind:'tonight'},NOW);
 assert.deepEqual(loc.visibleSet({items,search:null,predicate:pred}).map(x=>x.num),[1]);
 const weekendPred=x=>x.features.includes('Lights')&&sch.schedulesDateMatch(x,{kind:'weekend'},NOW);
 assert.deepEqual(loc.visibleSet({items,search:null,predicate:weekendPred}).map(x=>x.num),[3],'Saturday-only listing survives the weekend filter');
});
test('Open tonight badge renders only when the completeness gate passes and the listing is open',()=>{
 const eligibleSet=[{num:1,schedule:{weekly:[{dow:5,open:'18:00',close:'23:00'}]}}];
 assert.equal(sch.openTonightEligible(eligibleSet,'2026-10-30'),true);
 assert.equal(sch.openTonightBadgeHTML(openNow,{eligible:true,now:NOW}),'<span class="card__open-tonight">Open tonight</span>');
 assert.equal(sch.openTonightBadgeHTML(openNow,{eligible:false,now:NOW}),'','gate off: no badge even when open');
 assert.equal(sch.openTonightBadgeHTML({num:9,schedule:{weekly:[{dow:5,open:'20:00'}]}},{eligible:true,now:NOW}),'','closed right now: no badge');
});
test('date filter state persists to hfdate:v1 and coerces bad values',()=>{
 const storage=mockStorage();
 assert.equal(sch.DATE_FILTER_KEY,'hfdate:v1');
 assert.deepEqual(sch.loadDateFilter(storage),{kind:null,date:null});
 assert.deepEqual(sch.saveDateFilter({kind:'tonight'},storage),{kind:'tonight',date:null});
 assert.deepEqual(sch.loadDateFilter(storage),{kind:'tonight',date:null},'kind-only filter round-trips');
 assert.deepEqual(sch.saveDateFilter({kind:'date',date:'2026-10-31'},storage),{kind:'date',date:'2026-10-31'});
 assert.deepEqual(sch.loadDateFilter(storage),{kind:'date',date:'2026-10-31'});
 assert.deepEqual(sch.saveDateFilter({kind:'date',date:'31/10/2026'},storage),{kind:null,date:null},'non-ISO date clears the filter');
 assert.deepEqual(sch.saveDateFilter({kind:'someday'},storage),{kind:null,date:null});
 const broken=mockStorage({'hfdate:v1':'{oops'});
 assert.deepEqual(sch.loadDateFilter(broken),{kind:null,date:null});
});
test('eventDays derives calendar days from real event dates, never hardcoded',()=>{
 assert.deepEqual(sch.eventDays([{date:'2026-10-29'},{date:'2026-10-31'},{date:'2026-10-29'}]),{days:['2026-10-29','2026-10-31'],ongoing:false,label:'Oct 29–Oct 31'});
 assert.deepEqual(sch.eventDays([{date:'2026-10-29'}]),{days:['2026-10-29'],ongoing:false,label:'Oct 29'});
 assert.deepEqual(sch.eventDays([{ongoing:true}]),{days:[],ongoing:true,label:null},'ongoing events are not day buttons');
 assert.deepEqual(sch.eventDays([]),{days:[],ongoing:false,label:null});
 assert.deepEqual(sch.eventDays([{startAt:'2026-10-29T17:30:00-04:00'}]).days,['2026-10-29'],'date falls back to startAt');
 assert.deepEqual(sch.eventDays([{ongoing:true},{date:'2026-10-29'}]).ongoing,true);
});
test('real backfill: Halloween filter selects exactly the listings with hours that day',()=>{
 const {listings,inCurrentSeason}=appData();
 const active=listings.filter(inCurrentSeason);
 const filter={kind:'date',date:'2026-10-31'};
 const openNums=[...active.filter(x=>sch.schedulesDateMatch(x,filter)).map(x=>x.num)];
 assert.deepEqual(openNums,[1,4,5,6,8,10,11,12]);
 const tonightNums=[...active.filter(x=>sch.schedulesDateMatch(x,{kind:'tonight'},NOW)).map(x=>x.num)];
 assert.deepEqual(tonightNums,[4,6,8,10],'#4 lights-on-at-6 counts as open; #1 and #11 are Halloween-only exceptions');
});
