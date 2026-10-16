# Hauntfinder icons v2 (Oct 16, 2026)

These replace the old flat `assets/icons/pin-*.svg` and `icon-*.svg`. The SVGs are the source files, and the PNGs are exports.

| File | Use | Size on screen |
|---|---|---|
| icon-display.svg (jack-o'-lantern) | Card icon, map key, route list, Submit page | 26–32px |
| icon-treat-stop.svg (wrapped candy) | Same | 26–32px |
| icon-event.svg (skull tile) | Same | 26–32px |
| pin-display.svg / pin-treat-stop.svg / pin-event.svg | Map pins | 34px wide on desktop, 30px on mobile, 44px when selected |

- **Pins:** viewBox 128×156. Leaflet: `iconSize: [34, 41]`, `iconAnchor: [17, 40]` (the tip). Selected pins: `[44, 54]`, anchor `[22, 52]`, plus `zIndexOffset: 1000`.
- **Small sizes:** the icons stay readable at 26px. Don't use them below 20px.
- **PNG exports:** `png/*-64|128|256|512.png`. Use the SVG on the web, and the PNGs for email and social.
- **On-route badge:** keep `badge-on-route.svg` and overlay it at the top right.
- Colors use the palette (orange #FF7A1A, lime #A6E22E, purple #B48CFF) with a dark outline (#24120A).
