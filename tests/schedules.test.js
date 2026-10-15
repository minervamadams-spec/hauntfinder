const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sch=require('../schedules');
function appData(){const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];return vm.runInNewContext(code+';({listings,events,inCurrentSeason})')}
// 2026-10-30 is a Friday (dow 5), 2026-10-31 a Saturday (dow 6), 2026-10-25 a Sunday (dow 0).
const FRI='2026-10-30',SAT='2026-10-31',SUN='2026-10-25';
const WEEKLY={startDate:'2026-10-01',endDate:'2026-10-31',weekly:[{dow:5,open:'18:00',close:'23:00'}]};
test('hoursOn resolves weekly entries, exceptions win, closed and out-of-range are null',()=>{
 assert.deepEqual(sch.hoursOn(WEEKLY,FRI),{open:'18:00',close:'23:00',allDay:false});
 assert.equal(sch.hoursOn(WEEKLY,SAT),null,'no weekly entry for Saturday');
 assert.equal(sch.hoursOn(WEEKLY,'2026-11-02'),null,'after endDate');
 assert.equal(sch.hoursOn(WEEKLY,'2026-09-30'),null,'before startDate');
 assert.equal(sch.hoursOn(null,FRI),null);
 assert.equal(sch.hoursOn({},FRI),null);
 const ex={weekly:[{dow:6,open:'18:00',close:'23:00'}],exceptions:[{date:SAT,open:'16:00',close:'20:00'}]};
 assert.deepEqual(sch.hoursOn(ex,SAT),{open:'16:00',close:'20:00',allDay:false},'exception overrides weekly');
 const closed={weekly:[{dow:6,open:'18:00',close:'23:00'}],exceptions:[{date:SAT,closed:true,note:'Weather'}]};
 assert.equal(sch.hoursOn(closed,SAT),null,'closed exception means closed');
 const openOnly={weekly:[{dow:6,open:'18:00'}]};
 assert.deepEqual(sch.hoursOn(openOnly,SAT),{open:'18:00',close:null,allDay:false},'open-only entry has no close');
 const allDay={exceptions:[{date:SAT}]};
 assert.deepEqual(sch.hoursOn(allDay,SAT),{open:null,close:null,allDay:true},'date-only exception is open, hours unknown');
});
test('datesActive enforces the declared range and is vacuous without one',()=>{
 assert.equal(sch.datesActive({startDate:'2026-10-10'},'2026-10-09'),false);
 assert.equal(sch.datesActive({startDate:'2026-10-10'},'2026-10-10'),true);
 assert.equal(sch.datesActive({endDate:'2026-10-31'},'2026-11-01'),false);
 assert.equal(sch.datesActive({},SAT),true);
 assert.equal(sch.datesActive(null,SAT),true);
 assert.equal(sch.datesActive({},'not-a-date'),false);
});
test('isOpenAt honors windows, 24:00 closes, open-only entries and closed days',()=>{
 assert.equal(sch.isOpenAt(WEEKLY,FRI,'19:00'),true);
 assert.equal(sch.isOpenAt(WEEKLY,FRI,'17:59'),false,'before open');
 assert.equal(sch.isOpenAt(WEEKLY,FRI,'23:01'),false,'after close');
 assert.equal(sch.isOpenAt(WEEKLY,SAT,'19:00'),false,'closed day');
 const midnight={weekly:[{dow:5,open:'18:00',close:'24:00'}]};
 assert.equal(sch.isOpenAt(midnight,FRI,'23:59'),true,'24:00 close runs to end of day');
 assert.equal(sch.isOpenAt(midnight,FRI,'24:00'),true);
 const openOnly={weekly:[{dow:6,open:'18:00'}]};
 assert.equal(sch.isOpenAt(openOnly,SAT,'18:00'),true);
 assert.equal(sch.isOpenAt(openOnly,SAT,'17:59'),false);
 assert.equal(sch.isOpenAt(openOnly,SAT,'23:30'),true,'no known close means still open');
 const allDay={exceptions:[{date:SAT}]};
 assert.equal(sch.isOpenAt(allDay,SAT,'09:00'),true,'open day with unknown hours counts as open');
 assert.equal(sch.isOpenAt({exceptions:[{date:SAT,closed:true}]},SAT,'09:00'),false);
 assert.equal(sch.isOpenAt(null,FRI,'19:00'),false);
});
test('hasScheduleInfo detects any real schedule content',()=>{
 assert.equal(sch.hasScheduleInfo({}),false);
 assert.equal(sch.hasScheduleInfo({schedule:null}),false);
 assert.equal(sch.hasScheduleInfo({schedule:{}}),false);
 assert.equal(sch.hasScheduleInfo({schedule:{weekly:[]}}),false);
 assert.equal(sch.hasScheduleInfo({schedule:{startDate:'2026-10-01'}}),true);
 assert.equal(sch.hasScheduleInfo({schedule:{weekly:[{dow:1,open:'18:00'}]}}),true);
 assert.equal(sch.hasScheduleInfo({schedule:{exceptions:[{date:SAT}]}}),true);
});
test('hoursLabel compacts to shared-AM/PM ranges and falls back to Hours unknown',()=>{
 assert.equal(sch.hoursLabel({exceptions:[{date:SAT,open:'16:00',close:'20:00'}]},SAT),'4–8 PM');
 assert.equal(sch.hoursLabel({weekly:[{dow:5,open:'18:00',close:'24:00'}]},FRI),'6 PM–12 AM');
 assert.equal(sch.hoursLabel({weekly:[{dow:6,open:'18:00'}]},SAT),'from 6 PM');
 assert.equal(sch.hoursLabel({exceptions:[{date:SAT}]},SAT),'Hours unknown');
 assert.equal(sch.hoursLabel(null,SAT),'Hours unknown');
 assert.equal(sch.hoursLabel(WEEKLY,SAT),'Hours unknown','no hours that day');
 assert.equal(sch.openOnDateLabel,sch.hoursLabel);
});
test('openTonightEligible is true for a fully scheduled synthetic set only',()=>{
 const full=[1,2,3].map(n=>({num:n,schedule:{startDate:'2026-10-01',endDate:'2026-10-31',weekly:[{dow:5,open:'18:00',close:'23:00'},{dow:6,open:'18:00',close:'23:00'}]}}));
 assert.equal(sch.openTonightEligible(full,FRI),true);
 const missing=full.concat([{num:4}]);
 assert.equal(sch.openTonightEligible(missing,FRI),false,'one record without schedule info blocks the gate');
 const unknownHours=full.concat([{num:5,schedule:{startDate:'2026-10-01'}}]);
 assert.equal(sch.openTonightEligible(unknownHours,FRI),false,'date-only schedule does not resolve hours');
 const placeholders=full.concat([{num:9,placeholder:true}]);
 assert.equal(sch.openTonightEligible(placeholders,FRI),true,'placeholders are ignored');
});
test('real backfilled listings: Open tonight stays OFF on Halloween 2026',()=>{
 const {listings,inCurrentSeason}=appData();
 const active=listings.filter(inCurrentSeason);
 assert.equal(active.length,13);
 assert.equal(sch.openTonightEligible(active,SAT),false);
});
test('backfill sanity: every active listing is scheduled or honestly unknown; #6 Friday resolves',()=>{
 const {listings,inCurrentSeason}=appData();
 const active=listings.filter(inCurrentSeason);
 for(const x of active){
  const visible=[x.dates,x.times].filter(Boolean).join(' · ');
  assert.ok(sch.hasScheduleInfo(x)||visible.length===0,`#${x.num} needs schedule info or an empty visible join`);
 }
 const three=listings.find(x=>x.num===3);
 assert.equal(three.schedule,undefined,'#3 has no schedule object at all');
 const six=listings.find(x=>x.num===6);
 assert.deepEqual(sch.hoursOn(six.schedule,FRI),{open:'18:00',close:'24:00',allDay:false});
 assert.equal(sch.isOpenAt(six.schedule,FRI,'23:30'),true);
 assert.equal(sch.hoursLabel(six.schedule,FRI),'6 PM–12 AM');
 const one=listings.find(x=>x.num===1);
 assert.equal(sch.hoursLabel(one.schedule,SAT),'4–8 PM','#1 Halloween exception overrides');
 const nine=listings.find(x=>x.num===9);
 assert.equal(sch.hoursLabel(nine.schedule,SAT),'Hours unknown','#9 has a start date but no hours');
});
