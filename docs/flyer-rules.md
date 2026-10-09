# Approved Hauntfinder flyer rules, October 8, 2026

## Approved sources
Visual templates: assets/flyer-templates/displays-approved.jpg, events-approved.jpg and treat-stops-approved.jpg. Example entries, PREVIEW signs, TEMPLATE ONLY labels and XX dates are not public listing data.

The complete five-page release is assets/flyer-sources/approved-guide.pdf. Preserve the first three original display pages' approved artwork, correcting supplied facts only. Page 4 contains Capone's and Blaze and Bones; page 5 contains Best Buddies and empty event slots. Never duplicate listings to fill slots.

## Layout
Match bold rough condensed lettering, cream textured distressed borders, pictograms, orange/green/purple numbered badges, purple wood signs, lanterns, pumpkins, friendly spooky scenes and illustrated footers. Do not substitute plain sans-serif lists or rounded app cards.

Additional Displays pages: three equal slots, artwork left and visitor facts right. Displays only; Skully’s Costume Closet belongs to Events. Keep stable map numbers; incomplete pages retain matching blank slots.

Events: separate purple-branded pages, four equal quarter-page cards in a 2x2 grid, date badges, short illustrated strips and parchment visitor details. Include supplied dates/ranges, hours, venue/address, prices, restrictions, registration and notes. Ongoing drives show supplied deadlines and actual drop-off hours. Never invent times. Keep unused cards blank.

Treat Stops: separate green candy-branded pages with eight compact cream parchment rows and candy-number badges; no large image per row. Include address/town, treat dates/hours and parking/access notes. Omit until actual consented listings exist.

## Release process
Compare every public app.js listing and event to the flyer on every run, even without new forms. Keep website and assets/hauntfinder-2026-listings.pdf synchronized. Preserve manually approved corrections, UI, form links and PDF URL. Keep private contacts out of public files.

Use image generation guided by the approved templates for illustrated raster changes. Preserve unchanged approved artwork. Use PDF tools for assembly, factual text and counters. Render and inspect every affected page for facts, text, icons, clipping, category separation and trim buffer.

Build current facts with scripts/build-flyer.py, then validate with scripts/validate-release.py. The archived approved-guide.pdf and extracted artwork-*.jpeg supply approved artwork only; never copy their old factual text. Listing text uses embedded condensed fonts, not image generation. Retain the approved scenes, distressed borders and illustrated headings. manifest.json records current public-data and PDF hashes. Never edit hashes to bless stale facts. See docs/update-workflow.md for the full run and publication procedure.

Publish fast-forward commits only. Verify Vercel succeeded and live PDF bytes match release bytes. Update any site-referenced flyer previews.

## Standing corrections
The Walking Dead- End at 14 Sunset Dr opens October 10. Rose Lane supports Drive or walk by (both). Adams Family Haunt and Skully's Costume Closet remain separate offerings at the same address, in Displays and Events respectively. Blaze and Bones at 7 Eisenhower St is a DISPLAY: display hours 6-10 PM; treats on Halloween; treat hours not supplied.

## Stable numbering acceptance rules, October 8, 2026
- Never renumber existing listings after a move, removal or insertion. Preserve every remaining published number, direct link, map pin and route reference.
- A moved or removed numbered listing leaves a gray non-interactive placeholder in its original category and position. It is not an active listing, map destination, route stop or review target and is excluded from active counts. Do not geocode it.
- Assign the next genuinely new approved entity the lowest vacant number before allocating a new number. Replace the placeholder in place. Updates and re-imports are not new entities.
- On slot reuse, clear/archive the former entity's feedback and importer associations; prevent old saved routes or share links from silently identifying the replacement as the former entity. Never transfer old ratings to the new entity.
- Acceptance: active numbers stay unchanged; no duplicate numbers; vacancy is gray; no directions/route/review controls; new entity fills vacancy; website and next flyer release use identical numbering and category placement.
- Skully's Costume Closet is now an ongoing daily EVENTS entry, not a display. Its former display #8 is vacant; Adams Family Haunt remains #1, Capone’s #9 and Blaze and Bones #10.
- October 9 update round supersedes the flyer hold. Drakestown Road Display fills #8; North Rose Lane Treat Stop is #11. Skully is in Events. Update site and flyer together, with embedded crisp listing text and approved artwork.
