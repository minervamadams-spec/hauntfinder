const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const wn=require('../winter-notice.js');
const root=path.join(__dirname,'..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
const at=iso=>new Date(iso);

test('window: Nov 1 through Feb 21 Eastern, nothing outside',()=>{
  const yes=['2026-11-01T12:00:00-05:00','2026-11-01T00:00:00-04:00','2026-12-25T09:00:00-05:00','2027-01-15T09:00:00-05:00','2027-02-21T23:59:59-05:00'];
  const no=['2026-10-31T23:59:59-04:00','2026-10-01T12:00:00-04:00','2027-02-22T00:00:00-05:00','2027-03-15T12:00:00-04:00','2027-07-04T12:00:00-04:00'];
  yes.forEach(d=>assert.equal(wn.inWindow(at(d)),true,d));
  no.forEach(d=>assert.equal(wn.inWindow(at(d)),false,d));
});
test('window follows Eastern time, not the visitor clock (UTC instants either side of midnight)',()=>{
  assert.equal(wn.inWindow(at('2026-11-01T03:59:59Z')),false,'still Oct 31 in New York');
  assert.equal(wn.inWindow(at('2026-11-01T04:00:00Z')),true,'Nov 1 00:00 EDT');
  assert.equal(wn.inWindow(at('2027-02-22T04:59:59Z')),true,'Feb 21 23:59 EST');
  assert.equal(wn.inWindow(at('2027-02-22T05:00:00Z')),false,'Feb 22 00:00 EST');
});
test('dismissal is remembered per winter and survives a throwing localStorage',()=>{
  const mem={};const store={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v}};
  const nov26=at('2026-11-05T12:00:00-05:00'),feb27=at('2027-02-10T12:00:00-05:00'),nov27=at('2027-11-05T12:00:00-05:00');
  assert.equal(wn.isDismissed(store,nov26),false);
  wn.dismiss(store,nov26);
  assert.equal(wn.isDismissed(store,nov26),true);
  assert.equal(wn.isDismissed(store,feb27),true,'same winter');
  assert.equal(wn.isDismissed(store,nov27),false,'next winter shows again');
  const bad={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}};
  assert.doesNotThrow(()=>wn.dismiss(bad,nov26));
  assert.equal(wn.isDismissed(bad,nov26),false);
});
test('markup: keyboard-reachable link and dismiss button, exact copy and URL',()=>{
  const src=fs.readFileSync(path.join(root,'winter-notice.js'),'utf8');
  assert.match(src,/Halloween is over\. Winter lights, giving drives and events are on Glowfinder\./);
  assert.match(src,/<a class="gf-notice__link" href="'\s*\+\s*URL_GLOWFINDER[^>]*>Open Glowfinder<\/a>/);
  assert.equal(wn.URL,'https://glowfinder-map.vercel.app');
  assert.match(src,/<button type="button" class="gf-notice__close" aria-label="Dismiss/);
  assert.match(src,/localStorage[\s\S]*catch/,'storage access is wrapped');
});
test('every page loads the notice script; every page with a footer links Winter: Glowfinder',()=>{
  pages.forEach(f=>{
    const h=fs.readFileSync(path.join(root,f),'utf8');
    assert.ok(h.includes('<script src="winter-notice.js" defer></script>'),f+' loads winter-notice.js');
    if(/<footer/.test(h))assert.match(h,/<a [^>]*href="https:\/\/glowfinder-map\.vercel\.app"[^>]*>Winter: Glowfinder<\/a>/,f+' footer link');
  });
});
test('footer link is not date-gated',()=>{
  const src=fs.readFileSync(path.join(root,'winter-notice.js'),'utf8');
  assert.equal(/Winter: Glowfinder/.test(src),false,'footer link is static HTML, shown year-round');
});
function lum(hex){const c=[1,3,5].map(i=>parseInt(hex.substr(i,2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
test('colours meet WCAG AA (4.5:1) using the site tokens',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  const tok=n=>css.match(new RegExp('--'+n+':(#[0-9A-Fa-f]{6})'))[1];
  assert.ok(ratio(tok('text'),tok('panel'))>=4.5,'text on panel');
  assert.ok(ratio(tok('bg'),tok('orange'))>=4.5,'button label on orange');
  assert.ok(ratio(tok('text-2'),tok('panel'))>=4.5,'dismiss glyph on panel');
  assert.ok(/\.gf-notice__link:focus-visible/.test(css),'visible focus style');
});
test('fixed-height shells give the notice its height back (map shell and phone map view)',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/html\[data-gf-notice\] \.app\{height:calc\(100dvh - var\(--gf-notice-h,0px\)\)!important\}/);
  assert.match(css,/html\[data-mview="map"\]\{--mapbar-top:calc\(149px \+ var\(--gf-notice-h,0px\)\)\}/);
});

test('showing and dismissing the notice fire a window resize so the map re-measures', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'winter-notice.js'), 'utf8');
  const calls = (src.match(/relayout\(win\)/g) || []).length;
  assert.ok(calls >= 2, 'relayout is called on show and on dismiss');
  assert.match(src, /new win\.Event\('resize'\)/);
});
