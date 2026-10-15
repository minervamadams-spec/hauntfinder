const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
test('Phase A fonts: exact spec families and weights, display=swap, Creepster gone',()=>{
  const href='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700;800&family=Rubik+Dirt:wght@400&display=swap';
  assert.ok(html.includes(`href="${href}"`),'exact font href (Rubik Dirt 400; Barlow Condensed 500-800; Barlow 400-800; display=swap)');
  assert.equal(html.includes('Creepster'),false,'Creepster removed');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'),'googleapis preconnect kept');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'),'gstatic preconnect kept');
});
test('v7 banner: supplied transparent sign over the supplied scene strip, dimensions, alt, high priority, not lazy',()=>{
  assert.ok(html.includes('<picture class="banner__frame">'),'picture wrapper');
  assert.ok(html.includes('src="assets/sign-cutout.png"'),'supplied transparent sign asset');
  assert.ok(html.includes('width="960" height="345"'),'sign dimensions');
  assert.ok(html.includes('alt="Hauntfinder Halloween Guide"'),'spec alt text');
  assert.ok(html.includes('fetchpriority="high"'),'high fetch priority');
  const bannerBlock=html.split('<picture class="banner__frame">')[1].split('</picture>')[0];
  assert.equal(/loading="lazy"/.test(bannerBlock),false,'banner never lazy-loaded');
  const cssBlock=css.split('/* ---- v7 compact workspace')[1];
  assert.ok(cssBlock.includes('scene-strip-v2.png')&&cssBlock.includes('height:112px'),'desktop scene strip header');
  assert.ok(cssBlock.includes('object-fit:contain'),'the sign is contained rather than cropped');
});
test('Phase A icons: all 12 SVGs present in assets/icons',()=>{
  for(const name of ['pin-display.svg','pin-treat-stop.svg','pin-event.svg','icon-display.svg','icon-treat-stop.svg','icon-event.svg','badge-on-route.svg','icon-list.svg','icon-map.svg','icon-calendar.svg','social-facebook.svg','social-instagram.svg'])
    assert.ok(fs.existsSync(path.join(ROOT,'assets/icons',name)),name+' missing');
});
test('Phase A tokens: :root defines the full section-5 set',()=>{
  const root=css.split('/* v6 Phase A (Direction 1A): design tokens')[1].split(':root{')[1].split('}')[0];
  const colors={'--bg':'#0B0910','--card':'#15101C','--panel':'#1A1322','--band':'#120D18','--line':'#2A2233','--line-2':'#3A2F45','--text':'#F6EBD3','--text-2':'#CFC4B0','--text-3':'#A89DB4','--orange':'#FF7A1A','--lime':'#A6E22E','--purple':'#B48CFF','--purple-deep':'#7B3FE4','--teal':'#3FD0C0','--sat-tint':'#1E1430','--allweek-bg':'#0E1C1B','--allweek-line':'#1F3B39','--err':'#FF9A5A'};
  for(const[token,hex]of Object.entries(colors))assert.ok(root.includes(token+':'+hex),token+' must be '+hex);
  for(const sp of[4,8,12,16,20,24,32,40,48])assert.ok(root.includes('--space-')&&root.includes(':'+sp+'px'),'spacing '+sp);
  assert.ok(root.includes('--radius-badge:4px')&&root.includes('--radius-control:6px')&&root.includes('--radius-card:8px')&&root.includes('--radius-modal:10px'),'radii 4/6/8/10');
  assert.ok(root.includes('0 30px 80px rgba(0,0,0,.7)')&&root.includes('0 16px 40px rgba(0,0,0,.6)')&&root.includes('0 12px 32px rgba(0,0,0,.6)'),'three shadows');
  assert.ok(root.includes("--f-display:'Rubik Dirt',cursive")&&root.includes("--f-cond:'Barlow Condensed',sans-serif")&&root.includes("--f-body:'Barlow',sans-serif"),'font stacks');
});
test('Phase A map: keyless dark tiles (Esri World Dark Gray Base) with required attribution',()=>{
  // Hotfix 2026-10-15: CARTO started requiring API keys (watermarked tiles), so
  // the basemap reverted to the previous keyless dark provider. Still a dark
  // tile style per spec ("such as CARTO Dark Matter").
  assert.ok(app.includes("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"),'Esri dark gray tile URL');
  assert.ok(app.includes('maxZoom:16'),'maxZoom 16');
  assert.ok(app.includes('Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'),'Esri attribution');
  assert.equal(app.includes('basemaps.cartocdn.com'),false,'CARTO tiles removed (API key now required)');
});
test('app.js public-data preamble hash is unchanged by the tile edit',()=>{
  const head=execSync('git show HEAD:app.js',{cwd:ROOT}).toString();
  const hash=s=>crypto.createHash('sha256').update(s.split('const filters=')[0]).digest('hex');
  assert.equal(hash(app),hash(head),'preamble hash identical to committed HEAD');
});
