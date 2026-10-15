const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const community=fs.readFileSync(path.join(ROOT,'community.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const pageJs=fs.readFileSync(path.join(ROOT,'page.js'),'utf8');
const submit=fs.readFileSync(path.join(ROOT,'submit.html'),'utf8');
const about=fs.readFileSync(path.join(ROOT,'about.html'),'utf8');
const FORMS={
  // Must match FORM_LINKS in community.js (verified 2026-10-14).
  display:'https://docs.google.com/forms/d/e/1FAIpQLSeifnGQbKmB1ofTT1Kb1EsY-aCxo-164AXIr5sIvA-xdg9a6g/viewform',
  treat:'https://docs.google.com/forms/d/e/1FAIpQLScSaoQ7UuSMwxyiDMEQYxXg6HyQhXep_CyEFjYgD7nwQ3kq-w/viewform',
  event:'https://docs.google.com/forms/d/e/1FAIpQLSeGXPJkGkuaRNOC2QXToVD3L85mXez9xYpKJd4ij7P0lskrfQ/viewform'};

// ---- Route 1: /submit.html — visible controls are the three form links ----
test('submit page: three visible type options link straight to the verified Google Forms',()=>{
  const links=[...submit.matchAll(/<a class="type-option" data-type-link="(\w+)" href="([^"]+)" target="_blank" rel="noopener">/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual(links,Object.entries(FORMS),'display/treat/event options with canonical URLs');
  assert.equal(/docs\.google\.com\/forms/.test(community),false,'community.js no longer carries form URLs (wiring removed with the dialog)');
});
test('submit page: ordinary page, not a dialog — usable shell, no modal markup',()=>{
  assert.equal(submit.includes('<dialog'),false,'no dialog markup');
  assert.match(submit,/<body data-page="submit" class="subpage">/,'route validator hook');
  assert.match(submit,/href="\/">← Hauntfinder map</,'ordinary back link to the map');
  assert.match(submit,/<h1>Submit or update a listing<\/h1>/,'visible heading');
  assert.match(submit,/listing is free\./i,'free-listing note present');
  assert.match(submit,/type-option__desc">Handing out treats on Halloween night</,'actual control text, not a script placeholder');
});

// ---- Route 2: /about.html — the community story is a shareable page ----
test('about page: full article with headings, pull quotes, community info and social row',()=>{
  assert.equal(about.includes('<dialog'),false,'no dialog markup');
  assert.match(about,/<body data-page="about" class="subpage">/,'route validator hook');
  assert.match(about,/The Family Behind the Skeleton House: How a Love of Halloween Became a Community Tradition/);
  for(const h of ['Two Horror Fans and a House Full of Ideas','The Skeleton That Started Something Bigger','A Costume Closet That Outgrew the Porch',"When a Cancelled Contest Inspired a New Idea",'Halloween at the Adams House','Always Room for One More Idea','Community information'])
    assert.ok(about.includes('>'+h+'<'),h+' present');
  assert.equal((about.match(/<blockquote>/g)||[]).length,2,'both pull quotes with citations');
  assert.match(about,/href="https:\/\/www\.facebook\.com\/SkullyRAdams"/,'facebook link');
  assert.match(about,/href="https:\/\/www\.instagram\.com\/skullyadams\/"/,'instagram link');
  assert.match(about,/href="mailto:mtocommunityfinder@gmail\.com">Ask about donating/);
  assert.match(about,/href="\/\?house=1"/,'links back to the Adams Family Haunt listing');
  assert.match(about,/href="\/\?category=events&event=skullys-costume-closet"/,'links to the costume closet event');
});

// ---- Shared shell: validator, nav state, styles ----
test('shared shell: route whitelist validator rejects unknown pages and marks the current nav item',()=>{
  assert.match(pageJs,/const ROUTES = \['submit', 'about'\]/,'canonical route set');
  assert.match(pageJs,/ROUTES\.includes\(page\)/,'validation check');
  assert.match(pageJs,/aria-current/, 'current-route marking');
});
test('shared shell: styles give subpages their own layout and real heading styles',()=>{
  assert.match(css,/\.subpage-nav\{[^}]*justify-content:space-between/,'header nav');
  assert.match(css,/\.subpage-main\{[^}]*max-width:760px/,'constrained reading column');
  assert.match(css,/\.about-page \.about-article h1\{[^}]*var\(--f-display\)/,'article title styled as display heading');
  assert.match(css,/\.about-page \.about-article h2\{[^}]*font:700 22px/,'section headings styled');
  assert.match(css,/\.skip-link/,'skip link styled');
});

// ---- Homepage integration: links replace dialog openers; visits script repaired ----
test('homepage footer: About and Submit are normal links, dialog openers fully removed',()=>{
  assert.match(html,/<a class="footer-link" href="about\.html">About<\/a>/);
  assert.match(html,/<a class="btn btn--route" href="submit\.html">Submit or update a listing<\/a>/);
  assert.equal(html.includes('id="aboutBtn"'),false,'about opener button gone');
  assert.equal(/getElementById\('aboutBtn'\)|getElementById\('typePickerBtn'\)/.test(community),false,'no dialog-opener wiring remains in community.js');
  assert.equal(html.includes('id="aboutDialog"')||html.includes('id="typeDialog"'),false,'both retired dialogs removed from the DOM');
  assert.equal(/FORM_LINKS|data-type-link/.test(community),false,'orphaned form-link wiring removed from community.js');
});
test('homepage: corrupted dialog fragment that silently killed the visit counter is repaired',()=>{
  assert.equal(html.includes('<dialog class="site-dial\n'),false,'dangling unclosed dialog tag gone');
  assert.match(html,/<script>\(function \(\) \{\n  fetch\('\/api\/visits'/,'visits counter is a real script again');
});
