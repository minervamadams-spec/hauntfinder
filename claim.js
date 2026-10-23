// claim.html?id=N: claim or remove a community-spotted listing.
(function () {
'use strict';
const N = window.HFNominate, cfg = window.HF_NOMINATIONS || {};
const $ = (id) => document.getElementById(id);
function show(id, text) { const el = $(id); el.textContent = text || ''; el.hidden = !text; }
const num = Number(new URLSearchParams(location.search).get('id'));
let listing = null;

async function load() {
  try {
    const src = await (await fetch('app.js')).text();
    const data = new Function(src.split('const filters=')[0] + ';return {listings}')();
    listing = data.listings.find((x) => x.num === num && x.source === 'community') || null;
  } catch { /* handled below */ }
  if (!listing) { $('claimForm').hidden = true; $('claimMain').insertAdjacentHTML('beforeend', '<p class="nom-lead">We couldn’t find that listing. <a href="index.html">Back to the map</a></p>'); return; }
  $('claimAddress').value = listing.address.replace(/,\s*NJ\s*$/i, '');
  $('claimBack').href = 'index.html?house=' + num;
}

$('claimForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!listing) return;
  const request = (document.querySelector('input[name="request"]:checked') || {}).value || '';
  const data = { address: $('claimAddress').value, request, email: $('claimEmail').value.trim() };
  const errors = N.validateClaim(data);
  show('requestMsg', errors.request || ''); show('claimEmailMsg', errors.email || '');
  if (Object.keys(errors).length) return;
  const btn = $('claimSend'); btn.disabled = true;
  try {
    if (!N.formConfigured(cfg.claim)) throw new Error(N.COPY.notOpen);
    await N.postForm(cfg.claim, { address: data.address, listing: listing.num, request, email: data.email });
    // A removal takes the pin off the map straight away, in this browser at once and
    // for everyone when the review scan sets "hidden": true.
    if (request === 'remove') N.rememberHidden(localStorage, listing.num);
    $('claimForm').hidden = true; $('claimSent').hidden = false;
    $('afterRemove').hidden = request !== 'remove'; $('afterClaim').hidden = request !== 'claim';
    window.scrollTo(0, 0);
  } catch (err) { show('claimFormMsg', err.message || 'Something went wrong. Please try again.'); btn.disabled = false; }
});
load();
}());
