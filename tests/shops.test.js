const test = require('node:test');
const assert = require('node:assert/strict');
const { isActive, isHttps } = require('../shops.js');

test('advertisements must be approved, HTTPS, and within their active window', () => {
  const baseline = { status: 'approved', url: 'https://business.example/' };
  assert.equal(isActive(baseline), true);
  assert.equal(isActive({ ...baseline, status: 'draft' }), false);
  assert.equal(isActive({ ...baseline, url: 'http://business.example/' }), false);
  assert.equal(isActive({ ...baseline, expirationDate: '2000-01-01' }), false);
});

test('only HTTPS destinations are accepted for public advertising', () => {
  assert.equal(isHttps('https://business.example/order'), true);
  assert.equal(isHttps('mailto:hello@business.example'), false);
  assert.equal(isHttps('javascript:alert(1)'), false);
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
});
