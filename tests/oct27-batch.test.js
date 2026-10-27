const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
function appData(){const code=read('app.js').split('const filters=')[0];return vm.runInNewContext(code+';({listings,events})')}
const sch=require('../schedules');

test('listing 108 is an owner display with a lazy photo gallery and a muted walkthrough',()=>{
  const {listings}=appData();
  const house=listings.find(x=>x.num===108);
  assert.equal(house.name,'The Asbury Park Halloween House');
  assert.equal(house.participation,'confirmed');
  assert.equal(house.source,undefined);
  assert.equal(house.entityId,'1107-ridge-avenue-asbury-park-2026');
  assert.equal(house.lat,40.224359499);
  assert.equal(house.lng,-74.025910678);
  assert.equal(house.schedule.endDate,'2026-11-01');
  assert.equal(JSON.stringify(house.photos),JSON.stringify([
    'assets/listings/asbury-park/asbury-park-1-wide.jpg',
    'assets/listings/asbury-park/asbury-park-2-dragon.jpg',
    'assets/listings/asbury-park/asbury-park-3-yard.jpg',
    'assets/listings/asbury-park/asbury-park-4-myers.jpg',
    'assets/listings/asbury-park/asbury-park-5-skeleton.jpg'
  ]));
  assert.equal(house.video.src,'assets/listings/asbury-park/asbury-park-walkthrough.mp4');
  assert.equal(house.video.poster,'assets/listings/asbury-park/asbury-park-walkthrough-poster.jpg');
  for(const file of house.photos.concat([house.video.src,house.video.poster]))assert.ok(fs.existsSync(path.join(ROOT,file)),file);
  const app=read('app.js');
  const mediaStart=app.indexOf('function listingMediaHTML');
  const media=app.slice(mediaStart,app.indexOf('function renderFilters',mediaStart));
  assert.match(media,/loading="lazy"/);
  assert.match(media,/<video controls playsinline muted preload="metadata"/);
  assert.match(media,/poster="/);
  assert.match(media,/data-gallery-photo="/);
  assert.ok(app.includes('e.stopPropagation()')&&app.includes('hfOpenGallery'),'thumbnail taps open the lightbox and do not bubble into the card');
  assert.ok(app.includes(".card__gallery video")&&app.includes("v.addEventListener('click',stop)"),'video controls are not intercepted by the card');
  assert.ok(app.includes('${listingMediaHTML(x)}'),'gallery renders on the expanded owner card');
  const card=app.split('function cardHTML')[1].split('function listingMediaHTML')[0];
  assert.ok(card.includes('<details class="card__notes"><summary>Host notes</summary>'));
  assert.equal(/<details class="card__notes" open/.test(card+media),false,'photos and notes stay collapsed until expanded');
  const blob=JSON.stringify(house);
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(blob),false);
  assert.equal(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(blob),false);
});

test('overnight hours stay open through the stated close',()=>{
  const night={weekly:[{dow:2,open:'17:30',close:'02:30'}]};
  assert.equal(sch.isOpenAt(night,'2026-10-27','18:00'),true);
  assert.equal(sch.isOpenAt(night,'2026-10-27','01:00'),true);
  assert.equal(sch.isOpenAt(night,'2026-10-27','02:30'),true);
  assert.equal(sch.isOpenAt(night,'2026-10-27','15:00'),false);
  assert.equal(sch.isOpenAt(night,'2026-10-27','03:00'),false);
  assert.equal(sch.isOpenAt({weekly:[{dow:5,open:'18:00',close:'24:00'}]},'2026-10-30','23:30'),true);
  assert.equal(sch.isOpenAt({weekly:[{dow:5,open:'18:00',close:'23:00'}]},'2026-10-30','23:30'),false);
});

test('My location flies the map to zoom 12 and keeps the list on that search',()=>{
  const app=read('app.js');
  const loc=read('location.js');
  assert.match(loc,/mode:'device'/);
  assert.match(app,/e\.detail\.mode==='device'&&Number\.isFinite\(e\.detail\.lat\)&&Number\.isFinite\(e\.detail\.lng\)\)map\.flyTo\(\[e\.detail\.lat,e\.detail\.lng\],12\)/);
  assert.match(app,/renderCards\(\)/);
});

test('Macaroni KID West Morris credit is a new-tab link',()=>{
  const html=read('index.html');
  const href='https://westmorris.macaronikid.com/articles/6ae097b93191ed989862bc2c/find-your-local-haunts';
  assert.ok(html.includes(`href="${href}" target="_blank" rel="noopener">As featured in Macaroni KID West Morris</a>`));
  assert.ok(html.includes('class="intro-strip__copy"')&&html.indexOf(href)>html.indexOf('class="intro-strip__copy"'));
});

test('new Garden State Circle rows are census-exact and the two non-matches are absent',()=>{
  const {listings,events}=appData();
  assert.equal(listings.length,117);
  assert.equal(events.length,33);
  const skeletons=listings.find(x=>x.num===117);
  assert.equal(skeletons.geoVerified,'census-exact 2026-10-27: 948 US HWY 202, BRIDGEWATER, NJ, 08807');
  const blob=JSON.stringify({listings,events});
  assert.equal(blob.includes('Palisades Park'),false);
  assert.equal(blob.includes('Woodbridge Center'),false);
  assert.equal(blob.includes('FrightMaps'),false);
  assert.ok(events.some(e=>e.id==='howl-o-ween-turtle-back-zoo-2026-10-31'&&e.startAt.endsWith('-04:00')));
});
