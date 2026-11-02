// Page-first plan step 5: the homepage keeps no dialogs. The card Rate,
// Report and Share actions are same-tab links to the approved /listing.html
// sections (#feedback, #report-update, #share); the feedback, listing-report
// and house-share dialogs, their controllers and their styles are removed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const index=read('index.html'),app=read('app.js'),community=read('community.js'),sharing=read('sharing.js'),css=read('styles.css'),listingHtml=read('listing.html');

test('homepage has no <dialog> elements',()=>{
  assert.equal(index.includes('<dialog'),false);
  for(const id of ['feedbackDialog','listingReportDialog','houseShareDialog','routeSheet'])assert.equal(index.includes(`id="${id}"`),false,id);
});
test('card Rate, Report and Share are same-tab links to the listing page sections',()=>{
  assert.match(app,/function listingPageHref\(x\)\{return 'listing\.html\?id='\+x\.num\+\(isReusedSlot\(x\)\?'&entity='\+encodeURIComponent\(x\.entityId\):''\)\}/,'reused slots keep their entity');
  for(const tpl of ['function treatCardHTML','function cardHTML']){
    const body=app.split(tpl)[1].split('\nfunction ')[0];
    if(tpl==='function cardHTML')assert.match(body,/<a class="card-rating" href="\$\{listingPageHref\(x\)\}#feedback" data-rating-summary="\$\{x\.num\}"/,tpl+' rating link');
    assert.match(body,/<a class="card__metalink" href="\$\{listingPageHref\(x\)\}#report-update">Report<\/a>/,tpl+' report link');
    assert.match(body,/<a class="card__metalink" href="\$\{listingPageHref\(x\)\}#share">Share<\/a>/,tpl+' share link');
    assert.equal(/data-(feedback|report-listing|share-house)=/.test(body),false,tpl+' no dialog openers');
    assert.equal(body.includes('target="_blank"')&&/#(feedback|report-update|share)"[^>]*target=/.test(body),false,'same tab');
  }
  for(const id of ['feedback','report-update','share'])assert.match(listingHtml,new RegExp('<section[^>]+id="'+id+'"'),'listing page has #'+id);
});
test('dialog controllers removed; rating summaries, share-this-site and ?house= deep links kept',()=>{
  for(const s of ['feedbackDialog','showModal','openFeedback','listingReportForm','data-close-dialog'])assert.equal(community.includes(s),false,'community.js drops '+s);
  assert.match(community,/function paintRatingSummaries\(\)/,'card ratings still painted');
  assert.match(community,/fetch\('\/api\/feedback\?summary=1'\)/,'read-only batched rating fetch kept');
  assert.match(community,/shareSiteBtn\.onclick=/,'share this site kept');
  for(const s of ['houseShareDialog','openHouseShare','showModal','saveHouseImage'])assert.equal(sharing.includes(s),false,'sharing.js drops '+s);
  assert.match(sharing,/selectListing\(linkedHouse\)/,'?house= deep link kept');
  assert.match(sharing,/Display #8 is now Drakestown Road Display/,'reused-slot note kept');
});
test('dialog styles removed',()=>{
  for(const s of ['.site-dialog','.dialog-head','.dialog-close','.dialog-subtitle','.feedback-tabs','body:has(dialog[open])'])assert.equal(css.includes(s),false,s);
});
test('live QA gate: verify-live checks the homepage carries no dialogs',()=>{
  assert.match(read('scripts/verify-live.js'),/homepage has no dialogs; card actions link to the listing page sections/);
});
