# Design review, round 3 (Oct 15, 2026, 4:50 PM)

Reviewed the live site (map, About, Alerts) at desktop width. Screenshots are in `reference/live-review/round3-*.png`.

**Fixed since round 2:** the empty event days are merged ("Sun 25 – Wed 28 · No events yet"), the filter panel has a fixed footer, the treat stop prompt is in place, and the costume tag is gone from Skully's card. Items marked **(regression)** or **(still open)** were in round 2 and are back or not done yet.

---

## P1: Fix first

1. **Remove numbers from pins and cards.** *Decided by Minerva on Oct 15. This replaces the list-position request from rounds 1–3.* Permanent listing numbers look jumbled on a nearest-first list. List-position numbers wouldn't match share links or hosts. So pins and cards will show no number at all.
   → **Pins:** show the category icon only (pumpkin, candy or square) with no number. Keep the current sizes.
   → **Cards:** remove the number badge from the card icon. The icon stays.
   → **Linking the list and the map:** connect a card and its pin by highlighting instead of by number. Hovering or focusing a card makes its pin 1.25× larger with a 2px `#F6EBD3` ring and brings it to the front (`zIndexOffset`). Hovering a pin gives its card a 1px accent border and scrolls the list to it if it's off screen. Clicking a pin selects the card, and clicking a card pans to its pin. Both stay highlighted until something else is selected.
   → **Keep the listing ID internally:** in `?house=12` share links, host pages, reviews and saved routes. Just don't display it.
   → **Keep numbers in Your Route:** the route stops stay 1, 2, 3… because their order is the driving order. On the map, pins for route stops can show a small orange route-order badge (16px, top-right corner) only while the route is open. This is the only number shown on the map.
   → On Events, also remove the 1, 2 from the purple square pins.

2. **Group pins still look like regular pins (still open).** The orange ring "6" sits right next to Will's pin "6", so they read as the same thing.
   → Use the round 2 group style: 36px circle, `#1C1626` fill, 2px accent border, accent count text (Barlow 800 14px), a second ring offset 3px behind it, and no pumpkin, candy or square shape. Once item 1 is done, a group count will be the only number on the map, so it can't be confused with a pin.

3. **Display cards must match the mock exactly. Required this round.** The live cards differ from `design/Hauntfinder v7 Compact.dc.html` in five places (`reference/live-review/round3-card-layout.png`). Build the card to the measurements below. Do not substitute a different layout.

   **3a. Host notes moves up to the hours row (new).** It sits right-aligned on the same line as the hours, just under the address.
   → Hours row: `display:flex; justify-content:space-between; align-items:baseline; gap:12px`. Hours text is Barlow 500 14px `#E4D9F2`. "Host notes" is Barlow 600 12px `#B48CFF`, `flex:none; white-space:nowrap`. **Show the link only when the listing actually has host notes.** If the notes field is empty, don't render the link at all (not grayed out, not disabled), and keep the hours left-aligned.

   **3b. Scare level and tag icons on separate rows.** On the live site the scare level sits on the hours row. In the mock it's on its own row, with the tag icons on the row below.
   → Row order: hours + Host notes → **scare row** (dots + label, Barlow 500 12px `#A89DB4`, dots `#FF7A1A`) → **icon row** (all tag icons, `display:flex; flex-wrap:wrap; gap:5px`). Never put the label and the icons on the same line, so a long scare label or many icons can't wrap into each other. Leave out either row when it's empty.

   **3c. The route button is too big.** Live it's wider and heavier than the mock.
   → Exactly: height **30px**, padding 0 12px, `min-width:118px` (fits "✓ On your route" so both states are the same width), 7px radius, 1px `#A6E22E` border, Barlow Condensed 800 **13px**, letter-spacing .08em, `flex:none`. Don't use 132px. That number in the earlier version of this item is replaced.

   **3d. The action row runs past the card edge.** "Share" pokes outside the card border on all three cards in the screenshot.
   → The action row holds the button and then, right-aligned, "No ratings yet · Rate", "Report" and "Share" on **one line, not stacked**: `display:flex; flex-wrap:nowrap; gap:12px`. The link group is `flex:1; min-width:0; display:flex; justify-content:flex-end; gap:12px`, Barlow 500/600 12px. With Host notes moved up (3a), it fits inside the card padding at the 400px list width. Nothing may extend past the card's 14px right padding. Test with "✓ On your route" showing.

   **3e. Merge the town and address lines.** The town line ("Budd Lake · 0.2 mi") repeats the town that's already in the address.
   → Under the title, show one line: the address link, without ", NJ", then "· 0.2 mi". For example, "24 Alcrest Avenue, Budd Lake ↗ · 0.2 mi". The address is Barlow 600 14px `#B48CFF`, and the distance is Barlow 500 13px `#A89DB4` with `white-space:nowrap`. Remove the separate address row. Apply this to Display and Treat Stop cards. Event cards keep their venue line.

   **3f. Hide "Not specified".** When a display has no scare level, show no dots and no label. Don't show "○○○ Not specified". The tag row starts with the chips. If there are no chips either, leave the row out.

   **3g. Small spacing fixes.**
   → Card gaps: 7px between rows, 12px 14px padding, everything below the title indented 36px to line up with the title.

   **Acceptance:** put a live card next to the mock at the same width. The rows must line up: title → address + distance → hours + Host notes → scare level → tag icons → button + links.

4. **The Alerts page is unstyled.** It uses the system font, browser-blue checkboxes, a bright cream input, default gray fieldset borders and a default underlined link.
   → Match the main site:
   - Headings in Barlow Condensed 800, body text in Barlow 400 16px `#F6EBD3`.
   - Email input: 44px tall, `#16111E` background, 1px `#3A3046` border, 6px radius, `#F6EBD3` text. On focus, a 2px `#B48CFF` outline.
   - Checkboxes: `accent-color: #FF7A1A`, 18px, at least a 44px tall row to tap.
   - Fieldsets: 1px `#2E2638` border, 8px radius. Legends in Barlow Condensed 700 13px with letter spacing, uppercase, `#B9AECB`.
   - "Back to Hauntfinder": `#B48CFF`, no underline until hover.
   - Submit button: the same lime pill as "+ Add to route".

---

## P2: Spec and consistency

5. **"Search this area" is always visible (still open).** It shows at load, before the map has moved.
   → Show it only after the visitor pans or zooms, and hide it once they click it.

6. **The focus ring stays on after a mouse click (still open).** The white outline stays on the Your Route bar (`round3-displays-route.png`).
   → Use `:focus-visible` only, the same fix as round 2 item 2, applied to the route bar and its buttons.

7. **The expanded route panel is too wide.** It is about 880px wide and covers half the map and its pins.
   → Set `max-width: 420px` and anchor it to the left edge of the map, 12px in. Add its height to the `fitBounds` bottom padding while it's open (round 2 item 5).

8. ~~**Skully's Costume Closet is tagged "Other".**~~ **Done** (`c79cd44`): it's now tagged Donation drive.

9. **The "Donation drive/Community collection" chip wraps to two lines** in the Type filter.
   → Change the chip label on the site to **Donation drive**. The Google Form can keep its longer wording because the site matches both.

10. **The About page body text is small and low-contrast.**
    → Body text at 17px, line-height 1.6, color `#E8DEC8`, max width 680px. Put 1em of space between paragraphs.

11. **The top nav is inconsistent.** About and Alerts have a top nav (Map / Submit / About / Get alerts), but the map page only has these links in the filter footer and the ☰ menu.
    → Choose one pattern. Recommended: keep the map page as it is, and give About and Alerts the same slim nav with "← Hauntfinder map" on the left, so you can always get back to the map in one click.

---

## P3: Data and polish

12a. **Remove the "Spider theme" tag from Alcrest Avenue.** Listings aren't categorized by theme, so this tag isn't an option on the form. Remove it from the record, and check other records for free-text tags that aren't in the Features list.

12. **Alcrest Avenue's hours repeat themselves:** "Halloween weekend · All weekend".
    → Change to "Halloween weekend".

13. **The scare labels are long when several levels apply:** "●●● Family Friendly · Spooky · Scary".
    → Show only the dots, with the full label in a `title` tooltip. Or show just the highest level ("●●● Scary").

14. **"Site visits: 551"** in the filter footer doesn't help visitors.
    → Remove it from the public UI and keep the number in analytics.

15. **Map attribution:** the Leaflet prefix adds a flag icon.
    → Set `attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')`, or `false` if your tile terms allow it. Keep the Esri credit.

---

16. **Icons for filters, icon-only tags on cards (new, required).** Filter chips show an icon before the label. On cards, the same tags show **only the icon**, with no text, so the cards stay short. The icons are [Lucide](https://lucide.dev) static SVGs, pinned at `lucide-static@0.460.0`. Self-host them in `assets/icons/`.
    | Tag | Icon |
    |---|---|
    | Drive-by | car |
    | Walk-up | footprints |
    | Walk-through | door-open |
    | Drive or walk by (both) | route |
    | Lights | lightbulb |
    | Fog | cloud-fog |
    | Animatronics | bot |
    | Live Actors | drama |
    | Music / Sound | music |
    | Photo opportunities | camera |
    | Spooky decor | ghost |
    | Yard display | fence |
    | Stroller friendly | baby |
    | Porch light on | lamp |
    | Free | gift |
    | Open to all | users |
    | Registration required | clipboard-list |
    | Kid-friendly | smile |
    → **Filter chip:** a 14px icon, 6px gap, then the label. The icon takes the chip's text color, so it turns orange when the chip is on.
    → **Card tag:** a 26px circle with a 1px `#3A3046` border and a 14px `#CFC4B0` icon. Set `title` and `aria-label` to the full tag name so it shows on hover and is read by screen readers.
    → **Tags without icons** (a new tag added later) fall back to the current text pill, so nothing disappears.
    → **No icons for:** When (time choices), Scare level (it uses the dots), and the Event type (it has its own color and label).
    → Add a short icon key to the About page so visitors can learn what each icon means.

17. **Remove the ♡ save button from cards.** Visitors don't have accounts, so saves would only live in one browser, and the site has no Saved list. "+ Add to route" already lets visitors keep places they want to visit. Remove the button and any favorites code or storage. The title row is now the icon and the name only.

18. **Event cards: hours first, description below.** On Skully's card, the hours and the description run together in one paragraph.
    → Give events a separate **hours** field. Card order: date → venue ↗ → hours (Barlow 500 14px `#E4D9F2`, its own line) → description (Barlow 400 14px/1.45 `#CFC4B0`) → tag icons.
    → Data fix for Skully's: hours "Weekdays 5–8 PM · Weekends 10 AM–6 PM", description "Free costumes for infants, kids, and adults."
    → Leave the hours line out when it's empty. If the Events form only has one free-text field, add an optional "Hours" field to it.

## Checklist

- [ ] 1 Numbers removed from pins and cards; hover highlight links card and pin; route-order badges only while the route is open
- [ ] 2 Group pin style
- [ ] 3a Host notes on the hours row
- [ ] 3b Scare row and icon row on separate lines
- [ ] 3c Route button 30px tall, 118px min width, 13px text
- [ ] 3d Action row on one line, inside the card padding
- [ ] 3e Town line merged into the address line
- [ ] 3f "Not specified" hidden
- [ ] 3g Card gaps
- [ ] 4 Alerts page styled
- [ ] 5 Search this area only after pan or zoom
- [ ] 6 `:focus-visible` on the route bar
- [ ] 7 Route panel max 420px
- [x] 8 Skully's → Donation drive (`c79cd44`)
- [ ] 9 Chip label changed to Donation drive
- [ ] 10 About page text size
- [ ] 11 Same nav pattern on all pages
- [ ] 12 Alcrest hours
- [ ] 12a Spider theme tag removed; no tags outside the Features list
- [ ] 3a Host notes link only when notes exist
- [ ] 13 Scare labels shortened
- [ ] 14 Site visits removed
- [ ] 15 Leaflet prefix
- [ ] 17 ♡ save button removed
- [ ] 18 Event hours on their own line above the description
- [ ] 16 Filter icons, icon-only card tags with tooltips
