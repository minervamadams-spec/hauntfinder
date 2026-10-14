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
// 'Hours unknown' when nothing resolves. Null-safe.
function hoursLabel(schedule,dateStr){
 const h=hoursOn(schedule,dateStr);
 if(!h||!h.open)return 'Hours unknown';
 const open=fmtTime(h.open);
 if(!open)return 'Hours unknown';
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
// Calendar day derivation for the events tab: dated events become day
// buttons (min..max range, deduped, sorted); ongoing events never become day
// buttons — they only appear in the All-week view. label is "Oct 29" for one
// day or "Oct 29–31" for a range, for the section heading.
function eventDays(events){
 const list=Array.isArray(events)?events:[];
 const dayOf=e=>dateStrOk(e.date)?e.date:(dateStrOk(String(e.startAt||'').slice(0,10))?String(e.startAt).slice(0,10):null);
 const days=[...new Set(list.filter(e=>e&&!e.ongoing).map(dayOf).filter(Boolean))].sort();
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
 const day=dateStrOk(event&&event.date)?event.date:(dateStrOk(String((event&&event.startAt)||'').slice(0,10))?String(event.startAt).slice(0,10):null);
 if(f.kind==='date')return day===f.date;
 if(f.kind==='tonight')return day===todayParts(now).dateStr;
 if(f.kind==='weekend')return day!==null&&nextWeekendDates(todayParts(now).dateStr).includes(day);
 return true;
}
if(typeof module!=='undefined')module.exports={hoursOn,datesActive,hasScheduleInfo,isOpenAt,hoursLabel,openOnDateLabel,schedulesCompleteFor,openTonightEligible,DATE_FILTER_KEY,todayParts,nextWeekendDates,normalizeDateFilter,loadDateFilter,saveDateFilter,schedulesDateMatch,openTonightBadgeHTML,eventDays,eventDateMatch,dateFilterLabel};
