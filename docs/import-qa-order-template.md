# Codex QA order — response import (template)

Fill every `<placeholder>` after the import deploys. Delete rows that don't apply. This order ships to Codex only after the dry-run report has been reviewed and the import is live.

---

**Production URL:** https://hauntfinder.vercel.app
**Import commit SHA:** `<commit>` · **Production deployment SHA:** `<vercel-deployed-commit, verified by asset-hash match>`
**Dry-run report:** reviewed at `<timestamp>` — `<accepted>` accepted / `<skipped>` skipped / `<rejected>` rejected (rows: `<link-or-path>`)

## Records to verify

| # | Record | Type | Category | Production URL / deep link | Expected on site |
|---|---|---|---|---|---|
| 1 | `<entityId / listing N>` | `<new listing \| update \| treat stop \| event>` | `<displays \| treats \| events>` | `/?category=<cat>&<params>` | Card present; count includes it; map pin at `<lat,lng>`; hours/details match sheet row `<row>` |

`<repeat per imported record>`

## Global checks

1. **Counts**: Displays tab shows `<N>` listings, Treat Stops `<N>`, Events `<N>` — matching the committed data (`scripts/public-data.cjs` output).
2. **Category agreement**: each new record appears in exactly its intended category; no record appears in two categories; `?category=` deep links for each.
3. **Map**: every new pin sits at its verified street address (not a town/ZIP centroid); pin click opens the right card.
4. **Idempotency**: re-running the import produces no diff (no duplicate cards, counts stable).
5. **No regressions**: tab matrix still green (click/keyboard/URL/refresh for all three categories); alerts page-first intact; validator + full suite green at the import commit.
6. **Privacy**: no submitter private contact data or names appear in repo or rendered pages.
7. **Untouched**: storage keys, digest identities, artwork, forms, visitor counter, completed releases.

## Known risks / notes

- `<e.g., geocoder town-name mismatch flagged in dry-run; column-name quirks; rows held pending host clarification>`

## Loop

Codex returns pass/fail per item → Kimi fixes failures and re-issues a scoped QA order → the import phase closes only when this loop is green.
