# Brief: mobile route sheet drag-to-close

> Index: optional enhancement, not a defect. Hauntfinder is QA-closed at `fcb2dae`; this is the only feature item left. Do not start without Minerva's go.

## Goal
On mobile (<1024px), the Your Route bottom sheet can be dismissed by dragging it down, in addition to the existing × button, backdrop tap, and Escape.

## Current behavior (verified in code)
- Open/close: `openSheet('route')` / `closeSheet()` in `mobile.js:19-20`. Sets `html[data-sheet="route"]`, unhides `#routePanel`, toggles `data-route-open` and aria-expanded on `#routeBarBtn`.
- Close paths today: `.sheet-close` in `.route-panel__head`, tap outside `#routePanel` (`mobile.js:26`), Escape (`mobile.js:27`), bar button toggle.
- Layout: `styles.css` ~1437-1446. `.route-wrap` is a fixed full-screen dim overlay; `.route-panel` is a bottom sheet (max-height 80vh, `overflow:auto`, 14px top radius, 3px orange top border). No grab handle, no gesture handling.

## Scope
1. Add a visible grab handle (centered pill, about 36x4px, `#3A3046`) at the top of `.route-panel`; the whole header (`.route-panel__head`) is the drag target, not the scrolling stop list.
2. Pointer Events on the head: track vertical drag, translate the panel with `transform: translateY(dy)` (dy clamped at >= 0), fade the backdrop proportionally.
3. Release rule: close if dy > 25% of panel height or release velocity > 0.5 px/ms downward; otherwise spring back (200ms ease-out). Closing calls the existing `closeSheet()` so aria-expanded, `data-route-open` and badges stay correct.
4. If the stop list is scrolled to top and the user drags down from inside it, do not hijack: the sheet only drags from the head.
5. `touch-action: none` on the head only. `prefers-reduced-motion`: no spring animation, just snap.
6. Desktop (>=1024px) unchanged; filters sheet and menu drawer unchanged.

## Out of scope
Swipe gestures on the filter sheet or menu drawer; changing the sheet's height or contents; any desktop change.

## Done when
- New tests in `tests/mobile-spec.test.js` for the handle markup/CSS and the handler wiring (matching the existing source-assert style).
- `scripts/e2e-single-scroll.js` gets a 390px check using real pointer events: drag past threshold closes (`html[data-sheet]` gone, bar badge back, aria-expanded false); short drag springs back and stays open; × and backdrop still close.
- Unit suite (370+), `e2e-single-scroll`, `e2e-listing`, `e2e-route` all pass locally, then `verify-live` plus the same e2e against `https://hauntfinder.vercel.app` after deploy. QA reports the literal output.
- Commit on a branch; merge to main only with Minerva's approval.
