const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sch=require('../schedules');
const layout=fs.readFileSync(path.join(__dirname,'../layout.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const url=fs.readFileSync(path.join(__dirname,'../url-state.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const noon=new Date('2026-10-17T16:00:00-04:00');
const skully={id:'skullys-costume-closet',ongoing:true,eventType:'Donation drive/Community collection',year:2026};
const buddies={id:'best-buddies',eventType:'Trunk-or-treat',date:'2026-10-29',startAt:'2026-10-29T17:30:00-04:00',endAt:'2026-10-29T19:00:00-04:00'};
const trails={id:'haunted-trails-2026',eventType:'Haunted trail',dates:['2026-10-17','2026-10-23','2026-10-24','2026-10-30'],date:'2026-10-17',startTime:'18:00',endTime:'21:00'};
const events=[skully,buddies,trails];

test('week placement: Oct 17 opens on Oct 11–17 and stops at the last listed date',()=>{
  const bounds=sch.eventWeekBounds(events,noon);
  assert.equal(bounds.today,'2026-10-17');
  assert.equal(bounds.min,'2026-10-11');
  assert.deepEqual(sch.weekDates(bounds.min),['2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17']);
  assert.equal(bounds.max,'2026-10-25','last dated event (Oct 30) keeps Next alive through Halloween week');
  assert.equal(sch.weekRangeLabel(sch.weekDates('2026-10-11')),'Week of Oct 11–17');
  assert.equal(sch.weekRangeLabel(sch.weekDates('2026-10-18')),'Week of Oct 18–24');
  assert.equal(sch.weekRangeLabel(sch.weekDates('2026-10-25')),'Halloween week · Oct 25–31');
  assert.equal(sch.shiftWeek('2026-10-11',-1,bounds),'2026-10-11','Prev cannot leave the current week');
  assert.equal(sch.shiftWeek('2026-10-11',1,bounds),'2026-10-18');
  assert.equal(sch.shiftWeek('2026-10-25',1,bounds),'2026-10-25','Next stops on the week of the last listed event');
  assert.equal(sch.clampWeekStart('2026-09-27',bounds),'2026-10-11','a past week param snaps forward');
  assert.equal(sch.clampWeekStart('2026-10-17',bounds),'2026-10-11','a mid-week param snaps to that Sunday');
});

test('single-date and dates-list events sit on their real days; only ongoing uses the band',()=>{
  assert.deepEqual(sch.eventColumnDates(trails),['2026-10-17','2026-10-23','2026-10-24','2026-10-30']);
  assert.deepEqual(sch.eventColumnDates(buddies),['2026-10-29']);
  assert.deepEqual(sch.eventColumnDates({eventType:'Parade',date:'2026-10-17'}),['2026-10-17']);
  assert.deepEqual(sch.eventColumnDates(skully),[],'ongoing listings are not placed in a day column');
  assert.equal(sch.ongoingCoversWeek(skully,sch.weekDates('2026-10-11')),true);
  assert.equal(sch.ongoingCoversWeek(skully,sch.weekDates('2026-10-18')),true);
  assert.equal(sch.ongoingCoversWeek(skully,sch.weekDates('2026-10-25')),true);
  assert.equal(sch.ongoingCoversWeek(trails,sch.weekDates('2026-10-11')),false,'a dates list is not an open-all-week listing');
  const weekOf=iso=>sch.weekDates(sch.weekSunday(iso));
  for(const day of trails.dates){
    assert.ok(weekOf(day).includes(day),day+' stays inside its own week');
    assert.equal(sch.eventColumnDates(trails).includes(day),true);
  }
});

test('three-day window is today and the next two days, even across a week boundary',()=>{
  assert.deepEqual(sch.threeDayDates(noon),['2026-10-17','2026-10-18','2026-10-19']);
});

test('Oct 31 tint, Today marker, and type color are not decided by the week',()=>{
  assert.equal(sch.isOct31('2026-10-31'),true);
  assert.equal(sch.isOct31('2026-10-17'),false);
  assert.equal(sch.isOct31('2026-10-24'),false);
  assert.ok(layout.includes("date.slice(5)==='10-31'"),'column tint checks the real October 31');
  assert.equal(layout.includes('date===weekEnd'),false,'Saturday is not treated as Halloween');
  assert.ok(layout.includes('event-col--today'),'today column class');
  assert.ok(layout.includes('>Today</span>'),'Today label');
  assert.ok(css.includes('.event-col--today .event-col__dom{color:var(--purple'),'today date number is purple');
  assert.ok(layout.includes("'Donation drive/Community collection':'#FF6FA8'"),'donation drive stays pink');
  assert.ok(layout.includes(":'#E6B325'"),'a type other than Other does not use the Other teal');
  assert.ok(layout.includes("x.eventType==='Other'?'#3FD0C0':'#E6B325'"),'unknown types do not fall back to the Other teal');
  assert.ok(layout.includes('${safeListingText(townOf(x))} · ${safeListingText(x.eventType)}'),'chip meta prints the stored type');
  assert.ok(layout.includes("{label:'Donation drive',value:'Donation drive/Community collection'}"),'legend includes Donation drive');
  assert.equal(layout.includes('Other dates'),false);
});

test('week and day travel in the URL and week nav is wired',()=>{
  assert.ok(html.includes('id="prevWeek"'),'Prev week control');
  assert.ok(html.includes('id="thisWeek"'),'This week control');
  assert.ok(html.includes('id="nextWeek"'),'Next week control');
  assert.ok(html.includes('id="allEventDays"'),'All week still clears the day');
  assert.ok(layout.includes("$('prevWeek').disabled"),'Prev can be disabled');
  assert.ok(layout.includes("$('nextWeek').disabled"),'Next can be disabled');
  assert.ok(layout.includes("params.get('week')"),'week param is read');
  assert.ok(layout.includes('clampWeekStart'),'week param is clamped to the allowed range');
  assert.ok(layout.includes("const dayParam=params.get('day')"));
  assert.ok(layout.includes("if(week.includes(date))state.eventDay=date"));
  assert.ok(url.includes("'week'"),'week is an owned URL key');
  assert.ok(url.includes("u.searchParams.set('week',state.eventWeek)"));
  assert.ok(url.includes("u.searchParams.set('day',String(+state.eventDay.slice(8,10)))"));
  assert.ok(layout.includes('matchingEvents(true)'),'calendar export is not limited to the day or week on screen');
});
