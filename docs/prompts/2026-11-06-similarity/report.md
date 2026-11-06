# Report: Μέσα › Ομοιότητα και πρωτοτυπία (2026-11-06)

Branch `claude/similarity-cleanup`. The tab went from 9 cards to 3, one card at a time with screenshots.

## Decisions (the user's words in quotes)

| Card | Result |
|---|---|
| Ποιος γράφει τα ίδια με ποιον (matrix) | removed: "remove what you propose" |
| Διάμεση καθυστέρηση | removed; the lag stays as a column of the originality table |
| Με ποιον γράφει τα ίδια (panel) | removed: "no remove that, doesn't tell us anything" |
| Ίδιος όμιλος ή όχι (ring) | became a list of same-group pairs, then removed: "remove that card" (the user also asked for groups of any size, not pairs; the mock showed that only the 2-outlet groups DPG and Bakou write alike, Alter Ego and Politis are at the random level; not built) |
| Άρθρα χωρίς υπογραφή | merged with originality into one map «Πρωτοτυπία και υπογραφές» (x original %, y unsigned %, a name on every dot), "charts like we did in stasi" |
| Ειδήσεις και clickbait ανά μέσο | redone with the shared `DotMap` (all 16 outlets named, axis titles say what is measured, info tooltip); stays on this tab, c-6 |
| Ξεκινά μόνος | removed: "remove that" (the user chose it when asked) |
| Όλα τα ζεύγη μέσων | removed: "ola ta zeugi" |

Left: «Μέσα κατά πρωτοτυπία» (table without the chips), the originality map, the clickbait map.

## Measured (data research, `research.md`)

- The matrix «Ποσοστό» correlates 0,98 with the size of the column outlet; lift −0,81; Jaccard and lift across pairs −0,04.
- 11 same-group pairs among the 24 outlets with at least 700 stories: mean Jaccard 28,8% against 25,5%, ranks 4 to 228 of 276. The old ring (16,0% against 17,1%) was distorted by tiny sites near 2%.
- DPG (2 outlets) 38%, Bakou 39% of their stories written by both, random pairs about 25–26%; Alter Ego (4) and Politis (4) at the random level.
- Web search found no best-practice rule for similarity between outlets; only general guidance (matrix order, ranked lists, dumbbell for two values).

## Commands

- `node ../docs/redesign/prototypes/scripts/check.mjs` from `web/`: All checks pass.
- `visual-check.mjs --only similarity` and `--only media`: No findings.
- Not checked: English text on screen, the empty state, a phone screenshot of the two maps by eye.

## Versions bumped

`messages.js` 45, `messages-v2.js` 59, `messages-spread.js` 30 on every page that loads them.

## Left over / to decide

- The tab is still named «Ομοιότητα και πρωτοτυπία» but has no similarity card now. `question.media.similarity` was rewritten to the three cards. The name was not changed.
- Unused now: `Spread.matrix`, `Spread.Ring`, the keys `sim.mx.*`, `sim.same.row|total|aria`, `sim.table.*`, `stories.solo.*` (no page uses these keys now; I checked only the .html pages and assets/*.js). Not deleted (see `verify-dead-exports-before-deleting.md`).
- The clickbait card is c-6 and alone in its row; it was not stretched.
- `/ce-code-review` and `/ce-compound` were not run.
