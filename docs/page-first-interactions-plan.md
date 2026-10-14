# Page-first interaction plan

> Index: Replace fragile in-page dialogs with addressable, independently testable routes.

## Decision

Interactive flows that need form fields, scroll space, shareable state, or external data will use dedicated pages. Lightweight confirmations may remain inline only when they do not block browsing.

Alerts already follows this model: the homepage links to `/alerts.html`; there is no alerts modal or automatic prompt.

## Routes to build

| Current dialog | Replacement route | First release scope |
| --- | --- | --- |
| `typeDialog` | `/submit.html` | Choose display, treat stop, or event; link to the appropriate form. |
| `feedbackDialog` | `/listing.html?id={id}#feedback` | Read feedback and submit a review in the listing context. |
| `listingReportDialog` | `/listing.html?id={id}#report-update` | Report a weather closure or corrected listing detail. |
| `houseShareDialog` | `/listing.html?id={id}#share` | Copy/share post and download the listing image. |
| `aboutDialog` | `/about.html` | Move the community story to a permanent, shareable page. |
| `routeSheet` | `/route.html?stops={encoded}` | Manage route stops and open directions; preserve URL state. |

## Delivery order

1. Build the shared page shell and a small route parser/validator.
2. Ship `/submit.html` and `/about.html`; replace their buttons with normal links.
3. Build `/listing.html` and move feedback, reports, and sharing behind an explicit listing id.
4. Build `/route.html`, retaining current route links and local-storage migration.
5. Remove each dialog's markup, controller, CSS, and tests only after its replacement route passes production QA.

## Acceptance criteria for every route

- A direct URL returns a complete usable page with JavaScript disabled messaging where relevant.
- Back/forward, reload, deep links, keyboard focus, and Escape behave predictably.
- The page has one focused production test that checks the actual visible controls—not merely that a script or endpoint exists.
- The live QA job confirms the deployed HTML matches the current commit and follows each critical route.
- No flow opens automatically or overlays the map/listing view.

## Rollback

Each route replacement is its own commit. If a release fails live QA, restore the previous normal link or page route; do not reintroduce an auto-opening dialog.
