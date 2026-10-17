# Shops, Makers & Services advertising workflow

> Index: public advertising data · approval and expiry · intake-form setup

`shops-ads.js` is browser-loaded public data. Add only approved public information: never private contact details, home addresses, or unreviewed responses.

## Publish, update, expire

1. Save an optimized business-supplied image under `assets/shops/`. Photos and finished ads should be 1200 × 900; preserve logo proportions.
2. Add one record to `shops-ads.js` with stable `id`, public card fields, `businessType` (`goods`, `services`, or `both`), `category`, HTTPS `url`, `linkType`, media information, `displayOrder`, `status`, and optional `startDate` / `expirationDate` (`YYYY-MM-DD`).
3. Set `status: 'approved'` only after manual review. The page evaluates approval and active dates in America/New_York for every page load. Set a record to `draft` or `expired`, or remove it, to hide it after deployment.
4. Verify the destination, matching button type, rights confirmation, alt text, public location/service area, and only applicable availability chips. Do not add unconfirmed capabilities.

The page shuffles eligible cards on load; `displayOrder` is retained for administration and does not create ranking or paid placement.

## Intake form

Do not change the existing display/treat/event Google Forms. Advertising uses a separate owner-managed form. It collects business name; private contact name and email; goods/services/both; category; public location/service area; applicable pickup/shipping or appointment/travel/service-area details; 40-word description; HTTPS destination; image upload; alt text; and content-rights/publication authorization.

Use conditional goods/service questions where supported. Keep all responses manually reviewed; never automatically copy submissions into `shops-ads.js`. `#advertiseLink` on the Shops page goes to `submit.html`. That page offers the intake form as "Shops, Makers & Services – free ad" (`target="_blank"` `rel="noopener"`). The form asks for a Google sign-in so the photo can upload, and ads are reviewed before they go live. Questions still go to the Hauntfinder contact email from the smaller "Questions? Email us" link. Never copy private contact fields from form responses into this repository.
