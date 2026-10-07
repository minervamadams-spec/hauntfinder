# Halloween Display & Haunt Finder — Implemented Prototype

Open `index.html` in Chrome/Edge/Safari with an internet connection.

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
- Current 6 real listings from the Google response sheet

Notes:
- Addresses are geocoded in the browser the first time the page loads and then cached locally.
- For a public launch, host this folder on a static host such as Cloudflare Pages, Netlify, Vercel, GitHub Pages, or similar.
- A future version can read approved listings from a public data endpoint instead of hardcoded JavaScript.

## Community features

- Mobile: route planner follows the house cards; a fixed bottom route button appears once a stop is selected.
- Each house opens an accessible feedback dialog with name, a 1–5 crow rating, comment and an automatic server timestamp. Feedback appears publicly immediately.
- Footer includes the original illustrated flyer for houses 1–3, a printable current guide for all houses, Skully’s Closet information, donation details, Facebook, Instagram and email links.

## Activate shared feedback

Feedback uses a Vercel Node function at `/api/feedback` and durable Upstash Redis storage. No database credentials are shipped to the browser. Without configuration, visitors can preview the form but cannot post, and the dialog says setup is pending.

1. In the Vercel `hauntfinder` project, open Storage and connect an Upstash Redis database.
2. Set production environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from that database's REST connection settings. Some Marketplace connections use `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead; these aliases are supported too.
3. Redeploy the production branch, then open a home's feedback window to confirm posting is available.

Comments are stored per home and season, newest first. The dialog shows the latest 200 reviews; its average reflects those reviews. Posts are limited to five per ten minutes per hashed IP; raw IP addresses are not saved. Each comment has an email report link containing its review ID. Remove reported comments from the database list if needed.

Run backend checks with `node --test tests/feedback.test.js`.

Sources for Skully's public information: https://mtolivelife.com/skullys-free-costumes-for-all-returns-this-fall/ and https://mountoliveonline.today/mo-online-5-19-2025.
