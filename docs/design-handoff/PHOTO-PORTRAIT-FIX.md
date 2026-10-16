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

---

# Photo lightbox (Oct 16, 2026)

Portrait fix confirmed live. Next: tapping a photo opens it larger. Mock: `design/Hauntfinder Photo Card.dc.html`, panel **P6**. Screenshot: `reference/live-review/photo-lightbox-request.png`.

- **Trigger:** the photo in the map popup and on the card back (a `<button>` with `aria-label="View larger photo of {name}"`), marked with a 28px ⤢ icon in the top-left corner. Other controls keep their current actions.
- **Overlay:** `position:fixed; inset:0`, above the map and the route bar, background `rgba(8,6,12,.94)`. The top bar has the name, town · distance, and a 44px ×. The photo is `object-fit:contain` and `max-height:calc(100dvh - 140px)`, centered, using the full-size image.
- **Mobile:** edge to edge, `100dvh`. Swipe down to close, pinch zoom on the photo, and lock page scroll while open.
- **Close:** ×, Esc, a tap outside the photo, or browser Back (push a history state). Return focus to the trigger.
- **Access:** `role="dialog" aria-modal="true"`, with focus kept inside. With reduced motion, no animation; otherwise a 150ms fade.

**Acceptance:** on a 390px phone and at 1280px desktop, tapping the Glens Terror Drive photo shows the whole scarecrow filling the screen height. Swipe down or Back closes it and returns to the same popup.
