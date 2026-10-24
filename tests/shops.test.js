const test = require('node:test');
const assert = require('node:assert/strict');
const { isActive, isHttps } = require('../shops-eligibility.js');

test('advertisements must be approved, HTTPS, and within their active window', () => {
  const baseline = { status: 'approved', url: 'https://business.example/' };
  assert.equal(isActive(baseline), true);
  assert.equal(isActive({ ...baseline, status: 'draft' }), false);
  assert.equal(isActive({ ...baseline, url: 'http://business.example/' }), false);
  assert.equal(isActive({ ...baseline, expirationDate: '2000-01-01' }), false);
  assert.equal(isActive({ ...baseline, startDate: '2999-01-01' }), false);
});

test('the navigation badge uses the same eligibility predicate as the Shops card list', () => {
  const ads = [
    { status: 'approved', url: 'https://active.example/' },
    { status: 'draft', url: 'https://draft.example/' },
    { status: 'approved', url: 'https://expired.example/', expirationDate: '2000-01-01' },
    { status: 'approved', url: 'https://future.example/', startDate: '2999-01-01' },
    { status: 'approved', url: 'http://insecure.example/' }
  ];
  const badge = require('node:fs').readFileSync(require('node:path').join(__dirname, '../shops-nav-badge.js'), 'utf8');
  const shops = require('node:fs').readFileSync(require('node:path').join(__dirname, '../shops.js'), 'utf8');
  assert.equal(ads.filter(isActive).length, 1);
  assert.match(badge, /ads\.filter\(eligibility\.isActive\)\.length/);
  assert.match(shops, /\.filter\(active\)/);
  assert.match(badge, /if \(!count\) return;/, 'zero active ads leaves no badge');
  assert.match(badge, /'Shops, Makers & Services' : 'Shops & Services'/, 'the accessible name follows the visible label');
  assert.match(badge, /name \+ ', ' \+ count \+ \(count === 1 \? ' listing' : ' listings'\)/, 'the link has a descriptive accessible name');
});

test('only HTTPS destinations are accepted for public advertising', () => {
  assert.equal(isHttps('https://business.example/order'), true);
  assert.equal(isHttps('mailto:hello@business.example'), false);
  assert.equal(isHttps('javascript:alert(1)'), false);
});

test('Dusk Productions approved ad has public, privacy-safe shop fields', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(require('node:path').join(__dirname, '../shops-ads.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const ad = context.window.HAUNTFINDER_SHOPS_ADS.find(item => item.id === 'dusk-productions-2026');
  assert.ok(ad);
  assert.equal(ad.status, 'approved');
  assert.equal(ad.businessType, 'both');
  assert.equal(ad.url, 'https://duskproductions.com/');
  assert.equal(ad.alt, 'Dusk Productions logo');
  assert.match(ad.image, /^assets\/shops\/dusk-productions-logo\.png$/);
  assert.equal(JSON.stringify(ad).includes('@'), false, 'ad must not expose private email data');
});

test('advertise button opens the submit page; the ad form is a submit option; email stays secondary', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../shops.html'), 'utf8');
  const submit = fs.readFileSync(path.join(__dirname, '../submit.html'), 'utf8');
  const shopsJs = fs.readFileSync(path.join(__dirname, '../shops.js'), 'utf8');
  const form = 'https://docs.google.com/forms/d/e/1FAIpQLSeRLgk9i2EJF5AEipV6KLJnHgwXcAiNAd9fxS0KQAOZ7KbZbA/viewform';
  assert.match(html, /id="advertiseLink" href="submit\.html"/);
  assert.equal(html.includes('id="advertiseLink" href="' + form), false);
  assert.equal(shopsJs.includes('link.href=form'), false, 'shops.js must not retarget the advertise button');
  assert.match(html, /class="shops-advertise__questions" href="mailto:mtocommunityfinder@gmail\.com\?subject=Hauntfinder%20Shops%20%26%20Services%20advertising%20inquiry">Questions\? Email us/);
  assert.match(submit, new RegExp('data-type-link="shop" href="' + form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '" target="_blank" rel="noopener"'));
  assert.match(submit, /Shops, Makers &amp; Services – free ad/);
  assert.match(submit, /Google sign-in for the photo upload/);
  assert.match(submit, /Shops, makers &amp; services: advertise free/);
});

test('the advertising form is a direct link from shops, submit, and the site nav and footer', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  const form = 'https://docs.google.com/forms/d/e/1FAIpQLSeRLgk9i2EJF5AEipV6KLJnHgwXcAiNAd9fxS0KQAOZ7KbZbA/viewform';
  const label = 'Shops, makers &amp; services: advertise free';
  const link = new RegExp('href="' + form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '" target="_blank" rel="noopener">' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  for (const name of ['shops.html', 'submit.html', 'index.html', 'site-chrome.js', 'about.html', 'listing.html', 'route.html']) {
    assert.match(read(name), link, name);
  }
  const submitLinks = read('submit.html').match(/https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform/g) || [];
  assert.equal(submitLinks.length, 5, 'submit page carries five Google Form links');
  assert.equal(submitLinks.filter((url) => url === form).length, 2, 'the advertising form is the submit option and the footer link');
  assert.match(read('scripts/verify-live.js'), /submitLinks\.length===5/);
  assert.match(read('scripts/verify-live.js'), /formLinks\.length === 5/);
  assert.equal(read('shops.html').includes('id="advertiseLink" href="submit.html"'), true);
});
