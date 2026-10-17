const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const html=read('listing.html'),pageJs=read('page.js'),css=read('styles.css'),vercel=JSON.parse(read('vercel.json')),verify=read('scripts/verify-live.js');
const L=require('../listing.js');
const appSrc=read('app.js');
const {listings}=L.loadListingData(appSrc);
const real=n=>listings.find(x=>x.num===n);

// ---- Route parser/validator: explicit listing ids only ----
test('listing route: accepts an explicit, known id and returns that exact record',()=>{
  const r=L.parseListingParams('?id=12',listings);
  assert.equal(r.ok,true);assert.equal(r.listing.name,'Harvesters of Souls');
  assert.equal(L.parseListingParams('?id=1&foo=bar',listings).listing.num,1,'extra params ignored');
});
test('listing route: rejects missing, malformed, unknown and placeholder ids without guessing',()=>{
  for(const q of ['','?id=','?id=abc','?id=1.5','?id=-1','?id=0','?id=12abc','?id=999','?id=1&id=2','?house=12'])
    assert.equal(L.parseListingParams(q,listings).ok,false,q+' must be rejected');
  const vacant=listings.find(x=>x.placeholder);
  if(vacant)assert.equal(L.parseListingParams('?id='+vacant.num,listings).ok,false,'vacant slot rejected');
});
test('listing route: reused slot #8 needs its entity id, like the homepage deep link',()=>{
  assert.equal(L.parseListingParams('?id=8',listings).ok,false);
  assert.equal(L.parseListingParams('?id=8&entity=wrong',listings).ok,false);
  const ok=L.parseListingParams('?id=8&entity='+encodeURIComponent(real(8).entityId),listings);
  assert.equal(ok.ok,true);assert.equal(ok.listing.name,'Drakestown Road Display');
});
test('listing route: section hash is whitelisted',()=>{
  assert.deepEqual(L.SECTIONS,['feedback','report-update','share']);
  assert.equal(L.parseSection('#share'),'share');assert.equal(L.parseSection('#report-update'),'report-update');
  assert.equal(L.parseSection('#<script>'),null);assert.equal(L.parseSection(''),null);
});

// ---- Sharing ----
test('share: link carries the listing id and entity for reused slots; post names the listing',()=>{
  assert.equal(L.houseLink(real(12),false),'https://hauntfinder.vercel.app/?house=12');
  assert.match(L.houseLink(real(8),true),/\?house=8&entity=drakestown-road-2026$/);
  const post=L.housePost(real(12),L.houseLink(real(12),false),'https://forms.gle/x');
  assert.match(post,/Harvesters of Souls/);assert.match(post,/11 Jackson Ave/);assert.match(post,/\?house=12/);
});

// ---- Listing report: prepares an email, never submits private data ----
test('report: validates closures and builds a mailto for organizer review',()=>{
  const h=real(12);
  assert.match(L.reportMailto(h,{type:'Weather cancellation',from:'2026-10-20',through:'2026-10-19',notes:''}).error,/end date/i);
  assert.match(L.reportMailto(h,{type:'Incorrect listing details',from:'',through:'',notes:'  '}).error,/details/i);
  const ok=L.reportMailto(h,{type:'Weather cancellation',from:'2026-10-20',through:'2026-10-21',notes:'Rain'});
  assert.ok(ok.href.startsWith('mailto:MTOCommunityFinder@gmail.com?subject='));
  const body=decodeURIComponent(ok.href.split('&body=')[1]);
  assert.match(body,/Harvesters of Souls/);assert.match(body,/Affected dates: 2026-10-20 through 2026-10-21/);assert.match(body,/\?house=12/);
});

// ---- Page markup ----
test('listing.html: ordinary page on the shared shell, no dialogs, one h1, three addressable sections',()=>{
  assert.equal(html.includes('<dialog'),false);
  assert.match(html,/<body data-page="listing" class="subpage">/);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  for(const id of ['feedback','report-update','share'])assert.match(html,new RegExp('<section[^>]+id="'+id+'"'),id+' section');
  assert.match(html,/id="siteChrome" data-chrome-active="listing"/,'shared header');
  assert.match(html,/href="index\.html\?category=displays">Displays</,'category links back to the map');
  assert.match(html,/<noscript>/,'JavaScript-disabled message with a way back');
  assert.match(html,/<script src="routing\.js"><\/script>/);assert.match(html,/<script src="listing\.js"><\/script>/);
  assert.match(html,/id="feedbackForm"/);assert.match(html,/id="listingReportForm"/);assert.match(html,/id="houseShareText"/);
  assert.match(html,/class="honeypot"/,'feedback honeypot kept');
});
test('page shell: listing is a registered route; feedback API contract unchanged',()=>{
  assert.match(pageJs,/const ROUTES = \['submit', 'about', 'listing', 'route'\]/);
  assert.match(css,/\.listing-page/);
  assert.match(read('listing.js'),/\/api\/feedback/);
  assert.ok(vercel.functions['api/feedback.js']);
});
test('live QA gate: verify-live checks the listing page',()=>{
  assert.match(verify,/listing\.html\?id=12/);
});
