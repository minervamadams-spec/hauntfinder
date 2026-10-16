const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const app=read('app.js'),layout=read('layout.js'),css=read('styles.css'),chrome=read('chrome-filters.js');
const submit=read('submit.html'),alerts=read('alerts.html'),alertsJs=read('alerts.js'),about=read('about.html');

test('round 4 item 1: v2 icon set shipped, old flat icons removed, events use the skull pin',()=>{
  for(const n of ['pin-display','pin-treat-stop','pin-event','icon-display','icon-treat-stop','icon-event'])assert.ok(fs.existsSync(path.join(ROOT,'assets/icons/v2',n+'.svg')),n+' v2 present');
  for(const n of ['pin-display','pin-treat-stop','pin-event','icon-display','icon-treat-stop','icon-event'])assert.equal(fs.existsSync(path.join(ROOT,'assets/icons',n+'.svg')),false,'old '+n+' removed');
  assert.match(app,/function eventSquareIcon\(n\)\{const w=pinWidth\(\),h=pinHeight\(w\);return L\.divIcon\(\{className:'',html:`<div class="pin pin--event" data-event-pin="\$\{n\}"><img class="pin__art" src="assets\/icons\/v2\/pin-event\.svg"/);
  assert.ok(app.includes('function cardIconHTML(kind)')&&app.includes('assets/icons/v2/icon-${kind===\'treat\'?\'treat-stop\':\'display\'}.svg'),'cards use the v2 type icons');
});
test('round 4 item 2/4: Host notes hidden for placeholder notes; "Hours not listed"',()=>{
  const {hasHostNotes}=new Function(app.match(/function hasHostNotes\(x\)\{[^\n]*\}/)[0]+';return {hasHostNotes}')();
  assert.equal(hasHostNotes({notes:'More details coming soon.'}),false);
  assert.equal(hasHostNotes({notes:'  '}),false);
  assert.equal(hasHostNotes({notes:''}),false);
  assert.equal(hasHostNotes({notes:'Nearest cross street: Cathy Lane.'}),true);
  assert.equal(require('../listing-format.js').listingHoursText({dates:'',times:''}),'Hours not listed');
});
test('round 4 item 3: card rows share one 7px gap; scare row is exactly one text line',()=>{
  assert.ok(css.includes('html body #cardList .card--compact{padding:12px 14px;gap:7px}'));
  assert.ok(css.includes('.card__scare-row,html body #cardList .card--compact .card__scare-row .card__scare{height:16px;line-height:16px}'));
});
test('round 4 item 5: hovered and selected pins grow to 44px, ring, and rise to the front',()=>{
  assert.ok(css.includes('html body .pin.is-linked,html body .pin.is-selected{transform:scale(1.294)'),'34px -> 44px');
  assert.ok(css.includes('html body .pin.is-linked::after,html body .pin.is-selected::after{border-color:#F6EBD3}'),'2px cream ring');
  assert.ok(app.includes('function raiseMarker(m,on)')&&app.includes('m.setZIndexOffset(m._hfBase+(on?1000:0))'),'zIndexOffset +1000');
  assert.ok(app.includes('raiseMarker(markerByNum.get(n),on||state.selected===n)')&&app.includes('raiseMarker(m,num===n)'),'hover and select both raise');
  assert.ok(layout.includes('raiseMarker(m,on)')&&app.includes('raiseMarker(mm,mm._evId===id)'),'event pins hover and select too');
});
test('round 4 item 7: Search this area reacts to the visitor only',()=>{
  assert.ok(layout.includes("['wheel','touchstart','keydown','dblclick']")&&layout.includes("mapEl.addEventListener('pointerdown',userDown"),'user-intent listeners');
  assert.ok(layout.includes('else if(!areaUser){setAreaBaseline();searchAreaBtn.classList.remove(\'is-visible\')}'),'app-made moves re-baseline silently');
});
test('round 4 item 8: filter groups stack from the top with a 24px gap',()=>{
  assert.ok(css.includes('justify-content:flex-start;align-content:flex-start;gap:24px;flex:0 0 auto'));
  assert.ok(css.includes('.filter-rail .filter-rail__links{position:sticky;bottom:-14px'),'footer stays in view');
});
test('round 4 item 9: route panel header on top, solid panel, 16px names, Remove never clipped; Plan your route kept (opens /route.html)',()=>{
  assert.ok(css.includes('html .route-wrap{flex-direction:column!important;background:#1A1322!important;overflow:hidden!important}'));
  assert.ok(css.includes('.route-stop__name{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 16px/1.3'));
  assert.ok(css.includes('.route-stop__remove{flex:none;white-space:nowrap'));
  assert.ok(css.includes('overflow-x:hidden;overflow-y:auto'),'no horizontal scrollbar strip');
  assert.ok(read('index.html').includes('id="routeLink" href="route.html">Plan your route →</a>'));
});
test('round 4 items 10-13: Donation drive pink, no duplicate Open all week, day blocks show only the time, type dots',()=>{
  assert.ok(layout.includes("'Donation drive/Community collection':'#FF6FA8'"));
  assert.ok(layout.includes("opts.day?(x.hours?`<p class=\"event-card__datetime\">${safeListingText(compactTime(x.hours))}</p>`:'')"),'day blocks: time only');
  assert.ok(layout.includes("x.ongoing?'':`<p class=\"event-card__datetime\">"),'band cards drop the repeated Open all week line');
  assert.ok(layout.includes('eventCard(e,{day:true})')&&layout.includes('eventCard(e,{band:true})'));
  assert.ok(chrome.includes("action==='event-type'&&typeof hfEventColor==='function'?`<span class=\"type-dot\""),'type chips carry a dot in the type color');
  assert.ok(css.includes('.type-dot{flex:none;width:10px;height:10px;border-radius:50%'));
});
test('round 4 items 14-16: Submit cards use type colors + v2 icons, spec copy, uppercase title',()=>{
  for(const [k,c] of [['display','#FF7A1A'],['treat','#A6E22E'],['event','#B48CFF']])assert.ok(css.includes(`.type-option[data-type-link="${k}"]{border-color:${c}}`),k+' border');
  assert.equal((submit.match(/class="type-option__icon" src="assets\/icons\/v2\/icon-/g)||[]).length,3);
  assert.ok(submit.includes('To update, choose the same type and use the same name. Listings are reviewed before they appear.'));
  assert.ok(submit.includes("Listing is free. You'll get an email if we have questions."));
  assert.ok(!submit.includes('and listing is free')&&!submit.includes('Submissions are reviewed before publication'));
  assert.ok(submit.includes('<h1>SUBMIT OR UPDATE A LISTING</h1>')&&css.includes('.subpage-main h1{text-transform:uppercase;font-size:40px}'));
});
test('round 4 items 17-18: one nav on Submit, Alerts and About; no underlined links at rest',()=>{
  for(const [n,h] of [['submit',submit],['alerts',alerts],['about',about]])assert.ok(h.includes('<header class="subpage-head">')&&h.includes('<nav class="subpage-nav" aria-label="Site">'),n+' uses the shared header');
  assert.ok(css.includes('.subpage-head{height:56px;box-sizing:border-box;padding:0 18px;border-bottom:1px solid #2E2638'));
  assert.ok(css.includes("font:700 18px/1.2 'Barlow Condensed'")&&css.includes("font:600 16px/1 'Barlow'")&&css.includes('color:#FF7A1A;border-bottom-color:#FF7A1A'));
  assert.ok(css.includes('.subpage-foot a,.about-info a{color:#B48CFF;text-decoration:none}'));
});
test('round 4 items 19-22: Alerts checkboxes, consent alignment, copy, disabled-until-valid',()=>{
  assert.ok(css.includes('width:20px;height:20px;margin:0;border:2px solid #3A3046;border-radius:4px;background:#16111E'));
  assert.ok(css.includes('.alerts-page .alerts-box input[type=checkbox]:checked{background:#FF7A1A url('));
  assert.ok(css.includes('.alerts-page .alerts-box .consent{display:flex;align-items:flex-start;gap:10px;padding:10px 0 10px 17px')&&css.includes('.alerts-page .alerts-box .consent input[type=checkbox]{margin-top:3px}'));
  assert.ok(alerts.includes('Future holiday listings')&&!alerts.includes('Future Holiday'));
  assert.ok(alertsJs.includes('submitBtn.disabled=!(emailEl&&emailEl.value.trim()&&emailEl.checkValidity()&&consentEl&&consentEl.checked)'));
  assert.ok(alertsJs.includes('areaControls.hidden=!areaToggle.checked'),'area fields reveal on toggle');
});
test('round 4 items 23-25: quotes use a top border; community links not underlined; icon key has the v2 type icons',()=>{
  assert.ok(css.includes('.about-article blockquote{margin:24px 0;padding:20px;border-left:0;border-top:3px solid #B48CFF;border-radius:0;background:#1A1322}'));
  assert.ok(css.includes("font:italic 500 19px/1.5 'Barlow'"));
  assert.equal((about.match(/assets\/icons\/v2\/icon-(display|treat-stop|event)\.svg/g)||[]).length,3);
});

test('photo card (Photo Card design): one-cell grid, front sets the height, photo absolute, pill on the title row, inert faces',()=>{
  assert.ok(css.includes('.card--compact.card--flip .card-flip__inner{display:grid}')&&css.includes('.card-flip__inner{grid-template-columns:minmax(0,1fr)}'));
  assert.ok(css.includes('.card--compact.card--flip .card__photo{position:absolute;inset:0;width:100%;height:100%;min-height:0;object-fit:contain'),'the image never sets the height');
  assert.ok(css.includes('.card--compact.card--flip .card__heading{display:flex;align-items:center;gap:8px;min-width:0}')&&css.includes('white-space:nowrap;vertical-align:baseline}'),'pill on the title row, never wraps');
  assert.ok(css.includes('html body #cardList .card--compact.card--flip>.card-flip{margin-left:0}'),'the 36px indent rule must not shift the flipper');
  const flip=read('card-flip.js');
  assert.ok(flip.includes('front.inert=flipped')&&flip.includes('back.inert=!flipped')&&flip.includes('back.inert=true;'),'hidden face is inert');
  assert.ok(flip.includes("img.dataset.src=hfPhotoURL(num)")&&flip.includes('photo.src=photo.dataset.src'),'photo loads on first flip');
  assert.ok(flip.includes("img.alt='Photo of '+nameText"),'alt text per spec');
  assert.ok(flip.includes("next.focus({preventScroll:true})"),'focus handoff');
});

test('photo-never-cropped fix (PHOTO-PORTRAIT-FIX.md): contain on #0E0B13 in the card back and the 16:9 popup, EXIF-upright uploads',()=>{
  assert.ok(css.includes('.map-popup__photo{height:auto;aspect-ratio:16/9;background:#0E0B13;overflow:hidden}'));
  assert.ok(css.includes('.map-popup__photo img{width:100%;height:100%;object-fit:contain;object-position:center;image-orientation:from-image;display:block}'));
  assert.ok(css.includes('object-fit:contain;object-position:center;image-orientation:from-image;display:block;flex:none}'),'card back photo');
  assert.ok(css.includes('border-radius:inherit;background:#0E0B13}'),'card back face background');
  assert.ok(!/\.(card__photo|map-popup__photo img)\{[^}]*object-fit:cover/.test(css),'no cropping photo rule remains');
  assert.ok(!css.includes('filter:blur')||!/photo[^{]*\{[^}]*blur/.test(css),'bars are not filled with a blurred copy');
  const h=read('host-update-ui.js');
  assert.ok(h.includes("createImageBitmap(file,{imageOrientation:'from-image'})")&&h.includes('const upFile=await hfNormalizePhoto(file)'),'JPEGs are re-drawn upright before upload');
  assert.ok(h.includes("contentType:upFile.type")&&h.includes("contentType:upFile.type,toke")||h.includes('contentType:upFile.type'),'the normalized type is what is uploaded');
});

test('photo lightbox (PHOTO-PORTRAIT-FIX.md section 2): trigger buttons, overlay spec, every close path, mobile swipe + pinch',()=>{
  const lb=read('photo-lightbox.js'),flip=read('card-flip.js'),pu=read('photos-ui.js'),idx=read('index.html');
  assert.ok(idx.includes('<script src="photo-lightbox.js"></script>')&&idx.indexOf('photo-lightbox.js')<idx.indexOf('photos-ui.js'),'module loads before photos-ui');
  assert.equal(idx.includes('<dialog'),false,'the homepage keeps no <dialog>; the overlay is a div role=dialog built on demand');
  assert.ok(flip.includes("'View larger photo of '+nameText")&&flip.includes("photoBtn.className='photo-trigger card__photo-btn'"),'card back trigger');
  assert.ok(pu.includes("'View larger photo of '+nm")&&pu.includes("btn.className='photo-trigger map-popup__photo-btn'"),'popup trigger');
  assert.ok(lb.includes("setAttribute('role','dialog')")&&lb.includes("setAttribute('aria-modal','true')"),'dialog semantics');
  assert.ok(lb.includes("e.key==='Escape'")&&lb.includes("history.pushState({hfLightbox:1}")&&lb.includes("addEventListener('popstate'")&&lb.includes('.lightbox__close'),'x, Esc, Back');
  assert.ok(lb.includes('d>80')&&lb.includes('visualViewport.scale>1.02'),'swipe down over 80px, not while pinch-zoomed');
  assert.ok(lb.includes('t.focus({preventScroll:true})')&&lb.includes("closeBtn.focus"),'focus to x on open, back to the trigger on close');
  assert.ok(css.includes('.lightbox{position:fixed;inset:0;z-index:3000;')&&css.includes('background:rgba(8,6,12,.94)'),'full-screen overlay above the map');
  assert.ok(css.includes('max-height:calc(100dvh - 140px)')&&css.includes('touch-action:pinch-zoom')&&css.includes('html.lightbox-open,html.lightbox-open body{overflow:hidden}'),'fit, pinch zoom, scroll lock');
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce){.lightbox{transition:none}}')&&css.includes('transition:opacity .15s ease'),'150ms fade, none for reduced motion');
  assert.ok(css.includes('.photo-trigger__icon{position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:50%;background:rgba(11,9,16,.7)'),'28px corner icon');
});

test('filters are collapsed by default at every width (set before first paint, so the map is created at its final width)',()=>{
  const idx=read('index.html');
  assert.ok(idx.indexOf("document.documentElement.dataset.rail='collapsed'")>0&&idx.indexOf("document.documentElement.dataset.rail='collapsed'")<idx.indexOf('<body'),'inline head script');
  assert.ok(chrome.includes('railSetCollapsed(true)')&&!chrome.includes('innerWidth<1100'));
});

test('host photos publish immediately: no approval step (Minerva, 2026-10-16)',()=>{
  const up=read('api/upload.js');
  assert.ok(up.includes("status:'approved',uploadedAt")&&!up.includes("status:'pending'"),'upload API stores approved records');
  assert.ok(read('api/photos.js').includes("p.status==='approved'"),'the public API shows approved records');
  assert.ok(up.includes('adminAuthorized(req)')&&up.includes('listingForHostToken'),'still only a verified host or the admin can upload');
  assert.ok(up.includes('MAX_MINTS_PER_HOUR=10')&&up.includes("ALLOWED_TYPES=['image/jpeg','image/png','image/webp','image/gif']")&&up.includes('MAX_BYTES=5*1024*1024'),'type, size and rate limits unchanged');
});

test('collapsed filter panel: stacking/sticky rules never override display:none',()=>{
  assert.ok(css.includes('html[data-rail="collapsed"] .filter-rail .filters,html[data-rail="collapsed"] .filter-rail .filter-rail__links,html[data-rail="collapsed"] .filter-rail .filter-rail__section{display:none!important}'));
  assert.ok(css.lastIndexOf('html[data-rail="collapsed"] .filter-rail .filters,')>css.indexOf('.filter-rail .filters{display:flex;flex-direction:column;justify-content:flex-start'),'override comes after the round 4 stacking rule');
});
