# Design review, round 4 (Oct 16, 2026)

Live site reviewed at desktop width: the map (all three tabs, route open and closed), Submit, Alerts and About. Screenshots are in `reference/live-review/round4-*.png`. **Every item below is required.** Any round 3 item that isn't listed here and isn't done yet still applies.

**Done since round 3:** no numbers on pins or cards, icon-only tags, the ♡ button removed, the address and town merged into one line, event hours split from the description, the Alerts page styled, and the Donation drive chip.

---

## A. New type icons (pins and cards)

1. **Replace the flat pumpkin, candy and square with the v2 icon set** in `assets/icons/v2/` (SVG sources, PNGs at 64–512px, and a README with sizes and Leaflet anchors).
   - Map pins: `pin-display.svg`, `pin-treat-stop.svg` and `pin-event.svg`. Each is an accent-colored teardrop with a dark center holding the icon. Events go back to the skull, as in the original spec, replacing today's plain purple square.
   - Cards, the route list, the map key and the Submit page: `icon-display.svg`, `icon-treat-stop.svg` and `icon-event.svg`, at 26–32px.
   - Pin sizes: 34px wide, 44px when selected (see the v2 README). Keep the ✓ on-route badge at the top right.
   - Remove the old `assets/icons/pin-*.svg` and `icon-*.svg` once they're replaced.

## B. Map tab: cards and map

2. **Host notes still shows when a listing has no notes.** Alcrest and Fifth Street both show "Host notes". Render the link only when the notes field isn't empty (round 3, item 3a). Test with a listing that has empty notes.
3. **There's a gap between the hours row and the scare row** (Fifth Street, Capone's). It's about 3× the 7px gap between other rows. An empty element, probably the Host notes slot or a margin, is taking up space. All card rows use `gap: 7px`, with no extra margins.
4. **"Hours unknown"** reads as an error. Change it to **"Hours not listed"** (same style).
5. **Pins have no selected or hover state.** Clicking or hovering a card has to change its pin: 44px, `zIndexOffset: 1000`, and a 2px `#F6EBD3` ring (round 3, item 1). This is now the only link between a card and its pin, so it has to work.
6. **Map labels are doubled.** "Budd Lake" appears twice, slightly offset, on the Treat Stops and Events maps, so the label layer is added twice. Add the reference or label layer only once.
7. **"Search this area" shows on load** (Treat Stops and Events) before the map has moved. Show it only after the visitor pans or zooms (round 3, item 5, still open).
8. **The filter panel has a big empty gap between groups.** On Treat Stops (WHEN … FEATURES) and Events (TYPE … FEATURES), the groups are spread down the full height of the panel. Stack them from the top with `gap: 24px`, with no `justify-content: space-between` and no flex-grow on the groups.

## C. Route panel (expanded)

9. **The expanded route panel is broken** (`round4-displays-route-open.png`). Fix all of these:
   - **The header is at the bottom.** "YOUR ROUTE · 2 OF 10 STOPS · COLLAPSE ▾" has to stay at the **top** of the panel, with the stops below it.
   - **The Remove links are cut off** ("Remov"). Give the stop name `flex: 1; min-width: 0` with ellipsis, and the Remove link `flex: none`.
   - **A white bar appears under the stops.** A horizontal scrollbar or an unstyled element shows as a white strip. Remove it and set `overflow-x: hidden`.
   - **A pin shows through the panel** (a faint pumpkin behind the stop list). Use a solid panel background, `#1A1322`, at full opacity.
   - **Stop names are too large** (about 30px). Use Barlow 600 16px, with 32px number circles and 12px between rows.
   - **The panel is too wide** (about 710px). Set `max-width: 420px` and anchor it 12px from the left edge of the map (round 3, item 7).
   - **"Plan your route →"** isn't in the spec, and it's unclear what it does. Remove it, or tell us what it opens.

## D. Events tab

10. **Donation drive uses Parade's color.** Both are `#B48CFF`, and so is the Events accent. Give Donation drive its own color: **`#FF6FA8`** (pink, dark text on the chip). Add it to the type-color key, the card top border, and the pin. On the pin, the accent ring stays purple and the type color goes on the card only.
11. **"Open all week" is shown twice** on Skully's card: once in the teal band header and again as the first line of the card. Remove the line from the card. The band already says it.
12. **Event cards inside a day block repeat the date.** Under "THU 29", Best Buddies shows "Thu, Oct 29", then "5:30–7 PM" on its own line. Inside a day block, show only the time ("5:30–7 PM") on one line. Keep the full date only where there's no day header (search results, the route list).
13. **Event type chips in the filter** need a 10px dot in their type color before the label, to match the key. This replaces the round 3 rule of no icons on Type.

## E. Submit page

14. **Use type colors and icons on the three option cards.** All three borders are purple right now. Use Display `#FF7A1A`, Treat stop `#A6E22E` and Event `#B48CFF`, at 2px, with a 32px v2 icon to the left of each title. The ↗ takes the card's accent color.
15. **The copy repeats itself.** The intro says "Listings are reviewed before they appear — and listing is free", and the line under the cards says "Submissions are reviewed before publication…". Use the spec copy for the intro: "What are you listing? Each form opens in Google Forms in a new tab. To update, choose the same type and use the same name. Listings are reviewed before they appear." Change the bottom line to: "Listing is free. You'll get an email if we have questions."
16. **The page title doesn't match the style.** Rubik Dirt titles are uppercase (spec 5, Type). Change it to **SUBMIT OR UPDATE A LISTING**, at 40px.

## F. Shared nav and footer (Submit, Alerts, About)

17. **The nav is styled differently on each page.** Submit uses large cream links with a bottom border. Alerts and About use smaller purple links with no border. Use one style on all three: 56px tall, 1px `#2E2638` bottom border, "← Hauntfinder map" in Barlow Condensed 700 18px `#F6EBD3`, and links in Barlow 600 16px `#B48CFF`. The current page is `#FF7A1A` with a 2px underline bar.
18. **The footer links are underlined** (Submit and About). No underlines anywhere (spec 11). Use `#B48CFF`, and underline only on hover.

## G. Alerts page

19. **The unchecked checkboxes are white squares.** Style them as 20px boxes with a `#16111E` fill, a 2px `#3A3046` border and a 4px radius. When checked: `#FF7A1A` fill with a dark ✓.
20. **The consent checkbox is misaligned.** It sits above the first line of text and outside the fieldset indent. Line it up with the first line (`align-items: flex-start; margin-top: 3px`) and use the same 26px left indent as the other rows.
21. **"Future Holiday listings"** should be **"Future holiday listings"** (sentence case, like the other options).
22. **Behavior to confirm:**
    - Checking "Limit alerts to my area" reveals the ZIP and radius fields.
    - "Send confirmation email" stays disabled until there's a valid email and the consent box is checked.

## H. About page

23. **The pull quotes use a left-border accent,** which the spec doesn't allow ("Do not use left-border accents"). Use a 3px `#B48CFF` **top** border, the `#1A1322` panel background, 20px padding, and quote text in Barlow 500 italic 19px.
24. **The links in the "Community information" box are underlined.** Remove the underline, as in item 18.
25. **The icon key ("What the icons mean")** is good. Update it so it uses the v2 type icons, and add the three type icons at the top: Display, Treat stop and Event.

---

## Checklist

- [ ] 1 v2 type icons on pins and cards; events use the skull
- [ ] 2 Host notes only when notes exist
- [ ] 3 Card row gap 7px
- [ ] 4 "Hours not listed"
- [ ] 5 Pin selected and hover state
- [ ] 6 Labels not doubled
- [ ] 7 Search this area only after pan or zoom
- [ ] 8 Filter groups stacked from the top
- [ ] 9 Route panel: header on top, Remove not cut off, no white bar, solid background, 16px names, 420px max width, "Plan your route" removed or explained
- [ ] 10 Donation drive color `#FF6FA8`
- [ ] 11 Duplicate "Open all week" removed
- [ ] 12 Only the time inside day blocks
- [ ] 13 Type-color dots on Type chips
- [ ] 14 Submit cards use type colors and icons
- [ ] 15 Submit copy
- [ ] 16 Submit title uppercase
- [ ] 17 One nav style on all pages
- [ ] 18 No underlined links
- [ ] 19 Checkbox style
- [ ] 20 Consent checkbox aligned
- [ ] 21 "Future holiday listings"
- [ ] 22 Area fields and disabled submit confirmed
- [ ] 23 Pull quotes use a top border
- [ ] 24 Community info links not underlined
- [ ] 25 Icon key uses v2 icons
