# Report: Nuxt spike (Θέματα)

Branch `claude/nuxt-spike`, folder `nuxt-spike/`. Nothing in `web/`, the prototypes or Netlify was changed.

## What was built

Nuxt 4.6 (SPA, `ssr: false`, like the static page), Vue 3 `<script setup lang="ts">`, Nuxt UI 4.12 on Tailwind 4, Pinia (`period`, `tooltip`), d3-scale / d3-shape for the lines. `assets/tokens.css` of the prototype is copied and drives the Nuxt UI colors (`--ui-primary: var(--accent)`). Fonts: only Inter and Source Serif (the other `@font-face` blocks removed).

- Layout: sticky top bar, section links, sidebar that stays mounted between routes, page transition (fade + 6 px, 160 ms, `out-in`).
- `/trends` (Θέματα): `TopicDonut` (donut + full-height list), `LinesChart` (8 lines, names at the line ends with the same 13 px spreading rule, hover rule + white tooltip), `MoversList` (Τάσεις), `DateRange` (Nuxt UI popover + range calendar + 7/30/all presets), `DashCard`, `ChartTooltip`.
- `/groups`: a stub, only for the page change.
- Data: `public/data/topics.json` (16 KB, converted from `data/home.js`), loaded with `useFetch`.
- Not ported: Μετατοπίσεις card, English, sign-in gate, search, theme switch, the donut's hover on the list, the draw-in on a new period.

## Measured (Chrome, local static servers, 1 run unless said; the servers do not compress, so "bytes transferred" is uncompressed for both)

| | Nuxt spike | Static `topics-v2.html` |
|---|---|---|
| First load at 1440, bytes transferred | 1072 KB | 630 KB |
| Requests | 41 | 21 |
| JS gzip (all of `_nuxt/*.js`) | 216 KB | 121 KB (the 11 scripts and 2 data files of the page, gzipped one by one) |
| Console errors, horizontal overflow (1440 and 390) | none | none |
| Lines of own code for the page | 471 (vue + ts, includes layout, stores, nav) | 196 in the page + about 60 in `Dash.LinesChart` + `Dash.card` and `shell.js` (not counted) |

Page change Θέματα → Ιδιοκτησία, click until the new page is drawn, median of 7:

| CPU | Nuxt (stub page) | Static (real page with a chart) |
|---|---|---|
| normal | 385 ms | 219 ms |
| 4× slower | 527 ms | 1336 ms |

**Read this table with care.** The Nuxt target is a stub with no chart, the static target is the real Ιδιοκτησία page. The Nuxt number includes 2 × 160 ms of fade (by design, `out-in`). So the table shows that the shell stays mounted and that the cost of a change does not grow with the slower CPU as much, but it is not a like-for-like test of two real pages. A fair test needs a second real page ported.

## Looked at

Screenshots at 1440 and 390 of the Nuxt page and of the static page. The lines, the donut colors, the names at the line ends and the layout match. Differences: Nuxt has no uppercase section labels and no footer, titles are plain, the donut is on top of its list at every width, the first donut card is not as tall as the lines + movers column at 390.

## Not checked

Night and other themes, Safari, the date calendar by eye with a selected range, keyboard use of the popover, English, `nuxt typecheck` output (printed nothing, not confirmed as passed), the production Netlify build.

## Honest reading

- The static page is smaller on first load (630 vs 1072 KB uncompressed; JS 121 vs 216 KB gzipped). Nuxt UI + Tailwind add about 0.4 MB here; a tree-shaken set of only the used Nuxt UI parts, and `ssr: true` prerender, would reduce the first paint but were not tried.
- Page change is where Nuxt pays: the shell is not parsed again. It needs a real second page to say how much.
- The code is shorter to change (named components, typed props, no `?v=` bumps), but the charts are still hand-drawn SVG; only the drawing syntax changed.
- Nuxt UI took over: popover, calendar, tooltip of the info button, button. Tailwind took over layout only; colors stay in the prototype's tokens.

## Next, if you want to continue

1. Port one more real page with a chart (Ιδιοκτησία) and re-measure the page change.
2. Try `ssr: true` prerender and a Nuxt UI component list to cut the first load.
3. Decide on Tailwind vs the existing CSS after seeing both.
