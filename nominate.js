// nominate.html: community-spotted house nomination. Logic lives in nominate-lib.js.
(function () {
'use strict';
const N = window.HFNominate, cfg = (window.HF_NOMINATIONS || {});
const $ = (id) => document.getElementById(id);
const place = { street: '', town: '', lat: null, lng: null };
let photoBlob = null;

function show(id, text) { const el = $(id); el.textContent = text || ''; el.hidden = !text; }
function setLoc(state, message) {
  // state: start | finding | found | problem
  $('locStart').hidden = state === 'finding' || state === 'found';
  $('locFinding').hidden = state !== 'finding';
  $('locFound').hidden = state !== 'found';
  $('locHint').hidden = state === 'problem';
  $('addrInput').classList.toggle('is-problem', state === 'problem');
  $('useLocation').hidden = state === 'problem' && !!$('addrInput').value && message === N.COPY.outsideNJ;
  show('locMsg', message || '');
}
function applyPlace(p) {
  place.street = p.street; place.town = p.town; place.lat = p.lat; place.lng = p.lng;
  $('foundStreet').textContent = p.street;
  $('townInput').value = p.town;
  setLoc('found');
}
async function verify(candidate) {
  // Exact Census match only, and New Jersey only.
  const q = [candidate.street, candidate.town, candidate.state || 'NJ', candidate.zip].filter(Boolean).join(', ');
  const hit = await N.censusExact(q);
  const parsed = hit && N.parseMatched(hit.matched);
  if (!parsed) return { problem: N.COPY.noMatch };
  if (!N.isNewJersey(parsed)) return { problem: N.COPY.outsideNJ };
  return { ok: { street: parsed.street, town: parsed.town, lat: hit.lat, lng: hit.lng } };
}
async function fromTyped() {
  const raw = $('addrInput').value.trim();
  if (!raw) return;
  setLoc('finding');
  // A typed address that names another state is rejected before any lookup.
  const stateMatch = /,\s*([A-Za-z]{2})\b\.?(?:\s+\d{5})?\s*$/.exec(raw);
  if (stateMatch && stateMatch[1].toUpperCase() !== 'NJ') { setLoc('problem', N.COPY.outsideNJ); return; }
  const r = await verify({ street: raw.replace(/,\s*NJ.*$/i, ''), state: 'NJ' });
  if (r.ok) applyPlace(r.ok); else setLoc('problem', r.problem);
}
function useMyLocation() {
  if (!navigator.geolocation) { setLoc('problem', N.COPY.noMatch); return; }
  setLoc('finding');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const addr = await N.reverseToAddress(pos.coords.latitude, pos.coords.longitude);
    if (!addr) { setLoc('problem', N.COPY.noMatch); return; }
    if (addr.state && addr.state !== 'NJ') { $('addrInput').value = [addr.street, addr.town, addr.state].filter(Boolean).join(', '); setLoc('problem', N.COPY.outsideNJ); return; }
    const r = await verify({ street: addr.street, town: addr.town, state: 'NJ', zip: addr.zip });
    if (r.ok) applyPlace(r.ok); else { $('addrInput').value = ''; setLoc('problem', r.problem); }
  }, () => setLoc('problem', N.COPY.noMatch), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

$('useLocation').addEventListener('click', useMyLocation);
$('addrInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fromTyped(); } });
$('addrInput').addEventListener('change', fromTyped);
$('locChange').addEventListener('click', () => { place.street = ''; place.lat = place.lng = null; $('addrInput').value = ''; setLoc('start'); $('addrInput').focus(); });
$('whyInput').addEventListener('input', () => { $('whyCount').textContent = $('whyInput').value.length + ' / 140'; });

$('photoInput').addEventListener('change', async () => {
  const file = $('photoInput').files[0];
  photoBlob = null; show('photoMsg', ''); $('photoPreview').hidden = true; $('photoEmpty').hidden = false;
  if (!file) return;
  if (file.size > N.MAX_PHOTO_BYTES) { show('photoMsg', 'That photo is over 8 MB. Please pick a smaller one.'); $('photoInput').value = ''; return; }
  try {
    photoBlob = await N.stripExif(file);
    $('photoPreview').src = URL.createObjectURL(photoBlob); $('photoPreview').hidden = false; $('photoEmpty').hidden = true;
  } catch { show('photoMsg', 'We couldn’t read that photo. Try a JPG or PNG.'); $('photoInput').value = ''; }
});

async function uploadPhoto() {
  if (!photoBlob) return '';
  if (typeof HFBlob === 'undefined' || !HFBlob.upload) throw new Error('Photo upload is unavailable right now. You can send the nomination without a photo.');
  const res = await HFBlob.upload('nominations/' + Date.now() + '.jpg', photoBlob, { access: 'public', contentType: 'image/jpeg', handleUploadUrl: cfg.photoApi || '/api/upload' });
  return res.url;
}

$('nominateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = { street: place.street, town: $('townInput').value.trim(), publicStreet: $('publicStreet').checked, email: $('emailInput').value.trim(), why: $('whyInput').value };
  const errors = N.validateNomination(data);
  show('locMsg', errors.location || ''); show('publicMsg', errors.publicStreet || ''); show('emailMsg', errors.email || '');
  $('townInput').closest('.nom-input').classList.toggle('is-problem', !!errors.town);
  if (errors.town) show('formMsg', errors.town); else show('formMsg', '');
  if (Object.keys(errors).length) { const first = document.querySelector('.nom-error:not([hidden]), .is-problem'); if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center' }); return; }
  const btn = $('sendBtn'); btn.disabled = true;
  try {
    if (!N.formConfigured(cfg.nominate)) throw new Error(N.COPY.notOpen);
    const photo = await uploadPhoto();
    await N.postForm(cfg.nominate, {
      street: data.street, town: data.town, lat: place.lat, lng: place.lng, photo,
      why: data.why.trim(), best: $('bestInput').value, litUntil: $('litInput').value,
      nickname: $('nickInput').value.trim(), email: data.email
    });
    $('sentText').textContent = N.sentMessage(data.street, !!data.email);
    $('nominateForm').hidden = true; $('nominateSent').hidden = false; window.scrollTo(0, 0);
    document.querySelector('.nom-back').hidden = true;
  } catch (err) { show('formMsg', err.message || 'Something went wrong. Please try again.'); btn.disabled = false; }
});
}());
