# Report: Αναλύσεις › ΟΗΕ (PR #127, merged 2026-11-09, `main` = `85cfbed`)

## What shipped

**Όλες οι ομιλίες** (`speeches-v2.html`)
- «Η συνολική ατζέντα» is a sunburst (`Dash.Sunburst`): inner ring = the 6 regions sized by speaking time, outer ring = topics of each region (the 9 largest topics of the picked speeches; a topic under 3% of a region's time goes into «Άλλα»). Domestic affairs is inside. Legend = the topics with minutes and share, plus a line naming the regions. The region pills filter it (a picked region is the whole inner ring).
- «Τι απασχολεί κάθε ήπειρο»: heatmap (`UI.MatrixChart` + `Dash.seq`), share of each region's time on the 9 largest topics, colored by how far above the average of all regions. A region with fewer than 5 speeches (Βόρεια Αμερική, 2) has no color. Always all regions.
- The four stat cards (hours, claims K47, commitments, attacks) are removed on request. Right column = «Ποιος δέχτηκε τις επιθέσεις» and «Ποιοι μίλησαν για Ελλάδα και Κύπρο».
- «Όλες οι ομιλίες» is a list: measure buttons (Λεπτά, Ισχυρισμοί, Δεσμεύσεις, Επιθέσεις), a search, one line per speech (rank, leader + country, bar, number, topic fingerprint), 192 rows scrolling inside the card. The old `UI.DataTable`, the legend row, words per minute and «Κύριο θέμα» are gone.
- Region pills are rectangular buttons (8px radius, accent-tinted selected state).

**Παλαιστίνη–Ισραήλ** (`un-israel-v2.html`): «Από ποιες περιοχές» is a donut (`Dash.Donut`, stacked legend). Numbers come from the rows: 184 min, 62 speeches, rank 3rd of 132 topics (was 201 / 77 leaders / 4th of 152 from `agenda`). Nothing else changed.

**Code**: `Dash.Donut`, `Dash.Sunburst` (`assets/dash.js`), `.dn-*` and `.un-*` rules (`assets/dash.css`, `assets/politics.css`), `Politics.topicMinutes(rows)` (`assets/politics.js`, the one source of the numbers), `scripts/un-check.mjs` (totals add up, run with `node`), keys `un.sun.*`, `un.heat.*`, `un.measure.*`, `un.list.*`, `un.search`, `unpi.regions.*` in `assets/messages-politics.js`. Plan: `docs/plans/2026-11-09-1900-feat-un-speeches-donuts-insights-plan.md` (written before the layout changes of the last three commits; it no longer matches the page).

## Measured (Chrome, signed in as `lolovios`)
- Both pages at 1920, 1440, 1100, 390 px: no horizontal scroll, no console errors. Όλες οι ομιλίες is 1.9 screens at 1920 (was 2.7).
- `node scripts/un-check.mjs` passes: for all regions and each of the 6, topic minutes add up to the tagged minutes; Israel–Palestine 184.0 min, 62 speeches, rank 3.
- Looked at screenshots: Όλες οι ομιλίες at 1920, 1440, 390 (and night at 1440 before the last commits); Παλαιστίνη–Ισραήλ at 1920 and 1440.

## Not checked
English text; Safari; the phone drawer; `visual-check.mjs` (not run at all in this PR); night on the new sunburst, list and Παλαιστίνη–Ισραήλ; 1100 px by eye (measured only); `pnpm check` has 1 failure that is not from this PR (`.q-label` 11px in `assets/mme.css`).
