const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const photos=fs.readFileSync(path.join(ROOT,'photos-ui.js'),'utf8');
const pinDisplay=fs.readFileSync(path.join(ROOT,'assets/icons/v2/pin-display.svg'),'utf8');
const pinTreat=fs.readFileSync(path.join(ROOT,'assets/icons/v2/pin-treat-stop.svg'),'utf8');
const pinEvent=fs.readFileSync(path.join(ROOT,'assets/icons/v2/pin-event.svg'),'utf8');
const badge=fs.readFileSync(path.join(ROOT,'assets/icons/badge-on-route.svg'),'utf8');

/* ---- Pins (spec 8.7) ---- */
test('pin SVGs are the supplied artwork with the pointed tip',()=>{
  [pinDisplay,pinTreat,pinEvent].forEach((svg,i)=>assert.ok(svg.includes('viewBox="0 0 128 156"'),'pin '+(i+1)+' keeps the v2 128x156 artboard'));
  assert.ok(badge.includes('viewBox="0 0 24 24"'),'badge artboard');
  assert.equal(app.includes('pumpkin-pin.svg'),false,'legacy inline pumpkin artwork retired');
});

test('divIcon anatomy: SVG + number + badge compose per pin; treats use the candy art',()=>{
  assert.ok(app.includes("function pinHTML(n,kind)"),'kind-aware pin builder');
  assert.ok(app.includes("assets/icons/v2/pin-${kind==='treat'?'treat-stop':'display'}.svg"),'kind picks the SVG source');
  assert.ok(app.includes("assets/icons/badge-on-route.svg"),'badge source');
  assert.ok(app.includes('L.divIcon'),'pins compose through divIcon');
  assert.ok(app.includes('iconSize:[w,h],iconAnchor:[w/2,h-1]'),'bottom-tip anchor (v2 README: 34x41, anchor 17,40)');
  assert.ok(app.includes('function pinHeight(w){return Math.round(w*156/128)}'),'height = width x 156/128');
  assert.ok(app.includes("matchMedia('(max-width:767px)').matches?30:34"),'30px mobile / 34px desktop');
  assert.ok(app.includes("cardIconHTML(isTreatStop(x)?'treat':'display')"),'cards pass the icon kind');
  assert.ok(app.includes("iconFor(x.num,isTreatStop(x)?'treat':'display')"),'markers pass the pin kind');
});

test('number style: Barlow Condensed 800, ~40% of pin width, #0B0910 with 1px white outline',()=>{
  const num=css.match(/\.pin__num\{[^}]*\}/)[0];
  assert.ok(num.includes("800 11px/1 var(--f-cond)"),'mobile 11px ≈ 40% of 28px, condensed 800');
  assert.ok(num.includes('color:#0B0910'),'dark number');
  assert.ok(num.includes('text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff'),'1px white outline from multi-direction text-shadow');
  assert.ok(css.includes('@media(min-width:768px){.pin{width:38px;height:44px}.pin__num{font-size:15px}}'),'desktop 15px ≈ 40% of 38px');
});

test('on-route badge: lime circle shown only when on route, ~42% of pin width',()=>{
  const b=css.match(/\.pin__badge\{[^}]*\}/)[0];
  assert.ok(b.includes('display:none'),'hidden by default');
  assert.ok(b.includes('width:42%'),'~42% of pin width');
  assert.ok(css.includes('.pin.is-on-route .pin__badge{display:block}'),'shown on route');
  assert.ok(css.includes('.card--on-route .pin__badge{display:block}'),'card pins show it too');
  assert.ok(css.includes('.pin{')&&css.match(/\.pin\{[^}]*drop-shadow\(0 3px 5px rgba\(0,0,0,\.55\)\)/),'spec drop shadow');
});

/* ---- Map key + distances note ---- */
test('map key: bottom-left, spec chrome, exactly four 24px rows',()=>{
  assert.match(css,/\.map-key\{[^}]*left:12px[^}]*bottom:12px/,'anchored bottom-left on the map');
  const panel=css.match(/\.map-key__panel\{[^}]*\}/)[0];
  assert.ok(panel.includes('rgba(11,9,16,.94)')&&panel.includes('1px solid var(--line-2)')&&panel.includes('border-radius:8px'),'spec panel chrome');
  assert.match(css,/\.map-key__title\{[^}]*uppercase/,'MAP KEY-style title');
  const rows=html.split('id="mapKeyPanel"')[1].split('</ul>')[0];
  assert.equal((rows.match(/<li>/g)||[]).length,4,'exactly four rows');
  ['v2/pin-display.svg','v2/pin-treat-stop.svg','v2/pin-event.svg','badge-on-route.svg'].forEach(src=>assert.ok(rows.includes(src),src));
  ['Display','Treat stop','Event on your route','On your route'].forEach(l=>assert.ok(rows.includes('>'+l+'<'),l));
  assert.match(css,/\.map-key__rows img\{[^}]*width:24px/,'24px icons');
});

test('mobile: key collapses to a "Map key" toggle that flips data-mapkey',()=>{
  assert.match(html,/id="mapKeyToggle" aria-expanded="false"/,'collapsed by default');
  assert.ok(html.includes('Map key <span aria-hidden="true">▾</span>'),'toggle carries the ▾ affordance');
  assert.match(css,/@media\(max-width:959px\)\{[^}]*\.map-key__toggle\{display:inline-flex\}/,'toggle visible on mobile');
  assert.ok(css.includes('html[data-mapkey] .map-key__panel{display:block}'),'panel expands under data-mapkey');
  assert.ok(layout.includes("root.setAttribute('data-mapkey','')"),'toggle flips the state');
  assert.ok(layout.includes("mapKeyToggle.setAttribute('aria-expanded','true')"),'aria-expanded syncs');
  assert.ok(layout.includes("root.removeAttribute('data-mapkey')"),'tab switch collapses the key');
});

test('distances note: once, bottom-right, no per-card straight-line text',()=>{
  assert.equal((html.match(/Distances are straight-line/g)||[]).length,1,'appears exactly once in markup');
  assert.match(css,/\.map-note\{[^}]*right:12px[^}]*bottom:12px/,'anchored bottom-right on the map');
  assert.equal(app.includes('mi away (straight line)'),false,'no per-card caveat');
  assert.equal(html.includes('distance-help'),false,'old long-form note retired');
});

/* ---- K4 popup ---- */
test('popup anatomy: 280px shell, 130px conditional photo, name, meta, add, × close',()=>{
  assert.match(css,/\.map-popup\{[^}]*width:280px/,'280px wide');
  assert.ok(css.indexOf('.map-popup{width:100%}')>css.indexOf('width:280px'),'mobile full-width override cascades after the 280px base');
  const photo=css.match(/\.map-popup__photo\{[^}]*\}/)[0];
  assert.ok(photo.includes('height:130px'),'photo area 130px tall');
  assert.ok(css.includes('.map-popup__photo:empty{display:none}'),'photo section omitted when there is no photo');
  assert.match(css,/\.map-popup__name\{[^}]*var\(--f-cond\)/,'condensed name');
  assert.ok(css.includes('.map-popup__add{width:100%}'),'add-to-route full width');
  const close=css.match(/\.map-popup__close\{[^}]*\}/)[0];
  assert.ok(close.includes('width:44px')&&close.includes('height:44px'),'44px close target');
  assert.ok(app.includes('map-popup__close'),'close button rendered');
  assert.ok(app.includes("role=\"dialog\""),'popup is a dialog surface');
  assert.ok(app.includes('data-peek-photo'),'photo slot for loadPeekPhotos');
  assert.ok(photos.includes("[data-peek-photo]"),'photo loader fills the slot');
  assert.ok(photos.includes("data.photos[0].url"),'one owner photo per K4');
});

test('single popup surface: one #mapPeek, reused; meta line is Town · distance · ★ rating',()=>{
  assert.equal((html.match(/id="mapPeek"/g)||[]).length,1,'one popup container');
  assert.ok(app.includes("peek.innerHTML="),'rendered by replacing the same surface');
  assert.ok(app.includes("[x.town,dist].filter(Boolean).join(' · ')"),'town · distance join');
  assert.ok(app.includes('` · ★ ${rating.average}`'),'★ rating from the existing summaries');
  assert.ok(app.includes("ratingSummaries.get(n)"),'rating lookup uses the shared summaries');
  assert.ok(app.includes('hidePeek'),'explicit close path');
});

/* ---- Treat-stop empty state (spec 7.2, D2) ---- */
test('treat empty state: verbatim copy, candy icon, lime 4px top border, both actions',()=>{
  assert.ok(app.includes('No treat stops listed within ${state.search?state.search.radius:25} mi yet'),'heading carries the live radius');
  assert.ok(app.includes('Handing out candy on Halloween? Add your home so trick-or-treaters can find you.'),'body copy verbatim');
  assert.ok(app.includes('Add your home as a treat stop'),'add-home button copy');
  assert.ok(app.includes('Try 50 mi'),'try-50 button copy');
  assert.ok(app.includes("const TREAT_FORM_URL='https://forms.gle/DTuKs27nSUWVbyf1A'"),'config treat form URL (README 9.2)');
  assert.ok(app.includes("window.open(TREAT_FORM_URL,'_blank','noopener')"),'add-home opens the form in a new tab');
  assert.ok(app.includes("new CustomEvent('hf:expand-radius',{detail:{radius:50}})"),'Try 50 mi re-runs the search at 50');
  assert.match(css,/\.treat-empty\{[^}]*border-top:4px solid var\(--lime\)/,'lime 4px top border');
  assert.ok(app.includes('treat-empty__icon'),'candy icon slot');
  assert.ok(html.includes('id="treatEmpty"'),'container in markup');
  assert.ok(app.includes("state.category==='treats'&&!visible.length&&!geoEmpty"),'shown only for an empty treat list');
});

/* ---- Event skull pins ---- */
test('event skull pins: sync from route membership, skull SVG, excluded on the events tab',()=>{
  assert.ok(app.includes('const eventMarkers=[]'),'dedicated marker layer');
  assert.ok(app.includes('function syncEventPins(){eventMarkers.forEach'),'real sync implementation');
  assert.ok(app.includes("state.route.filter(r=>r.eventId!=null)"),'only route events become pins');
  assert.ok(app.includes("pin-event.svg"),'skull artwork');
  assert.ok(app.includes("if(state.category==='events')return"),'events tab renders none');
  assert.ok(app.includes("title:`Event: ${ev.name}`"),'marker identity');
  assert.ok(app.includes('syncEventPins();wireCards()')||app.includes('syncEventPins();'),'synced from renderCards (every route change)');
  assert.ok(app.includes("m.on('click',()=>{if(typeof openEvent==='function')openEvent(ev.id)})"),'skull pin opens the event');
  assert.equal(app.includes('eventPinHTML'),false,'legacy builder retired');
});

/* ---- Map/list sync ---- */
test('pin click scrolls the card with scrollTo, never scrollIntoView',()=>{
  const fn=app.split('function selectListing')[1].split('function hidePeek')[0];
  assert.ok(fn.includes('.scrollTo({top:'),'container scrollTo used');
  assert.ok(!fn.includes('scrollIntoView'),'no scrollIntoView in selectListing');
  assert.ok(fn.includes("card.closest('.list-column')"),'list container resolved from the card');
  assert.ok(app.includes("m.on('click',()=>{selectListing(x.num,true)})"),'pin click selects + scrolls');
  assert.ok(app.includes('function linkPair'),'hover link pair kept');
  assert.ok(app.includes("m.on('mouseover',()=>linkPair(x.num,true))"),'pin hover still wired');
});

/* ---- Map view (frame 1B) ---- */
test('compact directory layout: mobile map precedes cards, desktop has results-left and sticky map-right; single map instance',()=>{
  assert.ok(css.includes('html:not([data-category="events"]) .page-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(360px,1fr)'),'desktop results-left/map-right grid');
  assert.ok(!layout.includes("saveView(v,localStorage)"),'no Map/List preference is stored');
  assert.equal((html.match(/id="map" class="hf-map"/g)||[]).length,1,'one Leaflet container');
  assert.ok(layout.includes("map.invalidateSize()"),'size refreshed on view switch');
});

/* ---- Guardrails ---- */
test('app.js preamble unchanged; storage keys and single-map rule intact',()=>{
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  const head=execSync('git show HEAD:app.js',{cwd:ROOT,encoding:'utf8'});
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble before const filters= is byte-identical to HEAD');
  assert.ok(app.includes('hfroute:2026'),'route storage key untouched');
  assert.equal(html.includes('vercel.json'),false);
});
