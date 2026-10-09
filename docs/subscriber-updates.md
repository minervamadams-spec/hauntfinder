# Community listing alerts

Sender: Mount Olive Hauntfinder, MTOCommunityFinder@gmail.com; reply-to is the community Gmail. The footer directs readers to Contact Us. There is no monitored personal reply inbox in the notification flow.

## Deployment and activation
- Vercel Production already has BREVO_API_KEY and CRON_SECRET. Never print or commit values. CRON_SECRET must be at least 32 characters. Keep this value stable: it signs subscriber links and derives opaque IDs.
- Google spreadsheet: MTO Community Finder Subscribers. Its identifier and URL belong in private configuration, not this repository. Keep sharing restricted. Subscribers and Deliveries are private data. Setup records connection state.
- Bind scripts/subscriber-sheet.gs via Extensions > Apps Script. Set CRON_SECRET in Script properties, run configureCommunityAlerts, authorize, then deploy as owner with Anyone access. Only signed, time-bounded POSTs can write; there is no data-read endpoint. Keep sheet sharing private.
- Save its /exec URL as SUBSCRIBER_SHEET_URL in Vercel Production. Redeploy so variables take effect. Run checkCommunityAlerts in Apps Script; it must report storage, senderVerified, emailAccount, sheetConnected as true. Do not paste keys into chat or logs.
- Set NEWSLETTER_ENABLED=true only after connection checks pass. The public links remain hidden until enabled. The alerts page displays unavailable while setup is incomplete.
- Test signup using Minerva's chosen address, confirm choices, inspect the private sheet, and test unsubscribe. Do not add sample listings to production. Test summaries with mocked data only, or use Brevo sandbox. Never send a public campaign as a test.
- Google Apps Script triggers daily around 5 PM America/New_York (nearMinute has approximate timing). It handles DST automatically and removes prior triggers with the same handler when configured again. No new ChatGPT task or Vercel paid cron is needed.

## Data and delivery rules
- Preserve this feature during the hourly listing/flyer workflow. Every genuinely new numbered entity needs a unique entityId; retain it on updates and category moves. For a legacy display moving into Events, retain its identity (hauntfinder:2026:listing:NUMBER:original) as entityId. Do not use updatedAt to infer newness.
- Redis uses a separate mtocommunity:subscribers:v1 namespace. Nothing changes visitor counts or review storage. Pending confirmation expires after 24 hours; an unconfirmed subscriber record expires after seven days.
- Double opt-in applies to new subscribers and changed preferences. Existing preferences stay active until new choices are confirmed. GET confirmation/unsubscribe links do not mutate records, protecting against link scanners. Unsubscribe is explicit POST; RFC 8058 one-click POST is supported.
- Category choices: displays, events, treats; season choices: halloween, holiday. Daily summaries only. Current catalog is Halloween; Holiday consent is stored for future use, without automatic opt-in.
- A signup baseline excludes listings already present at signup. Stable IDs identify previously delivered listings: entityId for reused/new numbered entries, event id for events, original numbered identity for legacy listings. Edits and sorting cannot create new notifications. Every future genuinely new or reused numbered entity needs a distinct entityId in app.js. Preserve IDs across category moves.
- Current app.js is bundled into each API function; the digest reads its public data. New release data is automatically available without generating a separate mailing catalog. Public data and flyer rules remain unchanged.
- Confirmed records are mirrored to Brevo Contacts. Redis status is authoritative for unsubscribes; digest also checks Brevo emailBlacklisted before every send. It never revives opted-out contacts except after a new explicit confirmation.
- Each subscriber gets only selected categories/seasons and unseen IDs. Closed/cancelled entries and expired timed events are withheld. No message when there are no new matching entries. Former identity ratings/routes are not used in mailings.
- Five accepted messages maximum per API invocation. Apps Script continues batches within its runtime budget. A shared Redis send allowance caps API sends at 280/day, leaving headroom under the free 300 allowance. Other manually sent Brevo mail can still exhaust quota. Excess recipients remain eligible for the next day.
- Persist the attempt before sending; ambiguous provider/network outcomes leave a delivery hold rather than risk duplicate emails. Holds appear in Deliveries. Reconcile against Brevo logs before explicitly resolving them; never blindly retry uncertain deliveries.
- Dirty subscriber/delivery records sync on the daily job. Failed mirror writes stay queued, and repeated upserts use IDs instead of appending duplicates. Do not treat a prepared sheet as a working connection.

## Verification
node --test tests/*.test.js; node --check on changed JS; python scripts/validate-release.py. Publication requires current-main fast-forward and successful Vercel commit status. Check live app.js and PDF against main; there is no PDF regeneration for this feature because public listing facts do not change.
