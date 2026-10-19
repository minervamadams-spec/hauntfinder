// Round 3 (Oct 19 2026): mobile nav must reach Shops & Services. See handoff round-3/ROUND-3-NAV.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const css = read('styles.css');
const mobile = css.slice(css.indexOf('/* Round 3 mobile nav'));

test('the map page no longer hides Shops & Services on mobile', () => {
  assert.doesNotMatch(css, /@media\(max-width:1023px\)\{\.filterbar \.shops-nav-link\{display:none\}\}/);
});

test('mobile Shops row is full width, 44px plus a 1px #2E2638 top border, Barlow 600 14px #F6EBD3, centered', () => {
  const rule = mobile.match(/html body \.filterbar \.shops-nav-link,html body \.filterbar\.site-nav \.shops-nav-link\{([^}]*)\}/)[1];
  for (const decl of ['order:3', 'flex:0 0 100%', 'justify-content:center', 'box-sizing:border-box', 'width:100%', 'height:45px', 'border-top:1px solid #2E2638', 'background:transparent', 'color:#F6EBD3', 'font:600 14px/1 var(--f-body)']) {
    assert.ok(rule.includes(decl), decl);
  }
  assert.match(mobile, /@media\(max-width:420px\)\{\n html body \.filterbar \.shops-nav-link,html body \.filterbar\.site-nav \.shops-nav-link\{padding:0 12px;font-size:14px;gap:0\}/, 'the 420px tab shrink does not reach the row');
});

test('on the Shops page the row is filled #1C1626 with a 6px cream dot; elsewhere it has no fill on hover or tap', () => {
  assert.match(mobile, /\.shops-nav-link\[aria-current="page"\],html body \.filterbar\.site-nav \.shops-nav-link\[aria-current="page"\]\{background:#1C1626;color:#F6EBD3;border-bottom:0\}/);
  assert.match(mobile, /\.shops-nav-link\[aria-current="page"\]::after\{content:"";flex:none;width:6px;height:6px;margin-left:8px;border-radius:50%;background:#F6EBD3\}/);
  assert.match(mobile, /\.shops-nav-link:hover,html body \.filterbar \.shops-nav-link:focus,html body \.filterbar \.shops-nav-link:active\{background:transparent/);
  assert.match(read('site-chrome.js'), /'<a class="shops-nav-link" href="shops\.html"' \+ attr\(active, 'shops'\)/, 'aria-current="page" is set on the Shops page');
});

test('secondary pages wrap the row under the three tabs instead of a fourth tab', () => {
  assert.match(mobile, /html body \.filterbar\.site-nav \.tabs\{flex-wrap:wrap;height:auto\}/);
  assert.match(mobile, /html body \.filterbar\.site-nav \.nav-row\{height:auto!important;max-height:none\}/);
});

test('the mobile map view starts below the Shops row', () => {
  assert.match(mobile, /html\[data-mview="map"\]\{--mapbar-top:149px\}/);
});

test('label is "Shops & Services" below 1280px and "Shops, Makers & Services" at 1280px and wider', () => {
  for (const file of ['site-chrome.js', 'site-nav-shops.js']) {
    const src = read(file);
    assert.match(src, /shops-nav-link__label--/, file);
    assert.match(src, /Shops(?: &amp;| &) Services/, file);
    assert.match(src, /Shops, Makers(?: &amp;| &) Services/, file);
  }
  assert.match(mobile, /\.shops-nav-link__label--long\{display:none\}\n@media\(min-width:1280px\)\{\n \.shops-nav-link \.shops-nav-link__label--short\{display:none\}\n \.shops-nav-link \.shops-nav-link__label--long\{display:inline\}/);
});
