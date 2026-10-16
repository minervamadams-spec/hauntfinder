# Listing photos: never crop (Oct 16, 2026)

Mock: `design/Hauntfinder Photo Card.dc.html`, panel **P5**. Live screenshots: `reference/live-review/photo-portrait-card.png` and `photo-portrait-popup.png`.

**Problem:** portrait photos (Glens Terror Drive) are cropped with `object-fit: cover`, which cuts off the top and bottom of the display.

**Fix:** use this on both photo frames, the card back and the map popup:

```css
.photo-frame { background:#0E0B13; overflow:hidden; }
.photo-frame img { width:100%; height:100%; object-fit:contain; object-position:center; image-orientation:from-image; }
```

- **Card back:** the frame height still comes from the front face (grid fix, P4). The photo fits inside it. The name and "↻ Details" bar sits on top of the photo's lower edge.
- **Map popup:** the image area is `aspect-ratio:16/9` with the same contain rule.
- Portrait photos get dark side bars, and panoramas get top and bottom bars. Don't fill the bars with a blurred copy of the photo.
- Rotate photos to their EXIF orientation on upload so phone portraits aren't stored sideways.

**Acceptance:** with the Glens Terror Drive photo, the whole scarecrow shows from the top of its head to the ground, in both the card back and the popup, and neither frame changes size.
