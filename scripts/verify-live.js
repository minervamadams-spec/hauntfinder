// Post-deploy live verification for https://hauntfinder.vercel.app
// Run after every push/deploy:  node scripts/verify-live.js
// Exits non-zero with a FAIL line for every broken check.
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.HF_BASE || 'https://hauntfinder.vercel.app';
// Static assets that must match the just-pushed commit byte-for-byte.
const ASSETS = ['index.html', 'styles.css', 'app.js', 'layout.js', 'alerts.css', 'community.js', 'photos-ui.js', 'listing.html', 'listing.js', 'page.js', 'listing-format.js', 'routing.js', 'schedules.js', 'url-state.js', 'route.html', 'route.js'];
// Public Google Form links wired in community.js (live HEAD must be 200).
const FORM_LINK_RE = /(https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform)/g;

let failures = 0;
const ok = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!pass) failures++;
};
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const localSha = (f) => sha(fs.readFileSync(path.join(__dirname, '..', f)));

(async () => {
  // 1. Site up and serving the app shell.
  const home = await fetch(BASE + '/');
  const homeHtml = await home.text();
  ok('site responds 200 with app shell', home.status === 200 && homeHtml.includes('href="alerts.html"') && !homeHtml.includes('id="alertsDialog"'), `status=${home.status}`);

  // 2. Every key asset on production matches this checkout (deploy freshness).
  for (const f of ASSETS) {
    const res = await fetch(`${BASE}/${f}`);
    const remote = sha(Buffer.from(await res.arrayBuffer()));
    ok(`asset live == local: ${f}`, res.status === 200 && remote === localSha(f), res.status === 200 ? '' : `status=${res.status}`);
  }

  // 2b. Single-scroll, map-first homepage: map before the cards, one 8-card
  // pager, no Map/List switch.
  ok('homepage is map-first with the card pager and no Map/List switch', homeHtml.indexOf('class="map-frame"')>-1 && homeHtml.indexOf('class="map-frame"')<homeHtml.indexOf('id="cardList"') && homeHtml.includes('id="resultsPager"') && !homeHtml.includes('class="view-toggle"'));

  // 2c. Route planner is a page (/route.html); the homepage links to it and
  // carries no route sheet.
  const routeRes=await fetch(BASE + '/route.html');
  const routeHtml=await routeRes.text();
  ok('route page serves the planner with one h1 and no dialog', routeRes.status===200 && (routeHtml.match(/<h1[ >]/g)||[]).length===1 && ['id="routePlanner"','id="routeEmpty"','id="clearConfirm"','id="backToMap"'].every(x=>routeHtml.includes(x)) && !routeHtml.includes('<dialog'), `status=${routeRes.status}`);
  ok('homepage route CTA links to /route.html and the route sheet is gone', homeHtml.includes('id="routeLink" href="route.html"') && !homeHtml.includes('id="routeSheet"'));

  // 3. Alerts are a standalone page; the homepage must never carry an alert
  // modal or an embedded form that can obstruct browsing.
  ok('homepage has a direct alerts-page link and no alerts modal', homeHtml.includes('href="alerts.html"') && !homeHtml.includes('id="alertsDialog"') && !homeHtml.includes('alertsInlineForm'));

  // 4. Page-first routes: the two shipped subpages serve real controls and
  // stay dialog-free; the homepage footer points at them.
  const FORMS_RE=/https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform/g;
  const submitRes=await fetch(BASE + '/submit.html');
  const submitHtml=await submitRes.text();
  const submitLinks=[...new Set(submitHtml.match(FORMS_RE)||[])];
  ok('submit page serves three form options with no dialog', submitRes.status===200 && submitLinks.length===3 && !submitHtml.includes('<dialog'), `${submitLinks.length} form links`);
  const aboutRes=await fetch(BASE + '/about.html');
  const aboutHtml=await aboutRes.text();
  ok('about page serves the community story with no dialog', aboutRes.status===200 && aboutHtml.includes('The Family Behind the Skeleton House') && !aboutHtml.includes('<dialog'), `status=${aboutRes.status}`);
  const listingRes=await fetch(BASE + '/listing.html?id=12');
  const listingHtml=await listingRes.text();
  ok('listing page serves feedback, report and share sections with no dialog (listing.html?id=12)', listingRes.status===200 && ['id="feedback"','id="report-update"','id="share"'].every(s=>listingHtml.includes(s)) && !listingHtml.includes('<dialog'), `status=${listingRes.status}`);
  ok('listing page carries category/type, hours, add-to-route, map preview and the map-view link (listing.html?id=12)', ['id="listingCategory"','id="listingTypes"','id="listingHours"','id="listingRouteBtn"','id="listingMap"','id="listingOnMap"','<script src="listing-format.js"></script>'].every(s=>listingHtml.includes(s)));
  try {
    const appLive=await (await fetch(BASE + '/app.js')).text();
    ok('listing #12 Harvesters of Souls is in the live listing data', appLive.includes('"entityId": "harvesters-of-souls-2026"') && appLive.includes('"num": 12'));
  } catch (e) { ok('listing #12 Harvesters of Souls is in the live listing data', false, String(e.message)); }
  ok('homepage footer links to the page-first routes', homeHtml.includes('href="submit.html"') && homeHtml.includes('href="about.html"'));

  // 5. Subscriptions API answers.
  try {
    const sub = await (await fetch(BASE + '/api/subscriptions')).json();
    ok('subscriptions API answers with availability', typeof sub.available === 'boolean', `available=${sub.available}`);
  } catch (e) { ok('subscriptions API answers with availability', false, String(e.message)); }

  // 6. Public photos API answers for a known listing.
  try {
    const photos = await (await fetch(`${BASE}/api/photos?num=1&cb=${Date.now()}`)).json();
    ok('public photos API answers', Array.isArray(photos.photos), `${photos.photos.length} approved`);
  } catch (e) { ok('public photos API answers', false, String(e.message)); }

  // 7. Admin surface stays locked without a bearer token.
  const noAuth = await fetch(BASE + '/api/photo-review');
  ok('photo-review rejects anonymous access', noAuth.status === 403, `status=${noAuth.status}`);
  const noAuth2 = await fetch(BASE + '/api/host-link');
  ok('host-link list rejects anonymous access', noAuth2.status === 403, `status=${noAuth2.status}`);

  // 8. Form links wired in the live submit page all resolve.
  const liveSubmit = await (await fetch(BASE + '/submit.html')).text();
  const formLinks = [...new Set(liveSubmit.match(FORM_LINK_RE) || [])];
  ok('submit page carries the three Google Form links', formLinks.length === 3, `${formLinks.length} found`);
  for (const url of formLinks) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      ok(`form link resolves: ...${url.slice(-28)}`, r.status === 200, `status=${r.status}`);
    } catch (e) { ok(`form link resolves: ...${url.slice(-28)}`, false, String(e.message)); }
  }

  // 9. Map library assets reachable (a dead CDN breaks the map silently).
  try {
    const lf = await fetch('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', { method: 'HEAD' });
    ok('leaflet CSS CDN reachable', lf.status === 200, `status=${lf.status}`);
  } catch (e) { ok('leaflet CSS CDN reachable', false, String(e.message)); }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll live checks passed.');
  process.exit(failures ? 1 : 0);
})();
