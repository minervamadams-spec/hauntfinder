# Halloween Display & Haunt Finder — Implemented Prototype

Open `index.html` in Chrome/Edge/Safari with an internet connection.

## Organizer photos

Hosts use their private update link to preview and post a photo in the browser. Organizers use `organizer.html` with an `ORGANIZER_KEY` configured in Vercel; the legacy `scripts/import-drive-photo.js` is a fallback only for private Drive uploads.

Included:
- Approved Halloween visual direction
- Custom numbered pumpkin pins from the supplied design package
- CARTO Dark Matter map tiles
- Mobile-first responsive layout
- Filters
- Pin/card linked states
- Listing cards show all feature tags and full host notes without expanding
- Add-to-route / Added state
- Directions links
- Route planner that opens Google Maps
- Share button
- Shareable outing links (`?outing=`) that load a route on any device
- 11 curated listings (10 displays, 1 treat stop) and 2 events

Notes:
- Listing and event coordinates are verified at street address at import time (see docs/update-workflow.md) and stored in `app.js`; nothing is geocoded in the visitor's browser.
- For a public launch, host this folder on a static host such as Cloudflare Pages, Netlify, Vercel, GitHub Pages, or similar.

## Location search

- Visitors search by ZIP or device location, choose a 5/10/25/50-mile radius, and see results across Displays, Treat Stops and Events sorted nearest-first. Card distances are straight-line (haversine) miles from the search area — driving mileage is always longer and lives in the per-card Directions link.
- `data/zip-centroids.json` is a static ZIP→centroid table for NJ, NY and PA built from the U.S. Census Bureau 2023 Gazetteer ZCTA file (public domain). Rebuild it with `python3 scripts/build-zip-table.py`; to add a state, add its 3-digit ZIP prefixes to the state list in that script and rerun it.
- Search preferences live only on the visitor's device (`hfsearch:v1`); no location data is sent to any server or analytics.
- `location.js` holds the pure distance/search functions and is Node-testable like `routing.js` (`node --test tests/*.test.js`).

## Community features

- Mobile: route planner follows the house cards; a fixed bottom route button appears once a stop is selected.
- Each house’s listing page (`listing.html?id=N`) has an accessible feedback section with name, a 1–5 crow rating, comment and an automatic server timestamp. Feedback appears publicly immediately.
- Footer keeps the listing forms, a link to the About page (`about.html`: Hauntfinder + Skully + costume closet), Skully’s Closet information, donation details, Facebook, Instagram and email links.

## Activate shared feedback

Feedback uses a Vercel Node function at `/api/feedback` and durable Upstash Redis storage. No database credentials are shipped to the browser. Without configuration, visitors can preview the form but cannot post, and the feedback section says setup is pending.

1. In the Vercel `hauntfinder` project, open Storage and connect an Upstash Redis database.
2. Set production environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from that database's REST connection settings. Some Marketplace connections use `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead; these aliases are supported too.
3. Redeploy the production branch, then open a home's feedback window to confirm posting is available.

Comments are stored per home and season, newest first. The listing page shows the latest 200 reviews; its average reflects those reviews. Posts are limited to five per ten minutes per hashed IP; raw IP addresses are not saved. Each comment has an email report link containing its review ID. Remove reported comments from the database list if needed.

Run backend checks with `node --test tests/feedback.test.js`.

Sources for Skully's public information: https://mtolivelife.com/skullys-free-costumes-for-all-returns-this-fall/ and https://mountoliveonline.today/mo-online-5-19-2025.
