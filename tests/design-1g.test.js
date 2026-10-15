const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const community=fs.readFileSync(path.join(ROOT,'community.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const alertsCss=fs.readFileSync(path.join(ROOT,'alerts.css'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const alertsPage=fs.readFileSync(path.join(ROOT,'alerts.html'),'utf8');
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
  assert.match(footer,/<a class="btn btn--route" href="submit\.html">Submit or update a listing<\/a>/,'footer CTA is a normal link to the page-first route');
  assert.equal(html.includes('id="typePickerBtn"'),false,'old dialog-opening button gone');
  assert.equal(/getElementById\('typePickerBtn'\)/.test(community),false,'typePickerBtn opener wiring removed');
  assert.match(css,/\.hf-footer \.footer-inner \.btn--route\{min-height:52px\}/,'primary action is 52px tall');
});

test('footer row 2: About · Get alerts · Share this site · counter · Contact us in order',()=>{
  const order=[footer.indexOf('href="about.html"'),footer.indexOf('alerts-footer-link'),footer.indexOf('id="shareSiteBtn"'),footer.indexOf('id="siteVisits"'),footer.indexOf('mailto:mtocommunityfinder@gmail.com')];
  assert.deepEqual(order,[...order].sort((a,b)=>a-b),'nav items in spec order');
  assert.match(footer,/<span class="footer-link" id="siteVisits" hidden[^>]*>Site visits: <strong id="siteVisitTotal"><\/strong><\/span>/,'counter starts empty, not hardcoded');
  assert.match(html,/fetch\('\/api\/visits', \{method: 'POST', credentials: 'same-origin'\}\)/,'live visit counter POST kept');
  assert.match(html,/document\.getElementById\('siteVisitTotal'\)\.textContent = data\.visits\.toLocaleString\(\)/);
  assert.match(footer,/href="mailto:mtocommunityfinder@gmail\.com">Contact us/);
  assert.equal(/MTOCommunityFinder@gmail\.com/.test(footer),false,'legacy email spelling gone from footer');
  assert.match(footer,/class="alerts-footer-link" href="alerts\.html">Get alerts</,'alerts is a plain same-tab link to the standalone page');
  assert.match(css,/\.hf-footer \.footer-links>\*\+\*::before\{[^}]*width:4px[^}]*border-radius:50%/,'4px dot separators');
});

test('Share this site: native share with clipboard fallback and a 3-second toast',()=>{
  assert.match(community,/navigator\.share/,'native share path');
  assert.match(community,/navigator\.clipboard\.writeText\(shareData\.url\)/,'clipboard fallback');
  assert.match(community,/shareSiteBtn\.textContent='Link copied'/,'toast copy');
  assert.match(community,(/,3000\)/),'toast lasts 3 seconds');
  assert.match(community,/title:'Hauntfinder',text:'Find Halloween displays, treat stops, and events near you\.'/);
});

test('type picker dialog fully retired (page-first plan step 5)',()=>{
  assert.equal(html.includes('id="typeDialog"'),false,'typeDialog markup removed');
  assert.equal(/FORM_LINKS|data-type-link/.test(community),false,'FORM_LINKS and href-fill wiring removed');
  assert.equal(/\.type-dialog|\.type-picker-sub/.test(css),false,'orphaned picker styles removed');
});

test('alerts is page-first: standalone page, no popup, no iframe, no auto-open',()=>{
  assert.equal(html.includes('id="alertsDialog"'),false,'alerts dialog markup retired (Codex a17a8b5: nested pages can fail to paint inside a modal)');
  assert.equal(html.includes('alerts-link.js'),false,'popup controller script stays deleted');
  assert.ok(!/<iframe[^>]*alerts/i.test(html),'no alerts iframe anywhere in the shell');
  assert.match(alertsPage,/id="alertsForm"/,'standalone alerts page carries the signup form');
  assert.match(alertsPage,/id="alertsAreaToggle"/,'area (zip/radius) choices live on the standalone page');
  assert.match(alertsPage,/alerts\.js/,'standalone page loads its controller');
});

test('shared modal behavior retired with the last homepage dialogs (page-first plan step 5)',()=>{
  assert.equal(/HTMLDialogElement\.prototype\.showModal/.test(community),false,'no showModal wrapper left');
  assert.equal(css.includes('body:has(dialog[open])'),false,'no dialog scroll lock left');
  assert.equal(css.includes('.site-dialog'),false,'no dialog skin left');
  assert.equal(/\.about-dialog/.test(css),false,'about dialog styles removed with the dialog');
  assert.equal(/\.about-article\{[^}]*max-height:60dvh/.test(css),false,'dialog scroll cap removed from about-article');
});

test('app.js public-data preamble hash is untouched by Phase G',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.ok(head.includes('const filters='),'HEAD has the split marker');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
