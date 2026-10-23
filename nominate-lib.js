// Community-spotted houses: shared logic for nominate.html and claim.html.
// Pure helpers are exported for tests; browser-only helpers (geocoding, photo
// re-encode, submit) attach below. Privacy rules (brief, Implementation):
// no email or phone is ever stored in the repo or logged; photos are
// re-encoded in the browser so EXIF and GPS metadata never leave the device;
// the public location is always a street address, never a raw GPS point.
(function (root) {
'use strict';
const COPY = {
  outsideNJ: 'Hauntfinder only covers New Jersey for now.',
  noMatch: 'We couldn’t find a street address there. Please type it in.',
  finding: 'FINDING THE NEAREST ADDRESS…',
  sentWithEmail: 'Since you left your email, we’ll let you know when it’s live.',
  sentNoEmail: 'Check back on the map after it’s reviewed.',
  claimSent: 'Thanks, we’ll be in touch.',
  removeSent: 'It’s off the map.',
  notOpen: 'Nominations aren’t open just yet. Please check back soon.'
};
const NJ_ZIP = /^0[78]\d{3}$/;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const WHY_MAX = 140;

function titleCase(s) { return String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Nj|Pa|Ny)\b/g, (m) => m.toUpperCase()); }

// Census matchedAddress: "118 FLANDERS RD, MOUNT OLIVE, NJ, 07828".
function parseMatched(matched) {
  const parts = String(matched || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  const [street, town, state, zip] = parts;
  return { street: titleCase(street), town: titleCase(town), state: state.toUpperCase(), zip };
}
function isNewJersey(parsed) { return !!parsed && parsed.state === 'NJ' && NJ_ZIP.test(parsed.zip || ''); }
// The street name alone, for "the house on Flanders Rd".
function streetName(street) { return String(street || '').replace(/^\s*\d+[A-Za-z]?\s+/, '').trim(); }

function sentMessage(street, hasEmail) {
  return `Your nomination for the house on ${streetName(street)} is waiting for review. It shows up on the map after we’ve checked it, not right away. ` +
    (hasEmail ? COPY.sentWithEmail : COPY.sentNoEmail);
}

function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }

// Required: location, town, public-street checkbox. Everything else optional.
function validateNomination(d) {
  const errors = {};
  if (!d.street || !String(d.street).trim()) errors.location = 'Please choose the house’s street address.';
  if (!d.town || !String(d.town).trim()) errors.town = 'Please add the town.';
  if (!d.publicStreet) errors.publicStreet = 'Please confirm the house is visible from a public street.';
  if (d.email && !validEmail(d.email)) errors.email = 'That email doesn’t look right. You can also leave it blank.';
  if (d.why && String(d.why).length > WHY_MAX) errors.why = `Please keep this to ${WHY_MAX} characters.`;
  return errors;
}
function validateClaim(d) {
  const errors = {};
  if (!d.address) errors.address = 'Missing the listing address.';
  if (d.request !== 'claim' && d.request !== 'remove') errors.request = 'Please choose Claim it or Remove it.';
  if (d.email && !validEmail(d.email)) errors.email = 'That email doesn’t look right. You can also leave it blank.';
  return errors;
}

// Google Form body: entry ids come from nominations-config.js (the forms are
// created by the site owner), so the page never hard-codes them.
function formBody(entries, values) {
  const p = new URLSearchParams();
  Object.keys(values).forEach((k) => {
    const id = entries && entries[k];
    const v = values[k];
    if (id && v !== undefined && v !== null && String(v) !== '') p.set(id, String(v));
  });
  return p;
}
function formConfigured(cfg) { return !!(cfg && cfg.action && /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/.test(cfg.action) && cfg.entries && Object.keys(cfg.entries).length); }
async function postForm(cfg, values, fetchImpl) {
  if (!formConfigured(cfg)) throw new Error(COPY.notOpen);
  await (fetchImpl || fetch)(cfg.action, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody(cfg.entries, values).toString() });
}

// A hidden-by-request set kept in this browser so a removal request takes the
// pin off the map straight away; the review scan sets "hidden": true for
// everyone else. Stores listing numbers only.
const HIDDEN_KEY = 'hfhidden:2026';
function loadHidden(storage) { try { const v = JSON.parse(storage.getItem(HIDDEN_KEY) || '[]'); return Array.isArray(v) ? v.filter(Number.isInteger) : []; } catch { return []; } }
function rememberHidden(storage, num) { try { const s = new Set(loadHidden(storage)); s.add(num); storage.setItem(HIDDEN_KEY, JSON.stringify([...s])); } catch { /* storage unavailable */ } }

const api = { COPY, MAX_PHOTO_BYTES, WHY_MAX, parseMatched, isNewJersey, streetName, sentMessage, validEmail, validateNomination, validateClaim, formBody, formConfigured, postForm, loadHidden, rememberHidden, HIDDEN_KEY, titleCase };

if (typeof document !== 'undefined') {
  // Census exact match, JSONP because the geocoder sends no CORS headers.
  api.censusExact = function (address) {
    return new Promise((resolve) => {
      const cb = '__hfCensus' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const done = (v) => { delete window[cb]; s.remove(); resolve(v); };
      const timer = setTimeout(() => done(null), 9000);
      window[cb] = (data) => {
        clearTimeout(timer);
        const m = data && data.result && data.result.addressMatches && data.result.addressMatches[0];
        done(m ? { matched: m.matchedAddress, lat: m.coordinates.y, lng: m.coordinates.x } : null);
      };
      s.onerror = () => { clearTimeout(timer); done(null); };
      s.src = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=jsonp&callback=' + cb + '&address=' + encodeURIComponent(address);
      document.head.appendChild(s);
    });
  };
  // GPS -> nearest street address (the coordinates themselves are dropped).
  api.reverseToAddress = async function (lat, lng) {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + lat + '&lon=' + lng);
      if (!r.ok) return null;
      const a = (await r.json()).address || {};
      const road = a.road, num = a.house_number;
      const town = a.city || a.town || a.village || a.hamlet || a.municipality || '';
      const state = a['ISO3166-2-lvl4'] || '';
      if (!road) return null;
      return { street: (num ? num + ' ' : '') + road, town, state: state.replace(/^US-/, ''), zip: a.postcode || '' };
    } catch { return null; }
  };
  // Re-encode to JPEG on a canvas: drops EXIF/GPS and downsizes.
  api.stripExif = async function (file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
  };
}
if (typeof module !== 'undefined') module.exports = api; else root.HFNominate = api;
}(typeof window !== 'undefined' ? window : globalThis));
