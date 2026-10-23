const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sch=require('../schedules');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const layout=fs.readFileSync(path.join(__dirname,'../layout.js'),'utf8');
const ids=rows=>rows.map(x=>x.id);
const today7={id:'today-7pm',date:'2026-10-23',startAt:'2026-10-23T19:00:00-04:00'};
const tomorrow10={id:'tomorrow-10am',date:'2026-10-24',startAt:'2026-10-24T10:00:00-04:00'};
const today10={id:'today-10am',date:'2026-10-23',startAt:'2026-10-23T10:00:00-04:00'};
const todayAllDay={id:'today-all-day',date:'2026-10-23'};
const ongoing={id:'ongoing',ongoing:true,hours:'Weekdays 5:00 PM–8:00 PM'};
const trails={id:'trails',date:'2026-10-17',startAt:'2026-10-17T18:00:00-04:00',dates:['2026-10-17','2026-10-24']};

test('events sort by startAt across days and by clock within a day',()=>{
  const across=[tomorrow10,today7,today10];
  assert.deepEqual(ids(sch.sortEventsByStart(across)),['today-10am','today-7pm','tomorrow-10am'],'today 7PM stays before tomorrow 10AM, and 10AM before 7PM the same day');
  assert.deepEqual(ids(across),['tomorrow-10am','today-7pm','today-10am'],'sorting does not reorder the caller list');
  assert.deepEqual(ids(sch.sortEventsByStart([today7,today10,todayAllDay,ongoing],'2026-10-23')),['today-all-day','ongoing','today-10am','today-7pm'],'all-day and ongoing lead the day, then 10AM before 7PM');
  assert.deepEqual(ids(sch.sortEventsByStart([trails,tomorrow10],'2026-10-24')),['tomorrow-10am','trails'],'a later column uses the start clock, not the first startAt date');
});

test('startAt wins and a bare date is an all-day fallback',()=>{
  const datedOnly={id:'dated',date:'2026-10-24'};
  const startWins={id:'start-wins',date:'2026-10-25',startAt:'2026-10-23T19:00:00-04:00'};
  assert.deepEqual(ids(sch.sortEventsByStart([datedOnly,startWins,tomorrow10])),['start-wins','dated','tomorrow-10am'],'startAt orders the event; a date-only event is all-day on that date');
  assert.deepEqual(sch.eventStartParts(datedOnly),{date:'2026-10-24',time:null,allDay:true,ongoing:false});
  assert.deepEqual(sch.eventStartParts(today10).time,'10:00');
});

test('the events list and week columns render in that order',()=>{
  assert.match(app,/return typeof sortEventsByStart==='function'\?sortEventsByStart\(filtered,day\)/,'matchingEvents sorts the list by start time');
  assert.match(layout,/const onDaySorted=date=>typeof sortEventsByStart==='function'\?sortEventsByStart\(/,'week and mobile day columns sort within the day');
  assert.equal((layout.match(/onDaySorted\(date\)/g)||[]).length,2,'desktop chips and the mobile day list both use the day sort');
  assert.match(layout,/items=sortEventsByStart\(items,state\.eventDay\|\|''\)/,'the card list sorts across days, and within the selected day');
});
