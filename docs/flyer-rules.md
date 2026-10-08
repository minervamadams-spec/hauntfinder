# Approved Hauntfinder flyer rules, October 8, 2026

## Approved sources
Visual templates: assets/flyer-templates/displays-approved.jpg, events-approved.jpg and treat-stops-approved.jpg. Example entries, PREVIEW signs, TEMPLATE ONLY labels and XX dates are not public listing data.

The complete five-page release is assets/flyer-sources/approved-guide.pdf. Preserve the first three original display pages' approved artwork, correcting supplied facts only. Page 4 contains Capone's and Blaze and Bones; page 5 contains Best Buddies and empty event slots. Never duplicate listings to fill slots.

## Layout
Match bold rough condensed lettering, cream textured distressed borders, pictograms, orange/green/purple numbered badges, purple wood signs, lanterns, pumpkins, friendly spooky scenes and illustrated footers. Do not substitute plain sans-serif lists or rounded app cards.

Additional Displays pages: three equal slots, artwork left and visitor facts right. Displays and costume closets only. Keep stable map numbers; incomplete pages retain matching blank slots.

Events: separate purple-branded pages, four equal quarter-page cards in a 2x2 grid, date badges, short illustrated strips and parchment visitor details. Include supplied dates/ranges, hours, venue/address, prices, restrictions, registration and notes. Ongoing drives show supplied deadlines and actual drop-off hours. Never invent times. Keep unused cards blank.

Treat Stops: separate green candy-branded pages with eight compact cream parchment rows and candy-number badges; no large image per row. Include address/town, treat dates/hours and parking/access notes. Omit until actual consented listings exist.

## Release process
Compare every public app.js listing and event to the flyer on every run, even without new forms. Keep website and assets/hauntfinder-2026-listings.pdf synchronized. Preserve manually approved corrections, UI, form links and PDF URL. Keep private contacts out of public files.

Use image generation guided by the approved templates for illustrated raster changes. Preserve unchanged approved artwork. Use PDF tools for assembly, factual text and counters. Render and inspect every affected page for facts, text, icons, clipping, category separation and trim buffer.

After validation, refresh approved-guide.pdf and manifest.json, including the SHA-256 of app.js before const filters=. The build script restores that exact release only when public data still matches and refuses stale facts. Never use the rejected old layout generator. Retain reproducible verified sources in this repository.

Publish fast-forward commits only. Verify Vercel succeeded and live PDF bytes match release bytes. Update any site-referenced flyer previews.

## Standing corrections
The Walking Dead- End at 14 Sunset Dr opens October 10. Rose Lane supports Drive or walk by (both). Adams Family Haunt and Skully's Costume Closet remain separate listings at the same true coordinates. Blaze and Bones at 7 Eisenhower St is a DISPLAY: display hours 6-10 PM; treats on Halloween; treat hours not supplied.
