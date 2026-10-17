const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const schedules=require('../schedules');
const {eventWeekDays,buildEventsICS}=schedules;
const chromeFilters=require('../chrome-filters');
const {CHROME_EVENT_TYPE_OPTIONS,CHROME_EVENT_FEATURE_OPTIONS,chromeValueForEventTypeLabel,chromeEventTypeLabelForValue}=chromeFilters;

/* ---- Week board structure (spec 7.3, D3/M5) ---- */
test('week board: 7-column grid CSS, min-height 300px columns, halloween column tinted',()=>{
  const grid=css.split('\n').find(l=>l.startsWith('.event-week[data-view="week"]'));
  assert.ok(grid&&grid.includes('repeat(7,minmax(0,1fr))'),'week view renders 7 equal columns');
  const three=css.split('\n').find(l=>l.startsWith('.event-week[data-view="3days"]'));
  assert.ok(three&&three.includes('repeat(3,minmax(240px,1fr))'),'3-day view renders 3 columns');
  const col=css.split('\n').find(l=>l.startsWith('.event-col{'));
  assert.ok(col&&col.includes('min-height:300px'),'day columns are at least 300px tall');
  const hw=css.split('\n').find(l=>l.startsWith('.event-col--halloween{'));
  assert.ok(hw&&hw.includes('var(--sat-tint)')&&hw.includes('var(--purple)'),'halloween column uses sat-tint + purple');
  assert.ok(css.includes('.event-col.is-selected{border-color:var(--orange)'),'selected day outlined in orange');
});

test('eventWeekDays: 7 days ending Oct 31 of the season year',()=>{
  const days=eventWeekDays([{id:'a',year:2026}]);
  assert.equal(days.length,7);
  assert.equal(days[6],'2026-10-31');
  assert.equal(days[0],'2026-10-25');
  const fallback=eventWeekDays([]);
  assert.equal(fallback.length,7,'empty list still yields a week');
  assert.ok(fallback[6].endsWith('-10-31'),'fallback week still ends on Oct 31');
});

test('calendar(): week board markup — 7 columns, halloween flag, empty state, chips',()=>{
  assert.ok(layout.includes('function calendar()'),'calendar() exists');
  assert.ok(layout.includes("$('eventWeek').innerHTML=viewDays.map"),'week grid built from view days');
  assert.ok(layout.includes('data-week-day="${date}"'),'columns carry the ISO day for selection');
  assert.ok(layout.includes('role="button" tabindex="0"'),'columns are keyboard-focusable buttons');
  assert.ok(layout.includes('event-col--halloween'),'halloween column class');
  assert.ok(layout.includes('Trick-or-treat night'),'halloween flag label');
  assert.ok(layout.includes('No events yet'),'empty day state');
  assert.ok(layout.includes("$('eventWeek').dataset.view=state.eventsView||'week'"),'view mode drives the grid');
});

/* ---- Chip anatomy ---- */
test('event chips: 4px type-color top border, time / name / town · type meta',()=>{
  const chip=css.split('\n').find(l=>l.startsWith('.event-chip{'));
  assert.ok(chip&&chip.includes('border-top:4px solid var(--event-color,var(--teal))'),'chip top border uses the event type color');
  assert.ok(layout.includes('function townOf(x)'),'townOf helper exists (events have no town field)');
  assert.ok(layout.includes('event-chip__time'),'chip time element');
  assert.ok(layout.includes("compactTime(x.hours):'All day'"),'timed hours or All day fallback');
  assert.ok(layout.includes('event-chip__name'),'chip name element');
  assert.ok(layout.includes('${safeListingText(townOf(x))} · ${safeListingText(x.eventType)}'),'chip meta is Town · Type');
});

/* ---- View switch + 3-day window ---- */
test('view switch: pill segment in markup, helper copy, three days cross weeks',()=>{
  assert.ok(html.includes('data-events-view="3days"'),'3-days option in markup');
  assert.ok(html.includes('data-events-view="week"'),'week option in markup');
  assert.ok(html.includes('id="eventsViewHelper"'),'helper text element');
  assert.ok(layout.includes("$('eventsView').querySelectorAll('[data-events-view]')"),'aria-checked syncs to state');
  assert.ok(layout.includes("threeDayWindow(days)"),'3-day view uses the window helper');
  assert.ok(layout.includes('threeDayDates'),'3-day window is today plus the next two days');
  assert.equal(layout.includes("today>days[6]?days[4]:today"),false,'3-day view is no longer clamped to one week');
});

/* ---- Day selection, reset, ?day= round-trip ---- */
test('day selection: toggle, All week reset, ?day= param read + write',()=>{
  assert.ok(layout.includes("state.eventDay=state.eventDay===day?'':day"),'column click toggles the day');
  assert.ok(layout.includes("u.searchParams.set('day',String(+day.slice(8,10)))"),'?day= stores the day of month');
  assert.ok(layout.includes('history.replaceState'),'day param written without navigation');
  assert.ok(layout.includes("const dayParam=params.get('day')"),'?day= param read on load');
  assert.ok(layout.includes("String(m[1]).padStart(2,'0')"),'day param zero-padded to ISO date');
  assert.ok(layout.includes("if(week.includes(date))state.eventDay=date"),'day param validated against the season week');
  assert.ok(layout.includes("!days.includes(state.eventDay)){state.eventDay='';setDayParam('')}"),'stale selected day is cleared');
  const reset=layout.includes("allEventDays').onclick");
  assert.ok(reset,'All week button wired');
  assert.ok(layout.includes("$('allEventDays').onclick=()=>{state.eventDay='';setDayParam('');renderCards()}"),'All week resets day + param');
});

/* ---- Right column: heading + count agreement ---- */
test('events right column: column head markup, heading + count from the same rendered array',()=>{
  assert.ok(html.includes('id="eventsColumnHead"'),'column head container in markup');
  assert.ok(html.includes('id="eventsDayHeading"'),'day heading in markup');
  assert.ok(html.includes('id="eventsHeadCount"'),'head count in markup');
  assert.ok(layout.includes("$('eventsDayHeading').textContent=state.eventDay?"),'heading names the selected day, or All week');
  assert.ok(layout.includes("$('eventsHeadCount').textContent=`${items.length} event${items.length===1?'':'s'}${state.search?' within '+state.search.radius+' mi':''}`"),'count is the same rendered array, including a search radius');
  assert.ok(layout.includes("$('cardList').innerHTML=items.map(e=>e.ongoing?eventCard(e,{band:true})"),'events render full cards with no pagination');
  assert.ok(layout.includes("$('eventsColumnHead').hidden=!event"),'column head hidden off the events tab');
  assert.ok(layout.includes("$('countLine').hidden=event"),'display count line hidden on events');
});

/* ---- Filters: Type + Features (chrome-filters) ---- */
test('events filters: Type dropdown options and Features multi-select wording',()=>{
  const labels=CHROME_EVENT_TYPE_OPTIONS.map(o=>o.label);
  assert.deepEqual(labels,['All types','Trunk-or-Treat','Parade','Festival','Donation drive','Other']);
  assert.equal(chromeValueForEventTypeLabel('Trunk-or-Treat'),'Trunk-or-treat','canonical value behind the label');
  assert.equal(chromeEventTypeLabelForValue('Trunk-or-treat'),'Trunk-or-Treat');
  assert.deepEqual(CHROME_EVENT_FEATURE_OPTIONS.map(o=>o.label),['Free','Open to all','Registration required','Kid-friendly']);
  assert.ok(app.includes('state.features.every(f=>(x.features||[]).includes(f))'),'events features filter is AND-ed');
  assert.ok(app.includes('(ignoreDay||!state.eventDay)'),'day selection narrows the event pool');
  assert.ok(app.includes('x.ongoing||!state.dateFilter||!state.dateFilter.kind'),'ongoing events ignore date filters');
});

/* ---- Ongoing band (D3) ---- */
test('ongoing band: teal rows with name, hours · town, route button',()=>{
  assert.ok(html.includes('id="ongoingBand"'),'band element in markup');
  assert.ok(html.includes('Open all week'),'band label copy');
  assert.ok(layout.includes('class="ongoing-item"'),'band rows render');
  assert.ok(layout.includes('data-open-event='),'band name still opens the event');
  assert.ok(layout.includes('data-event-route='),'band rows carry the route toggle');
  assert.ok(layout.includes('ongoing-item__route'),'route button class');
  const band=css.split('\n').find(l=>l.startsWith('.ongoing-band{'));
  assert.ok(band&&band.includes('var(--allweek-bg)')&&band.includes('var(--teal)'),'band uses the all-week teal styling');
});

/* ---- ICS export (spec 9.8) ---- */
const WEEK=['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31'];
test('buildEventsICS: timed event is a floating timed VEVENT',()=>{
  const ics=buildEventsICS([{id:'best-buddies',name:'Buddies Bash',startAt:'2026-10-29T17:30:00',endAt:'2026-10-29T19:00:00',venue:'The Venue',address:'1 Main St, Somewhere, NJ',notes:'Costume contest'}],WEEK,'https://hauntfinder.example/');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('\r\n'),'CRLF line endings');
  assert.ok(ics.includes('VERSION:2.0'));
  assert.ok(ics.includes('DTSTART:20261029T173000'),'floating local start');
  assert.ok(ics.includes('DTEND:20261029T190000'),'floating local end');
  assert.ok(!ics.includes('DTSTART;VALUE=DATE'),'timed event is not an all-day event');
  assert.ok(ics.includes('UID:best-buddies@hauntfinder'));
  assert.ok(ics.includes('LOCATION:The Venue\\, 1 Main St\\, Somewhere\\, NJ'),'location escapes commas');
  assert.ok(ics.includes('?category=events&event=best-buddies'),'event deep link in the export');
});

test('buildEventsICS: date-only event becomes an all-day event with exclusive end',()=>{
  const ics=buildEventsICS([{id:'parade',name:'Parade',date:'2026-10-31',venue:'Main St'}],WEEK,'https://hauntfinder.example/');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261031'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261101'),'exclusive end is the next day');
  assert.ok(!ics.includes('DTSTART:2026'),'no timed form for date-only events');
});

test('buildEventsICS: ongoing event expands to 7 explicit all-day VEVENTs',()=>{
  const ics=buildEventsICS([{id:'skullys',name:'Skully\'s Yard',ongoing:true,hours:'Dusk–10 PM'}],WEEK,'https://hauntfinder.example/');
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,7,'one VEVENT per week day');
  for(const d of WEEK){assert.ok(ics.includes('DTSTART;VALUE=DATE:'+d.replace(/-/g,'')),'all-day entry for '+d)}
  assert.ok(!/DTSTART:\d{8}T\d{6}/.test(ics),'no timed entries for an ongoing event');
  assert.ok(!ics.includes('RRULE'),'no recurrence rules');
});

test('buildEventsICS: events without a usable date are omitted; notes are escaped',()=>{
  const ics=buildEventsICS([{id:'mystery',name:'Mystery event',startAt:'soon'}],WEEK,'https://hauntfinder.example/');
  assert.ok(!ics.includes('mystery'),'unparseable event omitted');
  const esc=buildEventsICS([{id:'esc',name:'Esc,ape; event',date:'2026-10-29',notes:'line one\nline two, with; punct'}],WEEK,'https://hauntfinder.example/');
  assert.ok(esc.includes('SUMMARY:Esc\\,ape\\; event'),'summary escapes commas and semicolons');
  assert.ok(esc.includes('line one\\nline two\\, with\\; punct'),'notes escape newlines and punctuation');
});

test('buildEventsICS: weekDays fallback derives the week from the event year',()=>{
  const ics=buildEventsICS([{id:'bb',name:'BB',date:'2026-10-29',year:2026}],[],'https://hauntfinder.example/');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261029'),'fallback week matches the event year');
});

/* ---- Mobile day list (M5) ---- */
test('mobile day list: .mday sections, long-date headings, list column hidden < 960px',()=>{
  assert.ok(layout.includes('class="mday'),'mobile day sections render');
  assert.ok(layout.includes('mday__head'),'mobile day heading class');
  assert.ok(layout.includes('No events listed yet'),'mobile empty copy');
  assert.ok(layout.includes("weekday:'long',month:'short',day:'numeric'"),'mobile headings use long weekday dates');
  assert.ok(css.includes('@media(max-width:959px)'),'mobile breakpoint exists');
  assert.ok(css.includes('html[data-category="events"] .list-column{display:none}'),'list column hidden on mobile events');
  assert.ok(css.includes('@media(min-width:960px)'),'desktop breakpoint exists');
});

/* ---- Two-column events page ---- */
test('events page: two-column grid ≥1200px, single column 1024–1199px',()=>{
  assert.ok(css.includes('html[data-category="events"] .page-grid{grid-template-columns:minmax(0,1fr) 440px}'),'440px right column at 1200px+');
  assert.ok(css.includes('html[data-category="events"] .page-grid{grid-template-columns:minmax(0,1fr)}'),'single column 1024–1199px');
});

/* ---- Legend ---- */
test('legend: filled from the type options, styled',()=>{
  assert.ok(layout.includes("$('eventLegend').innerHTML=EVENT_TYPE_OPTIONS"),'legend built from type options');
  assert.ok(layout.includes(".filter(o=>o.value!=='All')"),'legend skips the All types row');
  assert.ok(css.includes('.event-legend'),'legend styling present');
});

/* ---- Guardrails ---- */
test('app.js preamble unchanged; map pins and deep links preserved',()=>{
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  const head=execSync('git show HEAD:app.js',{cwd:ROOT,encoding:'utf8'});
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble before const filters= is byte-identical to HEAD');
  const about=fs.readFileSync(path.join(ROOT,'about.html'),'utf8');
  assert.ok(html.includes('?category=events&event=')||layout.includes('?category=events&event=')||about.includes('?category=events&event='),'event deep links intact');
});
