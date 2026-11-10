# Report: Ομοιότητα και πρωτοτυπία as a Nuxt page (`/similarity`)

Branch `claude/nuxt-similarity`, from `main` at `810d823` (after #142).

## What changed

- `web/app/pages/similarity.vue`: the three cards of `similarity-v2.html` (outlets by originality with the table, the originality map, the news and clickbait map). Registered in `ported-pages.json`; the tab was already in `NAV`.
- New: `components/DotMap.vue` (the dot map of the static page, with the label placer `utils/stance-labels.ts` that `StanceMap` uses), `types/originality.ts`.
- Changed: `StackedBar` (`marker`, `label`), `ChartLegend` (`tick` item), `utils/mme.ts` and `types/mme.ts` (`cbKnown`, `cbYes`, the clickbait counts the static `Mme.summary` has), `composables/useFormat.ts` (`fmtDec`, `fmtPct0`).
- Bug found and fixed in `StanceMap` (Στάση), shared with the new map: the hovered dot was dimmed with the others (the page kept the point itself and compared it with the reactive copy, which is never equal). The static page shows the hovered dot at full opacity. Both maps now keep the name of the point. `check:pixel` only hovers the middle of the first chart, so `/media/writing` never showed it.

## Measured

`npm test` 82 of 82 (no new unit test: the page has no new arithmetic; the clickbait sums are covered by `mme.test.mjs`), `nuxt typecheck` clean, `npm run generate` builds.

Pixel diff (`npm run check:pixel`, limit 0.05%), pixels that differ: `/similarity` 0 at 1440, 390, hover on the first chart, night 1440 and night 390; `?state=empty`, `?state=error` and `?state=bad` 0 on all screens. Hover on a dot (own script, dots 2 and 9 of the first map, 1440 and 390): 0; before the fix 420 to 546 pixels (the dot). After the changes of the shared components: `/media/writing` 0 on all six screens, `/media` and `/story?id=100` 0.

Browser: client navigation from `/stories` to the tab keeps the document and marks the tab; English titles ("Outlets by originality", …) and the lag "4,0 hours". Dev server: no warnings signed out or signed in at 1440; the English night case shows the known English first frame, the same as `/media`.

## Differences from the static page

The static page also loads `storyDetail.json` (1.4 MB) only to find the group of each of the 5 originality outlets. The Nuxt page takes the group from the `mme` outlets, which have the same 5 names and groups, so the page does not load or prerender that file. If only `storyDetail` failed, the static page would show the error state and this one would not.

## Not checked

Netlify preview, Safari, Firefox, widths other than 1440 and 390, the page change time, touch on the dots, the dot map at 480 px (the `narrow` rule) by pixels.
