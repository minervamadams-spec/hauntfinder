// Share cards: every site HTML page advertises the same sharp 1200×630 preview.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const IMAGE = 'https://hauntfinder.vercel.app/assets/og-image.png';
const ALT = 'Hauntfinder Halloween Guide — Free North Jersey Halloween Map';
const PAGES = {
  'about.html': 'https://hauntfinder.vercel.app/about.html',
  'alerts.html': 'https://hauntfinder.vercel.app/alerts.html',
  'claim.html': 'https://hauntfinder.vercel.app/claim.html',
  'index.html': 'https://hauntfinder.vercel.app/',
  'listing.html': 'https://hauntfinder.vercel.app/listing.html',
  'newsletter-setup.html': 'https://hauntfinder.vercel.app/newsletter-setup.html',
  'nominate.html': 'https://hauntfinder.vercel.app/nominate.html',
  'organizer.html': 'https://hauntfinder.vercel.app/organizer.html',
  'route.html': 'https://hauntfinder.vercel.app/route.html',
  'shops.html': 'https://hauntfinder.vercel.app/shops.html',
  'submit.html': 'https://hauntfinder.vercel.app/submit.html'
};

const meta = (html, attr, key) => {
  const found = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`));
  assert.ok(found, `${attr}=${key}`);
  return found[1];
};

test('og-image.png is a 1200x630 PNG under 300KB', () => {
  const buf = fs.readFileSync(path.join(ROOT, 'assets/og-image.png'));
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR');
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
  assert.ok(buf.length < 300 * 1024, `og image is ${buf.length} bytes`);
});

test('every html page has an absolute 1200x630 og:image', () => {
  const files = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html')).sort();
  assert.deepEqual(files, Object.keys(PAGES).sort());
  for (const name of files) {
    const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]*)">/)[1];
    assert.equal(meta(html, 'property', 'og:type'), 'website', name);
    assert.equal(meta(html, 'property', 'og:url'), PAGES[name], name);
    assert.equal(meta(html, 'property', 'og:title'), title, name);
    assert.equal(meta(html, 'property', 'og:description'), description, name);
    assert.equal(meta(html, 'property', 'og:image'), IMAGE, name);
    assert.ok(IMAGE.startsWith('https://hauntfinder.vercel.app/'), name);
    assert.equal(meta(html, 'property', 'og:image:width'), '1200', name);
    assert.equal(meta(html, 'property', 'og:image:height'), '630', name);
    assert.equal(meta(html, 'property', 'og:image:alt'), ALT, name);
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image', name);
    assert.equal(meta(html, 'name', 'twitter:title'), title, name);
    assert.equal(meta(html, 'name', 'twitter:description'), description, name);
    assert.equal(meta(html, 'name', 'twitter:image'), IMAGE, name);
  }
});
