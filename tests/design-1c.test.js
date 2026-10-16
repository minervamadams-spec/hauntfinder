const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const layout=fs.readFileSync(path.join(ROOT,'layout.js'),'utf8');
const community=fs.readFileSync(path.join(ROOT,'community.js'),'utf8');
const photos=fs.readFileSync(path.join(ROOT,'photos-ui.js'),'utf8');
const flip=fs.readFileSync(path.join(ROOT,'card-flip.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const {flyerURLForEvent}=require('../card-flip.js');

const displayCard=app.split('function cardHTML')[1].split('function dateFilterChipsHTML')[0];
const treatCard=app.split('function treatCardHTML')[1].split('function cardHTML')[0];
const eventCard=layout.split('function eventCard')[1].split('function calendar()')[0];

test('listing card anatomy order: pin, name, town line, address link, hours row (with Host notes), tags (with scare level), actions, meta',()=>{
  const order=['${pinHTML(x.num,isTreatStop(x)?\'treat\':\'display\')}','card__name','card__subline','card__address','card__hours-row','card__hours','card__notes','card__tags','card__scare','card__actions','card__meta'];
  let at=0;
  for(const s of order){const i=displayCard.indexOf(s,at);assert.ok(i>=0,'display card missing or out of order: '+s);at=i+1}
});

test('removed card elements stay gone: Directions buttons, Updated dates, old labels',()=>{
  for(const src of [displayCard,treatCard]){
    assert.ok(!src.includes('btn--directions'),'no per-card Directions button');
    assert.ok(!src.includes('listingUpdatedHTML(x)'),'no Updated date');
    assert.ok(!src.includes("'>Updated<'"),'no Updated text');
    assert.ok(!src.includes('Added ✓'),'old route label gone');
    assert.ok(!src.includes('+ Add to Route'),'old route label gone');
  }
  assert.ok(css.includes('listing-updated'),'legacy style rule may remain unused');
});

test('route button: + Add to route → ✓ On your route, lime then cream; pin ✓ on route',()=>{
  assert.ok(displayCard.includes("onRoute?'✓ On your route':'+ Add to route'"));
  assert.ok(css.includes('.card__route-btn{min-height:48px;justify-content:center;background:var(--lime)'),'lime full-width route button');
  assert.ok(css.includes('.card__route-btn[aria-pressed="true"]{background:#F6EBD3;border-color:#F6EBD3;color:#0B0910}'),'cream on-route state');
  assert.ok(css.includes('.card--on-route{border-color:var(--lime)}'),'lime card border on route');
  assert.ok(css.includes('.card--on-route .pin__badge{display:block}'),'pin badge on route cards');
  assert.ok(app.includes('data-route="${x.num}"')&&app.includes('toggleRoute(n)'),'route toggle wiring untouched');
});

test('address is the purple directions link with ↗ and an accessible name',()=>{
  assert.ok(displayCard.includes('class="card__address" href="${gmapsDirections(x.address)}" target="_blank" rel="noopener" aria-label="Directions to ${safeListingText(x.name)}"'),'display address link contract');
  assert.ok(displayCard.includes('${safeListingText(x.address)} ↗'),'address text ends with ↗');
  assert.ok(css.includes('.card__address{')&&css.includes('color:var(--purple)'),'purple link styling');
});

test('tags: icon-only 26px circles (title + aria-label) where the mock has an icon; filter chips carry icons',()=>{
  assert.ok(displayCard.includes("hfTagHTML(t,'chip--type')")&&displayCard.includes('x.features.map(v=>hfTagHTML(v))')||displayCard.includes('featureChip'),'display cards use the shared tag renderer');
  assert.ok(css.includes('.chip--icon{width:26px;height:26px;min-height:26px!important;padding:0!important;border-radius:13px!important'),'26px circular icon tags');
  const cf=fs.readFileSync(path.join(ROOT,'chrome-filters.js'),'utf8');
  assert.ok(cf.includes('hfIconSVG(value)'),'rail filter chips render an icon when one exists');
});

test('meta row: 13px with divider, rating left, Report/Share right; Host notes lives on the hours row',()=>{
  assert.ok(css.includes('.card__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line);font:500 13px var(--f-body);color:var(--text-3)}'),'meta row styling');
  assert.ok(displayCard.indexOf('#report-update">Report</a>')<displayCard.indexOf('#share">Share</a>'),'Report before Share');
  assert.ok(displayCard.includes('<summary>Host notes</summary>'),'Host notes link kept as collapsed details');
  assert.ok(displayCard.indexOf('<summary>Host notes</summary>')<displayCard.indexOf('card__tags'),'Host notes sits on the hours row, above the tags');
  assert.ok(displayCard.includes('data-rating-summary="${x.num}"')&&displayCard.includes('href="${listingPageHref(x)}#feedback"'),'rating summary kept; it links to the listing feedback section');
});

test('ratings render in the spec format with orange stars',()=>{
  assert.ok(community.includes('★★★★★'),'star row for rated listings');
  assert.ok(community.includes('${summary.average} · ${summary.count} ratings'),'"4.8 · 12 ratings" format');
  assert.ok(community.includes('No ratings yet · <span class="card-rating__rate">Rate</span>'),'empty-state format');
  assert.ok(css.includes('.card-rating__stars{color:var(--orange)'),'orange stars');
  assert.ok(community.includes("fetch('/api/feedback?house='+house.num)"),'public ratings fetch unchanged');
});

test('OPEN TONIGHT and scare level follow the spec (lime label; scare desktop-only)',()=>{
  assert.ok(displayCard.includes('openTonightBadgeHTML(x,{eligible:openTonightOK})'),'open-tonight gate preserved');
  assert.ok(css.includes('.card__open-tonight{')&&css.includes('color:var(--lime);font:700 13px/1.3 var(--f-cond)'),'lime OPEN TONIGHT label');
  assert.ok(css.includes('@media(max-width:767px){.card__tags .card__scare{display:none}}'),'scare level hidden on mobile');
});

test('photo flip mechanics: pill, Y rotation, perspective, backface, reduced-motion crossfade',()=>{
  assert.ok(flip.includes("'↻ Photo'"),'photo pill label');
  assert.ok(flip.includes("'↻ Details'"),'details flip-back label');
  assert.ok(flip.includes('hfPhotoHas')&&flip.includes('dataset.flipReady'),'pill/flip gated on the photo index');
  assert.ok(flip.includes("className='card__photo'")&&flip.includes("img.loading='lazy'"),'lazy photo on the back face');
  assert.ok(css.includes('.card-flip{perspective:1400px}'),'1400px perspective');
  assert.ok(css.includes('transition:transform .6s cubic-bezier(.3,.7,.3,1);transform-style:preserve-3d'),'600ms spec easing');
  assert.ok(css.includes('.card--flip.is-flipped .card-flip__inner{transform:rotateY(180deg)}'),'rotateY flip');
  assert.ok(css.includes('backface-visibility:hidden'),'backface hidden');
  assert.ok(css.includes('grid-area:1/1'),'faces share one grid cell (equal height)');
  assert.ok(css.includes('.card__photo{flex:1;width:100%;min-height:240px;object-fit:cover'),'photo fills the card');
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),'reduced-motion block');
  assert.ok(css.includes('transition:opacity 150ms ease'),'150ms crossfade');
});

test('photos pipeline: API contract, session cache, peek strip preserved',()=>{
  assert.ok(photos.includes("fetch('/api/photos?num='+num)"),'photos API path unchanged');
  assert.ok(photos.includes('window.hfPhotoHas')&&photos.includes('window.hfPhotoURL'),'session index exported');
  assert.ok(photos.includes('window.hfFetchPhotos'),'cached per-listing fetch');
  assert.ok(photos.includes("img.loading='lazy'"),'lazy images');
  assert.ok(photos.includes("e.key==='Escape'"),'lightbox Esc preserved');
  assert.ok(photos.includes('inCurrentSeason(listing)'),'season gate preserved');
  assert.ok(photos.includes('.catch(()=>{})'),'fetch failure renders nothing');
  assert.ok(photos.includes('[data-peek-photo]'),'K4 popup photo slot preserved');
  assert.ok(html.indexOf('card-flip.js')>html.indexOf('photos-ui.js'),'card-flip loads after photos-ui');
});

test('event card: spec type colors with 4px top border and filled type pill',()=>{
  assert.ok(layout.includes("function eventColor(x){return {'Trunk-or-treat':'#FF7A1A',Parade:'#B48CFF',Festival:'#A6E22E','Donation drive/Community collection':'#7B3FE4',Other:'#3FD0C0'}"),'type color map (Donation drive = purple-deep, spec-silent)');
  assert.ok(css.includes('.event-card{display:flex;flex-direction:column;gap:10px;padding:16px;border-top:4px solid var(--event-color'),'4px type top border');
  assert.ok(css.includes('.event-type-pill{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:var(--event-color'),'26px filled pill');
  assert.ok(css.includes('letter-spacing:.06em;text-transform:uppercase'),'pill uppercase');
  assert.ok(css.includes('.event-card__datetime{margin:0;font:700 19px/1.25 var(--f-body)'),'Barlow 700 19px date/time');
  assert.ok(!eventCard.includes('calendar'),'no per-card calendar button');
});

test('flyer flip: contain, letter aspect, whole flyer; synthetic record resolves URL',()=>{
  assert.equal(flyerURLForEvent({flyer:'https://example.test/flyer.png'}),'https://example.test/flyer.png');
  assert.equal(flyerURLForEvent({photo:'https://example.test/photo.jpg'}),'https://example.test/photo.jpg');
  assert.equal(flyerURLForEvent({name:'No flyer yet'}),null,'no fake data needed');
  assert.ok(css.includes('.card__flyer{flex:1;width:100%;min-height:0;aspect-ratio:8.5/11;object-fit:contain'),'contain + 8.5:11, never cropped');
  assert.ok(eventCard.includes('↻ Flyer'),'flyer pill');
  assert.ok(eventCard.includes('card--flip')&&eventCard.includes('card__flyer'),'flyer flip scaffolding');
  assert.ok(eventCard.includes('data-flip-open')&&eventCard.includes('data-flip-close'),'flip triggers');
});

test('event report/share: mailto report and shareable event link',()=>{
  assert.ok(eventCard.includes('mailto:MTOCommunityFinder@gmail.com?subject='),'event report path');
  assert.ok(eventCard.includes('data-share-event="${safeListingText(x.id)}"'),'event share button');
  assert.ok(flip.includes('?category=events&event='),'share link uses the existing URL contract');
});

test('favorites storage unchanged; card actions link to the listing page sections',()=>{
  assert.ok(app.includes('hffavs:v1'),'favorites storage key untouched');
  assert.ok(app.includes('data-fav="${x.num}"'),'favorite buttons kept');
  for(const h of ['#feedback','#report-update','#share'])assert.ok(app.includes('href="${listingPageHref(x)}'+h+'"'),h+' link');
  assert.ok(!community.includes('[data-feedback]')&&!community.includes('[data-report-listing]'),'dialog hooks removed');
});

test('app.js public-data preamble hash is untouched by the card edits',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});

test('card layout spec: scare level leads the tags row; route button 30px / min 118px / 13px',()=>{
  assert.ok(displayCard.includes('<div class="card__tags">${x.levels.length?`<span class="card__scare">'),'scare level is first in the tags row');
  assert.ok(!displayCard.includes('card__scare-row'),'no separate scare row');
  const meta=displayCard.split('<div class="card__meta">')[1];
  assert.ok(!meta.includes('card__notes'),'Host notes is not in the meta row');
  assert.ok(css.includes('height:30px;min-height:30px!important;min-width:118px;padding:0 9px;font-size:13px'),'route button sizing');
});
