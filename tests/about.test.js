const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const community=fs.readFileSync(path.join(__dirname,'../community.js'),'utf8');
const about=fs.readFileSync(path.join(__dirname,'../about.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const article=about.split('class="about-article"')[1].split('class="about-social"')[0];

test('the About dialog is fully removed from the homepage (page-first plan step 5)',()=>{
  assert.equal(html.includes('id="aboutDialog"'),false,'aboutDialog markup removed');
  assert.equal(html.includes('about-article'),false,'article content no longer duplicated in index');
  assert.equal(/aboutBtn|aboutDialog/.test(community),false,'about opener wiring removed')
});
test('the two old separate dialogs and their openers stay gone',()=>{assert.equal(html.includes('aboutHauntfinderDialog'),false,'aboutHauntfinderDialog removed');assert.equal(html.includes('aboutHauntfinderBtn'),false,'aboutHauntfinderBtn removed');assert.equal(community.includes('aboutHauntfinder'),false,'old opener removed');assert.equal(html.includes('id="aboutBtn">About Skully<'),false,'About Skully button replaced')});
test('the About footer link is a normal link to the page-first /about.html route',()=>{
  assert.match(html,/<a class="footer-link" href="about\.html">About<\/a>/);
  assert.equal(/getElementById\('aboutBtn'\)/.test(community),false,'aboutBtn dialog opener wiring removed');
  assert.match(about,/The Family Behind the Skeleton House: How a Love of Halloween Became a Community Tradition/,'article lives on the standalone page');
  assert.equal(about.includes('<dialog'),false,'no dialog markup on the page')
});
test('the standalone page has exactly one h1 (the article title) and h2 sections under it',()=>{
  assert.equal((about.match(/<h1>/g)||[]).length,1,'single top-level heading');
  assert.match(about,/<h1>The Family Behind the Skeleton House: How a Love of Halloween Became a Community Tradition<\/h1>/);
  assert.equal(article.includes('<h3>'),false,'no skipped heading levels in the article');
  assert.ok(article.indexOf('<h1>')<article.indexOf('<h2>'),'h1 precedes section headings')
});
test('P6 kicker, headline, and dek are present verbatim',()=>{assert.match(article,/Community feature \| Budd Lake, New Jersey/);assert.match(article,/The Family Behind the Skeleton House: How a Love of Halloween Became a Community Tradition/);assert.match(article,/From a 12-foot skeleton and a garage full of free costumes to a new Halloween community map, the Adams family of Budd Lake has found a way to share their love of the season with neighbors near and far\./)});
test('P6 section headings and spot-check copy are present verbatim',()=>{['Two Horror Fans and a House Full of Ideas','The Skeleton That Started Something Bigger','A Costume Closet That Outgrew the Porch',"When a Cancelled Contest Inspired a New Idea",'Halloween at the Adams House','Always Room for One More Idea','Community information'].forEach(h=>assert.ok(article.includes('>'+h+'<'),h+' present'));assert.match(article,/In 2023, the Adams family planted approximately 150 pumpkin seedlings/);assert.match(article,/Minerva created Hauntfinder, a free community website/);assert.match(article,/5 N\. Mount Olive Road in Budd Lake, New Jersey/);assert.match(article,/had raised \$1,270\./)});
test('P6 pull quotes keep their Mt. Olive Online citations',()=>{assert.match(article,/<blockquote><p>“We believe in sharing the love with our community\.”<\/p><cite>Mt\. Olive Online<\/cite><\/blockquote>/);assert.match(article,/<blockquote><p>“Halloween should be fun for everyone, and no one should have to skip out on dressing up because of the cost\.”<\/p><cite>Mt\. Olive Online<\/cite><\/blockquote>/)});
test('social row: 52px icon links with aria labels, Follow Skully, and the spec email for donations',()=>{const social=about.split('class="about-social"')[1];assert.match(social,/href="https:\/\/www\.facebook\.com\/SkullyRAdams" target="_blank" rel="noopener" aria-label="Facebook"><img src="assets\/icons\/social-facebook\.svg" alt="" width="52" height="52"><\/a>/);assert.match(social,/href="https:\/\/www\.instagram\.com\/skullyadams\/" target="_blank" rel="noopener" aria-label="Instagram"><img src="assets\/icons\/social-instagram\.svg" alt="" width="52" height="52"><\/a>/);assert.match(social,/>Follow Skully</);assert.match(social,/href="mailto:mtocommunityfinder@gmail\.com">Ask about donating/);assert.equal(about.includes('MTOCommunityFinder@gmail.com'),false,'legacy email spelling gone from About copy');assert.equal(about.includes('minervamadams@gmail.com'),false)});
test('page links to the Adams Family Haunt listing and the costume closet event without identity tokens',()=>{assert.match(article,/href="\/\?house=1"/);assert.match(article,/href="\/\?category=events&event=skullys-costume-closet"/)});
test('standalone About page overrides the desktop app scroll lock',()=>{
  assert.match(css,/html:has\(body\.subpage\)\{[^}]*overflow-y:auto/,'the document can scroll on desktop subpages');
  assert.match(css,/body\.subpage\{[^}]*overflow-y:auto/,'the subpage body can scroll on desktop');
});
