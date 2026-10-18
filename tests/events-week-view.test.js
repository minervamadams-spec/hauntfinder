const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sch=require('../schedules');
const fmt=require('../listing-format');
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

test('a showing listed for today leads the card, even after that day has ended',()=>{
  const late=new Date('2026-10-17T22:30:00-04:00');
  assert.equal(sch.eventCardWhenLine(trails,noon),'Tonight · Sat, Oct 17 · also Oct 23, 24, 30');
  assert.equal(sch.eventCardWhenLine(trails,late),'Tonight · Sat, Oct 17 · also Oct 23, 24, 30','today stays first after 9 PM');
  assert.equal(sch.eventCardWhenLine(trails,new Date('2026-10-18T12:00:00-04:00')),'Next Fri, Oct 23 · also Oct 24, Oct 30');
  assert.equal(sch.eventCardWhenLine(buddies,noon),'Thu, Oct 29');
  assert.equal(sch.eventCardWhenLine(skully,noon),'');
  assert.ok(layout.includes('eventCardWhenLine'),'cards use the today-first date line');
});

test('legend names every type color, including Haunted trail in yellow',()=>{
  assert.ok(layout.includes("{label:'Haunted trail',value:'Haunted trail'}"),'legend includes Haunted trail');
  assert.ok(layout.includes("'Haunted trail':'#E6B325'"),'Haunted trail uses the yellow already on its chip');
  assert.ok(layout.includes('legendExtra'),'a type on the grid that is not in the list is still added');
});

test('Free chip follows the listing cost: Haunted Trails is $12 and has none',()=>{
  assert.deepEqual(fmt.eventFeatureChips({cost:'$12 per person',features:['Open to all','Kid-friendly']}),['Open to all','Kid-friendly']);
  assert.deepEqual(fmt.eventFeatureChips({cost:'$12 per person',features:['Free','Open to all','Kid-friendly']}),['Open to all','Kid-friendly']);
  assert.deepEqual(fmt.eventFeatureChips({cost:'Free',features:['Free','Open to all','Kid-friendly','Costumes Available']}),['Free','Open to all','Kid-friendly']);
  assert.deepEqual(fmt.eventFeatureChips({cost:'Free',features:['Open to all']}),['Free','Open to all']);
  assert.deepEqual(fmt.eventFeatureChips({cost:'$5 a child',features:['Open to all','Kid-friendly']}),['Open to all','Kid-friendly']);
});

test('review controls: All week sits with the switch, This week hides on the current week, one calendar link, text chips, explained counts',()=>{
  assert.ok(css.includes('#allEventDays.btn{min-height:50px;height:50px'),'All week matches the view switch height');
  assert.ok(css.includes('.events-view{display:flex;align-items:center;justify-content:flex-start'),'All week stays next to the switch');
  assert.ok(css.includes('#allEventDays[aria-pressed="false"]{background:transparent'),'All week is an outline once a day is selected');
  assert.ok(layout.includes("$('thisWeek').hidden=hideNav||onCurrentWeek"),'This week is hidden on the current week');
  assert.ok(css.includes('#thisWeek.btn{min-height:32px'),'This week is a small outline on other weeks');
  assert.equal(html.includes('id="railAddAll"'),false,'calendar link is not in the right column');
  assert.ok(html.includes('id="addAllToCalendar"'),'title-row calendar link remains');
  assert.ok(layout.includes('eventTags(x).map(f=>`<span class="chip">${safeListingText(f)}</span>`)'),'event features are text chips');
  assert.ok(layout.includes('`${weekCount} this week · ${pool.length} total`'),'header explains the week count and the total');
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
