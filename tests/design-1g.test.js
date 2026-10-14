const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const community=fs.readFileSync(path.join(ROOT,'community.js'),'utf8');
const alertsLink=fs.readFileSync(path.join(ROOT,'alerts-link.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const alertsCss=fs.readFileSync(path.join(ROOT,'alerts.css'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const footer=html.split('<footer class="hf-footer">')[1].split('</footer>')[0];
const FORMS={
  // Verified 2026-10-14 by opening each link (handoff README had them swapped):
  // ...krfQ = Event form, ...xdg9a6g = Display form.
  display:'https://docs.google.com/forms/d/e/1FAIpQLSeifnGQbKmB1ofTT1Kb1EsY-aCxo-164AXIr5sIvA-xdg9a6g/viewform',
  treat:'https://docs.google.com/forms/d/e/1FAIpQLScSaoQ7UuSMwxyiDMEQYxXg6HyQhXep_CyEFjYgD7nwQ3kq-w/viewform',
  event:'https://docs.google.com/forms/d/e/1FAIpQLSeGXPJkGkuaRNOC2QXToVD3L85mXez9xYpKJd4ij7P0lskrfQ/viewform'};

test('footer row 1: heading, a single picker button, no raw form links',()=>{
  assert.match(footer,/<h2>Want to be added or update your listing\?<\/h2>/);
  assert.equal((footer.match(/btn--form/g)||[]).length,0,'old three form buttons gone');
  assert.equal(footer.includes('forms.gle'),false,'no raw form links in the footer');
  assert.match(footer,/<button class="btn btn--route" type="button" id="typePickerBtn">Submit or update a listing<\/button>/);
  assert.match(css,/\.hf-footer \.footer-inner \.btn--route\{min-height:52px\}/,'primary action is 52px tall');
});

test('footer row 2: About · Get alerts · Share this site · counter · Contact us in order',()=>{
  const order=[footer.indexOf('id="aboutBtn"'),footer.indexOf('data-alerts-link'),footer.indexOf('id="shareSiteBtn"'),footer.indexOf('id="siteVisits"'),footer.indexOf('mailto:mtocommunityfinder@gmail.com')];
  assert.deepEqual(order,[...order].sort((a,b)=>a-b),'nav items in spec order');
  assert.match(footer,/<span class="footer-link" id="siteVisits" hidden[^>]*>Site visits: <strong id="siteVisitTotal"><\/strong><\/span>/,'counter starts empty, not hardcoded');
  assert.match(html,/fetch\('\/api\/visits', \{method: 'POST', credentials: 'same-origin'\}\)/,'live visit counter POST kept');
  assert.match(html,/document\.getElementById\('siteVisitTotal'\)\.textContent = data\.visits\.toLocaleString\(\)/);
  assert.match(footer,/href="mailto:mtocommunityfinder@gmail\.com">Contact us/);
  assert.equal(/MTOCommunityFinder@gmail\.com/.test(footer),false,'legacy email spelling gone from footer');
  assert.match(footer,/data-alerts-link hidden>Get alerts</,'alerts link stays hidden until subscriptions are available');
  assert.match(css,/\.hf-footer \.footer-links>\*\+\*::before\{[^}]*width:4px[^}]*border-radius:50%/,'4px dot separators');
});

test('Share this site: native share with clipboard fallback and a 3-second toast',()=>{
  assert.match(community,/navigator\.share/,'native share path');
  assert.match(community,/navigator\.clipboard\.writeText\(shareData\.url\)/,'clipboard fallback');
  assert.match(community,/shareSiteBtn\.textContent='Link copied'/,'toast copy');
  assert.match(community,(/,3000\)/),'toast lasts 3 seconds');
  assert.match(community,/title:'Hauntfinder',text:'Find Halloween displays, treat stops, and events near you\.'/);
});

test('type picker dialog: verbatim subtitle, three options, canonical form URLs',()=>{
  const picker=html.split('id="typeDialog"')[1].split('</dialog>')[0];
  assert.match(html,/<dialog class="site-dialog type-dialog" id="typeDialog" aria-labelledby="typePickerTitle">/);
  assert.match(picker,/What are you listing\? Each form opens in Google Forms in a new tab\. To update, choose the same type and use the same name\. Listings are reviewed before they appear\./);
  assert.deepEqual([...picker.matchAll(/data-type-link="(\w+)"/g)].map(m=>m[1]),['display','treat','event'],'three type options');
  assert.ok(picker.includes('>Display<')&&picker.includes('Decorated home or Halloween display'),'display option');
  assert.ok(picker.includes('>Treat stop<')&&picker.includes('Handing out treats on Halloween night'),'treat option');
  assert.ok(picker.includes('>Event<')&&picker.includes('Trunk-or-treat, parade, festival, or other'),'event option');
  for(const [k,u] of Object.entries(FORMS))assert.ok(community.includes(u),k+' canonical URL in FORM_LINKS');
  assert.match(community,/a\.href=FORM_LINKS\[a\.dataset\.typeLink\]/,'option hrefs filled from FORM_LINKS');
  assert.match(community,/document\.getElementById\('typePickerBtn'\)\.onclick=\(\)=>document\.getElementById\('typeDialog'\)\.showModal\(\)/,'footer button opens the picker');
  assert.match(css,/\.type-dialog\{[^}]*width:min\(560px/,'picker width 560');
  assert.match(css,/\.type-dialog\{[^}]*border-top-color:var\(--pumpkin\)/,'pumpkin top accent');
  assert.equal(html.includes('Display Form'),false,'old footer form buttons gone from the page');
});

test('alerts popup: P0 copy, subscribe/not-now actions, compact lime-accented dialog',()=>{
  const dlg=html.split('id="alertsDialog"')[1].split('</dialog>')[0];
  assert.match(html,/<dialog class="site-dialog alerts-dialog" id="alertsDialog" aria-labelledby="alertsTitle">/);
  assert.match(dlg,/<h2 id="alertsTitle">Get new listing alerts<\/h2>/);
  assert.match(dlg,/Want to know when new displays, treat stops, and events are added near you\?/);
  assert.match(dlg,/<button type="button" class="btn btn--route" id="alertsSubscribeBtn">Subscribe<\/button>/);
  assert.match(dlg,/<button type="button" class="btn btn--outline" id="alertsNotNowBtn">Not now<\/button>/);
  assert.match(dlg,/Shown once on a first visit\. Unsubscribe any time\./);
  assert.match(dlg,/<iframe title="Community listing alerts signup" loading="lazy"><\/iframe>/,'alerts iframe flow untouched');
  assert.match(alertsCss,/\.alerts-dialog\{[^}]*width:min\(540px/,'alerts dialog width 540');
  assert.match(alertsCss,/border-top:4px solid #a6e22e/,'lime top accent');
  assert.equal(alertsCss.includes('alerts-dialog-close'),false,'old absolute close button class retired');
});

test('alerts first-visit logic: once-only flag, src=alert suppression, delay, never stacks',()=>{
  assert.match(alertsLink,/hf_alerts_seen/,'seen flag key');
  assert.match(alertsLink,/localStorage\.setItem\(SEEN_KEY,'1'\)/);
  assert.match(alertsLink,/localStorage\.getItem\(SEEN_KEY\)==='1'/);
  assert.match(alertsLink,/get\('src'\)==='alert'/,'?src=alert suppresses the popup');
  assert.match(alertsLink,/,2000\)/,'2 second delay');
  assert.match(alertsLink,/if\(document\.querySelector\('dialog\[open\]'\)\)return/,'never opens on top of another dialog');
  assert.match(alertsLink,/frame\.contentWindow\.focus\(\)/,'Subscribe focuses the embedded form');
  assert.match(alertsLink,/window\.open\('\/alerts\.html','_blank','noopener'\)/,'Subscribe fallback opens the full page');
  assert.match(alertsLink,/getElementById\('alertsNotNowBtn'\)\.addEventListener\('click'/);
  assert.match(alertsLink,/dialog\.addEventListener\('close',[\s\S]*markSeen/,'×, Esc, scrim, and Not now all set the seen flag');
  assert.match(alertsLink,/markSeen\(\);dialog\.showModal\(\)/,'opening the dialog manually also marks seen');
  assert.match(alertsLink,/'\/alerts\.html\?embed=1'/,'lazy embed flow kept');
  assert.match(alertsLink,/event\.ctrlKey\|\|event\.metaKey\|\|event\.shiftKey\|\|event\.altKey/,'modified clicks still pass through');
  assert.match(alertsLink,/d\.available/,'footer link and popup both gate on subscription availability');
});

test('shared modal behavior: scrim guard, focus return, scroll lock, bottom sheets',()=>{
  assert.match(community,/i\.value\.trim\(\)!==''/,'scrim click guarded while a form has typed content');
  assert.match(community,/HTMLDialogElement\.prototype\.showModal/,'opener tracking wraps showModal');
  assert.match(community,/if\(o&&document\.contains\(o\)\)o\.focus\(\)/,'focus returned to the opener on close');
  assert.match(css,/body:has\(dialog\[open\]\)\{overflow:hidden\}/,'background scroll locked');
  assert.match(css,/\.site-dialog\{[^}]*border-radius:10px/,'10px radius');
  assert.match(css,/border-top:4px solid var\(--violet\)/,'4px context-colored top border');
  assert.match(css,/rgba\(5,4,8,\.6\)/,'scrim color');
  assert.match(css,/\.about-dialog\{[^}]*width:min\(760px/,'about width 760');
  assert.match(css,/\.about-article\{[^}]*max-height:60dvh[^}]*overflow:auto/,'long-form About scrolls internally');
  assert.match(css,/@media\(max-width:1023px\)\{[^}]*\.site-dialog\{position:fixed;inset:auto 0 0 0/,'mobile bottom sheets');
});

test('app.js public-data preamble hash is untouched by Phase G',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
