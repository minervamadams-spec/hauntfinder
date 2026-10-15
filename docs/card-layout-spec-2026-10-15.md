# Display card layout spec (supersedes round-3 item 3 mock)

> Index: newer card-row spec from Minerva's chat; the ZIP's `DESIGN-REVIEW-2026-10-15-round3.md` (item 3) only has the older fixed-width route button + one-line action row. Source ZIP: `~/Downloads/Mount Olive Halloween Haunt Finder (10).zip` (`Hauntfinder v7 Handoff/`, `design/Hauntfinder v7 Compact.dc.html`, `reference/live-review/round3-displays-*.png`).

1. **Host notes sits on the hours row** (right after the hours text, same line; opens to full width when expanded). It leaves the bottom meta row, which keeps rating left and Report/Share right.
2. **Family Friendly (scare level) moves into the tags row**, as the first item, replacing the separate scare row between hours and tags.
3. **Route button:** `height 30px`, `min-width 118px`, `font-size 13px`; "+ Add to route" and "✓ On your route" are the same width; the action row never wraps.
4. Mobile keeps hiding the scare level (< 768px), as before.

Card order: pin/name/subline, address, hours row (hours + Host notes), tags row (scare level + type + features), actions, meta (rating, Report, Share).
