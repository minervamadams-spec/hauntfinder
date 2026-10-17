// Hauntfinder structured schedules: dates + recurring hours engine (Release 2, Part A).
// Pure functions over plain data — no globals, no DOM. Classic script with a
// Node dual-export like routing.js. Loaded after location.js, before
// community.js (script tag wired in Part B).
//
// Schema (additive `schedule` object on a listing record):
//   {
//     startDate:  "2026-10-01",              // optional
//     endDate:    "2026-10-31",              // optional
//     weekly:     [{dow:5,open:"18:00",close:"24:00"}, ...],   // dow 0=Sun..6=Sat; close optional
//     exceptions: [{date:"2026-10-31",open:"16:00",close:"20:00"},
//                  {date:"2026-10-30",closed:true,note:"Weather"}]  // overrides weekly for that date
//   }
// Closures ride in exceptions with closed:true (+ note); a host-confirmed
// reopening later is simply the exception being removed.
function dateStrOk(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)}
// Zero-padded ISO dates compare correctly as strings.
function cmpDate(a,b){return a<b?-1:a>b?1:0}
function dowOf(dateStr){
 if(!dateStrOk(dateStr))return null;
 const dt=new Date(dateStr+'T12:00:00');
 return isNaN(dt.getTime())?null:dt.getDay();
}
function toMinutes(hhmm){
 const m=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||''));
 if(!m)return null;
 const h=+m[1],min=+m[2];
 if(h>24||min>59||(h===24&&min>0))return null;
 return h*60+min;
}
// Within the declared date range (vacuously true when no range is declared, or
// when there is no schedule at all — hoursOn is the stricter gate).
function datesActive(schedule,dateStr){
 if(!dateStrOk(dateStr))return false;
 if(!schedule)return true;
 if(schedule.startDate&&dateStrOk(schedule.startDate)&&cmpDate(dateStr,schedule.startDate)<0)return false;
 if(schedule.endDate&&dateStrOk(schedule.endDate)&&cmpDate(dateStr,schedule.endDate)>0)return false;
 return true;
}
// Hours for a given calendar date, or null when closed/unknown/out of season.
// An exception for the exact date wins over the weekly pattern; a closed
// exception means closed (null). Entries with no open time mean "open that
// day, hours unknown" and come back as {open:null,close:null,allDay:true}.
function hoursOn(schedule,dateStr){
 if(!schedule||!dateStrOk(dateStr))return null;
 if(!datesActive(schedule,dateStr))return null;
 const ex=(Array.isArray(schedule.exceptions)?schedule.exceptions:[]).find(e=>e&&e.date===dateStr);
 if(ex){
  if(ex.closed)return null;
  return {open:ex.open||null,close:ex.close||null,allDay:!ex.open};
 }
 const dow=dowOf(dateStr);
 if(dow===null)return null;
 const w=(Array.isArray(schedule.weekly)?schedule.weekly:[]).find(x=>x&&x.dow===dow);
 if(!w)return null;
 return {open:w.open||null,close:w.close||null,allDay:!w.open};
}
function hasScheduleInfo(record){
 const s=record&&record.schedule;
 if(!s)return false;
 return Boolean(s.startDate||s.endDate||(Array.isArray(s.weekly)&&s.weekly.length)||(Array.isArray(s.exceptions)&&s.exceptions.length));
}
// Time falls inside the resolved hours. "24:00" close means through end of
// day; an open-only entry means open from that time with no known close;
// an allDay entry (no open time) is treated as open.
function isOpenAt(schedule,dateStr,timeStr){
 const h=hoursOn(schedule,dateStr);
 if(!h)return false;
 const t=toMinutes(timeStr);
 if(t===null)return false;
 if(!h.open)return true;
 const open=toMinutes(h.open);
 if(open===null||t<open)return false;
 if(h.close){
  const close=toMinutes(h.close);
  if(close!==null&&t>close)return false;
 }
 return true;
}
// "18:00" -> "6 PM", "16:30" -> "4:30 PM", "24:00" -> "12 AM".
function fmtTime(hhmm){
 const m=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||''));
 if(!m)return null;
 let h=+m[1];const min=+m[2];
 if(h===24&&min===0)h=0;
 const ap=h>=12?'PM':'AM';
 const h12=h%12||12;
 return min===0?`${h12} ${ap}`:`${h12}:${String(min).padStart(2,'0')} ${ap}`;
}
// Compact label for one date: "4–8 PM", "6 PM–12 AM", "from 6 PM", or
// 'Hours not listed' when nothing resolves. Null-safe.
function hoursLabel(schedule,dateStr){
 const h=hoursOn(schedule,dateStr);
 if(!h||!h.open)return 'Hours not listed';
 const open=fmtTime(h.open);
 if(!open)return 'Hours not listed';
 if(!h.close)return `from ${open}`;
 const close=fmtTime(h.close);
 if(!close)return open;
 const ap=/ (AM|PM)$/;
 const openAp=ap.exec(open),closeAp=ap.exec(close);
 const openShort=openAp&&closeAp&&openAp[1]===closeAp[1]?open.replace(/ (AM|PM)$/,''):open;
 return `${openShort}–${close}`;
}
const openOnDateLabel=hoursLabel;
// "Open tonight" gate: every non-placeholder record must carry schedule info
// AND resolve to concrete hours on the date. Unknown-hours listings keep the
// label off until their hosts complete the data.
function schedulesCompleteFor(records,dateStr){
 const active=(Array.isArray(records)?records:[]).filter(r=>r&&!r.placeholder);
 if(!active.length)return false;
 return active.every(r=>hasScheduleInfo(r)&&hoursOn(r.schedule,dateStr)!==null);
}
function openTonightEligible(records,dateStr){return schedulesCompleteFor(records,dateStr)}
// ---- Date filters (Release 2, Part B). Pure and Node-testable. ----
const DATE_FILTER_KEY='hfdate:v1';
const MS_DAY=86400000;
const pad2=n=>String(n).padStart(2,'0');
function toDateStr(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`}
// Local "today" split into the engine's string shapes; 'tonight' is resolved
// from this on every match, so revisits always use the fresh date.
function todayParts(now=new Date()){return {dateStr:toDateStr(now),timeStr:`${pad2(now.getHours())}:${pad2(now.getMinutes())}`,dow:now.getDay()}}
// Coming Saturday/Sunday pair for a date: the current weekend when the date
// is already Sat/Sun, otherwise the next one.
function nextWeekendDates(dateStr){
 const dt=new Date(dateStr+'T12:00:00');
 if(isNaN(dt.getTime()))return [];
 const dow=dt.getDay();
 const sat=new Date(dt.getTime()+(dow===6?0:dow===0?-1:6-dow)*MS_DAY);
 return [toDateStr(sat),toDateStr(new Date(sat.getTime()+MS_DAY))];
}
function normalizeDateFilter(filter){
 if(!filter||typeof filter!=='object')return {kind:null,date:null};
 if(filter.kind==='tonight'||filter.kind==='weekend')return {kind:filter.kind,date:null};
 if(filter.kind==='date'&&dateStrOk(filter.date))return {kind:'date',date:filter.date};
 return {kind:null,date:null};
}
// Short label for an active date filter, shown in result counts so a
// date-narrowed count is distinguishable from the area total
// ("3 displays within 25 mi · Tonight").
function dateFilterLabel(filter){
 const f=normalizeDateFilter(filter);
 if(f.kind==='tonight')return 'Tonight';
 if(f.kind==='weekend')return 'This weekend';
 if(f.kind==='date'){const dt=new Date(f.date+'T12:00:00');return isNaN(dt.getTime())?f.date:dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
 return null;
}
function loadDateFilter(storage){try{return normalizeDateFilter(JSON.parse(storage.getItem(DATE_FILTER_KEY)||'null'))}catch{return {kind:null,date:null}}}
function saveDateFilter(filter,storage){const clean=normalizeDateFilter(filter);try{storage.setItem(DATE_FILTER_KEY,JSON.stringify(clean))}catch{}return clean}
// The predicate date filters AND through: Tonight keeps only listings with
// concrete hours that are open right now (unknown hours are excluded, not
// guessed); Weekend keeps listings open either weekend day; Date keeps
// listings with hours on the chosen date.
function schedulesDateMatch(record,filter,now=new Date()){
 const f=normalizeDateFilter(filter);
 const s=record?record.schedule:null;
 if(f.kind==='tonight'){const t=todayParts(now);return hasScheduleInfo(record)&&isOpenAt(s,t.dateStr,t.timeStr)}
 if(f.kind==='weekend')return nextWeekendDates(todayParts(now).dateStr).some(d=>hoursOn(s,d)!==null);
 if(f.kind==='date')return hoursOn(s,f.date)!==null;
 return true;
}
// "Open tonight" badge markup, gated by the completeness check: the caller
// passes openTonightEligible(activeListings, todayStr) as `eligible`.
function openTonightBadgeHTML(record,{eligible=false,now=new Date()}={}){
 if(!eligible)return '';
 const t=todayParts(now);
 if(!isOpenAt(record?record.schedule:null,t.dateStr,t.timeStr))return '';
 return '<span class="card__open-tonight">Open tonight</span>';
}
// America/New_York offset for a civil date. US DST runs from 02:00 on the
// second Sunday in March through 02:00 on the first Sunday in November.
function nthSunday(year,monthIndex,n){
 const first=new Date(Date.UTC(year,monthIndex,1));
 return 1+(7-first.getUTCDay())%7+(n-1)*7;
}
function easternOffset(dateStr,hhmm){
 if(!dateStrOk(dateStr))return '-05:00';
 const y=+dateStr.slice(0,4);
 const start='03-'+pad2(nthSunday(y,2,2)),end='11-'+pad2(nthSunday(y,10,1)),key=dateStr.slice(5);
 const mins=toMinutes(hhmm==null?'12:00':hhmm);
 if(key>start&&key<end)return '-04:00';
 if(key===start)return mins!=null&&mins<120?'-05:00':'-04:00';
 if(key===end)return mins!=null&&mins<120?'-04:00':'-05:00';
 return '-05:00';
}
function easternToday(now=new Date()){
 const d=now instanceof Date?now:new Date(now);
 if(Number.isNaN(d.getTime()))return '';
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function eventClock(ev){
 const hm=v=>typeof v==='string'&&/^\d{2}:\d{2}$/.test(v)?v:null;
 const fromIso=iso=>{const m=String(iso||'').match(/T(\d{2}):(\d{2})/);return m?m[1]+':'+m[2]:null};
 return {open:hm(ev&&ev.startTime)||fromIso(ev&&ev.startAt),close:hm(ev&&ev.endTime)||fromIso(ev&&ev.endAt)};
}
// Several separate dates live on one event as `dates: ["YYYY-MM-DD", ...]`,
// with `startTime`/`endTime` as America/New_York clock times for each date.
// A lone `date` or `startAt` is still one day. A start/end pair is not expanded
// into the days in between.
function eventDateList(ev){
 if(!ev||ev.ongoing)return [];
 if(Array.isArray(ev.dates)){
  const ds=[...new Set(ev.dates.filter(dateStrOk))].sort();
  if(ds.length)return ds;
 }
 const one=dateStrOk(ev.date)?ev.date:(dateStrOk(String(ev.startAt||'').slice(0,10))?String(ev.startAt).slice(0,10):null);
 return one?[one]:[];
}
function eventOccurrences(ev){
 const clock=eventClock(ev);
 return eventDateList(ev).map(date=>{
  const startAt=clock.open?`${date}T${clock.open}:00${easternOffset(date,clock.open)}`:(ev.startAt&&String(ev.startAt).slice(0,10)===date?ev.startAt:null);
  const endAt=clock.close?`${date}T${clock.close}:00${easternOffset(date,clock.close)}`:(ev.endAt&&String(ev.endAt).slice(0,10)===date?ev.endAt:startAt);
  return {date,startAt,endAt,startMs:startAt?Date.parse(startAt):NaN,endMs:endAt?Date.parse(endAt):NaN};
 });
}
function asEventNow(now){if(now instanceof Date)return now;const n=Number(now);return Number.isFinite(n)?new Date(n):new Date()}
function eventUpcomingDates(ev,now=new Date()){
 const d=asEventNow(now),n=d.getTime(),today=easternToday(d);
 return eventOccurrences(ev).filter(o=>{
  if(Number.isFinite(o.endMs))return o.endMs>n;
  if(Number.isFinite(o.startMs))return o.date>today||o.startMs>n;
  return Boolean(today)&&o.date>=today;
 }).map(o=>o.date);
}
function eventHasUpcoming(ev,now=new Date()){return !!(ev&&(ev.ongoing===true||eventUpcomingDates(ev,now).length))}
function eventNextStart(ev,now=new Date()){
 const dates=eventUpcomingDates(ev,now);
 if(!dates.length)return null;
 const occ=eventOccurrences(ev).find(o=>o.date===dates[0]);
 return occ&&Number.isFinite(occ.startMs)?occ.startMs:null;
}
function eventOccursOn(ev,day,now=new Date()){
 if(!dateStrOk(day))return false;
 const upcoming=eventUpcomingDates(ev,now);
 return (upcoming.length?upcoming:eventDateList(ev)).includes(day);
}
// Calendar day derivation for the events tab: dated events become day
// buttons (min..max range, deduped, sorted); ongoing events never become day
// buttons — they only appear in the All-week view. label is "Oct 29" for one
// day or "Oct 29–31" for a range, for the section heading. A `dates` list
// contributes every date; a start/end range still contributes only its start.
function eventDays(events){
 const list=Array.isArray(events)?events:[];
 const days=[...new Set(list.filter(e=>e&&!e.ongoing).flatMap(eventDateList))].sort();
 const ongoing=list.some(e=>e&&e.ongoing);
 const fmtD=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'});
 let label=null;
 if(days.length===1)label=fmtD(days[0]);
 else if(days.length>1)label=`${fmtD(days[0])}–${fmtD(days[days.length-1])}`;
 return {days,ongoing,label};
}
// Events honor the shared hfdate:v1 date filter by their own day (date or
// startAt date). Ongoing events are never filtered out by date — the caller
// skips them before consulting this, mirroring the eventDay strip behavior.
function eventDateMatch(event,filter,now=new Date()){
 const f=normalizeDateFilter(filter);
 if(!f||!f.kind)return true;
 const days=eventDateList(event);
 if(f.kind==='date')return days.includes(f.date);
 if(f.kind==='tonight')return days.includes(todayParts(now).dateStr);
 if(f.kind==='weekend'){const weekend=nextWeekendDates(todayParts(now).dateStr);return days.some(d=>weekend.includes(d))}
 return true;
}
// ---- 1A Phase E: Halloween-week grid + ICS export (spec 7.3/9.8). ----
// The events page week is the seven days ending on Oct 31 of the season
// year (Sun 25–Sat 31 in 2026), derived from the events' own year field —
// never hardcoded dates. Pure and require-able for tests.
function eventWeekDays(list){
 const year=(Array.isArray(list)?list:[]).map(e=>{const y=+(e&&e.year);return Number.isFinite(y)&&y>1900?y:0}).find(y=>y>0)||new Date().getFullYear();
 const end=new Date(Date.UTC(year,9,31)),start=new Date(end);
 start.setUTCDate(end.getUTCDate()-6);
 const days=[];
 for(let i=0;i<7;i++){const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);days.push(d.toISOString().slice(0,10))}
 return days;
}
// Navigable Sun–Sat weeks (America/New_York civil dates). eventWeekDays stays
// the season week used by the calendar export; the page grid uses these.
function isoAddDays(iso,n){
 const [y,m,d]=String(iso||'').split('-').map(Number);
 const dt=new Date(Date.UTC(y,m-1,d+n));
 return dt.toISOString().slice(0,10);
}
function weekdayIndexNY(iso){
 if(!dateStrOk(iso))return 0;
 const [y,m,d]=iso.split('-').map(Number);
 const wd=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'}).format(new Date(Date.UTC(y,m-1,d,17,0,0)));
 return {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[wd]||0;
}
function weekSunday(iso){return dateStrOk(iso)?isoAddDays(iso,-weekdayIndexNY(iso)):'';}
function weekDates(sunday){if(!dateStrOk(sunday))return [];const days=[];for(let i=0;i<7;i++)days.push(isoAddDays(sunday,i));return days;}
function isOct31(iso){return dateStrOk(iso)&&iso.slice(5)==='10-31';}
function weekRangeLabel(days){
 if(!Array.isArray(days)||!days.length)return 'Week';
 const fmt=(d,opt)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',Object.assign({timeZone:'America/New_York'},opt));
 const end=days[days.length-1],a=fmt(days[0],{month:'short',day:'numeric'}),bSame=fmt(end,{day:'numeric'}),bFull=fmt(end,{month:'short',day:'numeric'});
 if(days.length===1)return a;
 const range=days[0].slice(0,7)===end.slice(0,7)?`${a}–${bSame}`:`${a}–${bFull}`;
 if(days.length===7&&days.some(isOct31))return `Halloween week · ${range}`;
 if(days.length===7)return `Week of ${range}`;
 return range;
}
function threeDayDates(now){
 const today=easternToday(now instanceof Date?now:new Date());
 return today?[0,1,2].map(i=>isoAddDays(today,i)):[];
}
// Single-date and `dates` lists occupy their real columns. Ongoing listings
// never do — they belong in the Open all week band.
function eventColumnDates(ev){if(!ev||ev.ongoing)return [];return eventDateList(ev);}
function ongoingCoversWeek(ev,days){
 if(!ev||ev.ongoing!==true||!Array.isArray(days)||!days.length)return false;
 const listed=Array.isArray(ev.dates)?ev.dates.filter(dateStrOk).slice().sort():[];
 const one=dateStrOk(ev.date)?ev.date:(dateStrOk(String(ev.startAt||'').slice(0,10))?String(ev.startAt).slice(0,10):'');
 const end=dateStrOk(String(ev.endAt||'').slice(0,10))?String(ev.endAt).slice(0,10):'';
 if(!listed.length&&!one&&!end)return true;
 const start=listed.length?listed[0]:one,last=listed.length?listed[listed.length-1]:(end||one);
 if(last&&last<days[0])return false;
 if(start&&start>days[days.length-1])return false;
 return true;
}
function lastListedDate(list){
 const dates=(Array.isArray(list)?list:[]).filter(e=>e&&!e.ongoing).flatMap(eventDateList).filter(dateStrOk).sort();
 return dates.length?dates[dates.length-1]:'';
}
function eventWeekBounds(list,now){
 const today=easternToday(now instanceof Date?now:new Date(now==null?Date.now():now));
 const min=weekSunday(today);
 const last=lastListedDate(list);
 let max=last?weekSunday(last):min;
 if(!max||(min&&max<min))max=min;
 return {min,max,today};
}
function clampWeekStart(start,bounds){
 if(!bounds||!bounds.min)return weekSunday(start)||'';
 let s=weekSunday(start)||bounds.min;
 if(s<bounds.min)s=bounds.min;
 if(bounds.max&&s>bounds.max)s=bounds.max;
 return s;
}
function shiftWeek(start,delta,bounds){const base=weekSunday(start)||(bounds&&bounds.min)||'';return clampWeekStart(base?isoAddDays(base,(delta||0)*7):'',bounds);}
function icsEscape(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
function icsNextDay(day){const d=new Date(Date.UTC(+day.slice(0,4),+day.slice(5,7)-1,+day.slice(8,10)+1));return d.toISOString().slice(0,10)}
// Pure ICS builder; the caller passes the already-filtered list (Type /
// Features filters live in matchingEvents) and downloads the string.
// Documented choices, per spec 9.8 + the no-invented-times rule:
//  - timed events export startAt/endAt as floating local datetimes;
//  - date-only events export as all-day spans (DTEND exclusive, +1 day);
//  - ongoing / open-all-week listings export as seven explicit all-day
//    VEVENTs (one per Halloween-week day — no RRULE, safest for Apple and
//    Google) and never carry times, so ambiguous free-text schedules like
//    "Weekdays 5–8 PM · Weekends 10 AM–6 PM" contribute no DTSTART/DTEND;
//  - events with no usable date at all are omitted, never guessed;
//  - an event with a `dates` list exports one floating VEVENT per date
//    (same local clock on each date; no RRULE).
function buildEventsICS(list,weekDays,base){
 const days=Array.isArray(weekDays)&&weekDays.length?weekDays:eventWeekDays(list);
 const root=typeof base==='string'&&base?base:'https://hauntfinder.vercel.app/';
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hauntfinder//Events//EN','CALSCALE:GREGORIAN'];
 const push=(ev,uid,start,end,allDay)=>{
  lines.push('BEGIN:VEVENT','UID:'+icsEscape(uid)+'@hauntfinder','DTSTAMP:'+days[0].replace(/-/g,'')+'T000000','SUMMARY:'+icsEscape(ev.name||''));
  if(start)lines.push((allDay?'DTSTART;VALUE=DATE:':'DTSTART:')+start);
  if(end)lines.push((allDay?'DTEND;VALUE=DATE:':'DTEND:')+end);
  const loc=[ev.venue,ev.address].filter(Boolean).join(', ');
  if(loc)lines.push('LOCATION:'+icsEscape(loc));
  const url=root+'?category=events&event='+encodeURIComponent(ev.id);
  const desc=[ev.notes?String(ev.notes):'',url].filter(Boolean).join('\n');
  lines.push('DESCRIPTION:'+icsEscape(desc),'URL:'+url,'END:VEVENT');
 };
 (Array.isArray(list)?list:[]).forEach(ev=>{
  if(!ev||!ev.id)return;
  if(ev.ongoing){days.forEach(d=>push(ev,ev.id+'-'+d,d.replace(/-/g,''),icsNextDay(d).replace(/-/g,''),true));return}
  if(Array.isArray(ev.dates)){
   const listed=eventDateList(ev),clock=eventClock(ev);
   if(listed.length){
    listed.forEach(raw=>{
     if(clock.open){
      const stampT=hm=>raw.replace(/-/g,'')+'T'+hm.replace(':','')+'00';
      push(ev,ev.id+'-'+raw,stampT(clock.open),stampT(clock.close||clock.open),false);
      return;
     }
     push(ev,ev.id+'-'+raw,raw.replace(/-/g,''),icsNextDay(raw).replace(/-/g,''),true);
    });
    return;
   }
  }
  const raw=ev.date&&/^\d{4}-\d{2}-\d{2}$/.test(ev.date)?ev.date:String(ev.startAt||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return;
  const stamp=iso=>{const m=String(iso||'').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);return m?m[1].replace(/-/g,'')+'T'+m[2]+m[3]+'00':null};
  const start=stamp(ev.startAt);
  if(start){const end=stamp(ev.endAt)||start;push(ev,ev.id,start,end,false);return}
  push(ev,ev.id,raw.replace(/-/g,''),icsNextDay(raw).replace(/-/g,''),true);
 });
 lines.push('END:VCALENDAR');
 return lines.join('\r\n')+'\r\n';
}
if(typeof module!=='undefined')module.exports={hoursOn,datesActive,hasScheduleInfo,isOpenAt,hoursLabel,openOnDateLabel,schedulesCompleteFor,openTonightEligible,DATE_FILTER_KEY,todayParts,nextWeekendDates,normalizeDateFilter,loadDateFilter,saveDateFilter,schedulesDateMatch,openTonightBadgeHTML,eventDays,eventDateMatch,dateFilterLabel,eventWeekDays,buildEventsICS,easternOffset,easternToday,eventDateList,eventOccurrences,eventUpcomingDates,eventHasUpcoming,eventNextStart,eventOccursOn,isoAddDays,weekSunday,weekDates,isOct31,weekRangeLabel,threeDayDates,eventColumnDates,ongoingCoversWeek,lastListedDate,eventWeekBounds,clampWeekStart,shiftWeek};
