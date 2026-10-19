const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const index = read('index.html');
const chrome = read('site-chrome.js');
const css = read('styles.css');
const PAGES = ['shops.html', 'submit.html', 'about.html', 'alerts.html', 'route.html', 'listing.html'];

test('secondary pages mount the same banner markup as the map, so the header cannot drift', () => {
  const fromIndex = index.slice(index.indexOf('<header class="hf-header banner">'), index.indexOf('</header>') + '</header>'.length);
  const fromChrome = chrome.match(/var SITE_BANNER_HTML = `([\s\S]*?)`;/)[1].replace(/\$\{INTRO\}/g, 'Find decorated homes, spooky displays, treat stops, and Halloween events near you. Check visiting details, plan your route, or submit a listing for free.');
  assert.equal(norm(fromIndex), norm(fromChrome));
  assert.match(fromChrome, /Find decorated homes, spooky displays, treat stops, and Halloween events near you\. Check visiting details, plan your route, or submit a listing for free\./);
  assert.match(chrome, /\.replace\('<h1 class="banner__title">', '<div class="banner__title">'\)/, 'secondary pages keep their own h1');
  for (const name of PAGES) {
    const html = read(name);
    assert.match(html, /id="siteChrome"/, name);
    assert.match(html, /<script src="site-chrome\.js"><\/script>/, name);
    assert.equal(html.includes('shops-header'), false, name + ' drops the old shops banner');
    assert.equal(html.includes('class="subpage-head"'), false, name + ' drops the old text nav');
  }
});

test('category tabs link back to index.html and only Shops & Services is current on the shops page', () => {
  assert.match(chrome, /href="' \+ tab\[2\] \+ '"/);
  assert.deepEqual(
    [...chrome.matchAll(/\['(displays|treats|events)', '[^']+', '(index\.html\?category=[^']+)'\]/g)].map((m) => [m[1], m[2]]),
    [
      ['displays', 'index.html?category=displays'],
      ['treats', 'index.html?category=treats'],
      ['events', 'index.html?category=events']
    ]
  );
  assert.match(chrome, /class="shops-nav-link" href="shops\.html"/);
  assert.match(chrome, /attr\(active, 'shops'\)/);
  assert.match(read('shops.html'), /data-chrome-active="shops"/);
  for (const name of ['submit.html', 'about.html', 'alerts.html', 'route.html', 'listing.html']) {
    assert.doesNotMatch(read(name), /data-chrome-active="shops"/);
  }
  assert.match(chrome, /loadShopsBadge\(\)/, 'only the global Shops count is loaded for secondary navigation');
  assert.match(read('shops-nav-badge.js'), /tabs__badge--shops/);
  assert.match(read('shops-nav-badge.js'), /catch\(clear\)/, 'a missing ad list leaves the link usable without a badge');
});

test('secondary tab links share the map tab rules instead of a second stylesheet', () => {
  assert.match(css, /\.filterbar \.tabs button,\.filterbar \.tabs a\.site-tab\{[^}]*color:#A89DB4;[^}]*border-bottom:3px solid transparent/);
  assert.match(css, /html body \.filterbar \.tabs button,html body \.filterbar \.tabs a\.site-tab\{[^}]*font:600 14px/);
  assert.match(css, /\.filterbar\.site-nav \.shops-nav-link\[aria-current="page"\]\{color:#F6EBD3;border-bottom-color:#F6EBD3\}/);
  assert.match(css, /html body \.filterbar\.site-nav \.shops-nav-link\{display:inline-flex/);
});
