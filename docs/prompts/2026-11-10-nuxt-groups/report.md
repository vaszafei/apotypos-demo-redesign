# U8: Ιδιοκτησία as a Nuxt page

Branch `claude/nuxt-groups`. Started from `docs/prompts/2026-11-09-nuxt-app/handoff-7.md` and plan U8 (`docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md`, lines 344 to 360).

## What was built

`/groups` (`web/app/pages/groups.vue`), the port of `groups-v2.html`, with the four cards of the static page in the same order and sizes:

| Card | Nuxt |
|---|---|
| Άρθρα ανά ημέρα και όμιλο (c-7) | `GroupLines.vue`: square-root scale, band and broken line on a gap day (`GAP` = 50), hover rule, dots and tooltip with the gap note |
| Στάση προς την κυβέρνηση ανά όμιλο (c-5) | the list in `groups.vue` with `DivergingBar.vue` |
| Ιδιοκτήτες και μέσα (c-8) | `GroupsNetwork.vue` and `utils/net-layout.ts` (same arithmetic as `netLayout`) |
| Άρθρα ανά όμιλο (c-4) | `GroupSunburst.vue` |

Data: `composables/useGroups.ts` (the `groups` and `media` fixtures through `useFixture`, in parallel). Colors: `utils/groups.ts` (`groupColors` as `var(--cat-N)`, the tint as `color-mix`), `composables/useInk.ts` and `utils/ink.ts` (the text color on a circle, set after mount because a token's value is only known in the browser). `ported-pages.json` has `groups-v2.html` to `/groups`; `NAV` already had the tab.

Differences from the plan, all from reading `groups-v2.html`:

- The static page does not use `LinesChart`: its chart has a square-root scale, gap bands and broken lines, so `GroupLines.vue` is a port of its own `VolumeChart`.
- There is no table of shares in the static page (a sunburst with a list, and the stance bars), so `DashTable.vue` was not needed.
- The plan says to delete the trial's stub `groups.vue`. It was never on `main`.

Two changes outside the page:

- `ChartTooltip` and the tooltip store take an optional `note` (the gap note of the lines).
- `app/assets/css/ssr.css`: the layout always renders an empty `#page-actions` (the target of the teleport). The static page leaves the element out for a page with no controls, and `app.css` has a rule for that case that `:has(.page-head-actions)` no longer matched. Without the fix the cards started 36 px lower at 1440 and 12 px lower at 390. The two rules (desktop and phone) count an empty target as no controls. `/trends` was checked again and is unchanged.

## Checks (commands and numbers)

`npm test` in `web/`: 68 of 68 (61 before, 7 new in `scripts/groups.test.mjs`). `npm run typecheck`: clean. `npm run generate`: builds, `/groups` is prerendered, `_redirects` has `/groups-v2.html /groups 301`.

`npm run check:pixel -- /groups` (signed in, reduced motion, limit 0.05%):

| Screen | Different pixels |
|---|---|
| 1440 full page | 0 of 1 779 840 |
| 390 full page | 0 of 852 150 |
| 1440 hover on the first chart | 0 of 1 296 000 |
| 1440 night | 0 of 1 779 840 |
| 390 night | 0 of 852 150 |
| picker open | skipped, the page has no picker |

`/trends` at 390 still gives 2 073 (night 2 137): the known tab-bar race of the static page, the same numbers as in handoff 7; 1440 gives 0 on all four screens.

States, compared with the static page at 1440 and 390 (a script in the session scratchpad, `compareImages` of `pixel-diff.mjs`): `?state=empty`, `?state=error` and `?state=bad` all 0 of 1 296 000 and 0 of 351 000.

Browser run on the built output: from `/trends` a click on Ιδιοκτησία kept the document (a marker on `window` survived), `/groups` showed 4 cards, the title was `Ιδιοκτησία ΜΜΕ · Απότυπος`; a click back to Θέματα kept it again. A hover on a hub of the network gave the owner, the lean, the articles, the outlets, the news share and the stance, and dimmed 106 elements; a hover on 6 Oct (a gap day) gave `6 Οκτ 2026: 0 άρθρα` with `κενό συλλογής`; a hover on 23 Aug gave the day total with the groups largest first. No console warning or error.

Hydration (dev server, Vue warnings): at first the network had 5 attribute mismatches (`cx`, `cy`, `x`, `y` differed in the last digit between Node and Chrome: `Math.sin` and `Math.cos`). The layout now rounds to 0.0001 px. Rounding to 0.01 px was tried first and gave 109 different pixels at 1440, so it was dropped. After the fix: no warning signed out, signed in, and signed in with `?theme=night&icons=all&lang=en`.

## Page change and first load

Chrome on this machine, local static servers without compression, signed out, 1440 wide, median of 7. The page change is a click on the tab until the new card title and a chart are in the page (the method of `docs/prompts/2026-11-10-nuxt-spike/report.md`), starting from a loaded Θέματα page.

| | Nuxt | Static |
|---|---|---|
| Page change Θέματα to Ιδιοκτησία, normal CPU | 324 ms (312 to 374) | 238 ms (167 to 461) |
| Page change, 4× slower CPU | 960 ms (838 to 1121) | 1 243 ms (1 213 to 1 570) |
| First load: first paint (FCP), normal | 164 to 176 ms | 312 to 356 ms |
| First load: first paint (FCP), 4× | 364 to 400 ms | 1 004 to 1 052 ms |
| First load: charts at their final width, normal | 464 ms (421 to 778) | 359 ms (303 to 734) |
| First load: charts at their final width, 4× | 1 875 ms (1 539 to 2 575) | 1 069 ms (992 to 2 499) |
| Requests, bytes | 31, 1 434 KB | 16, 766 KB |

How to read it:

- The static page change is bimodal at normal CPU (167 to 183 ms in 3 runs, 370 to 461 ms in 3 others), so a 86 ms gap between the medians is inside its own spread. At 4× the Nuxt page changes faster, as in the trial.
- The prerendered page paints about twice as early (FCP), and 2.5 times as early at 4×. The charts are drawn at a fallback width of 640 px first and at the measured width after hydration; at 1440 the lines card is about that wide, so nothing moves, at other widths it will.
- At 4× the Nuxt page takes longer to reach the final layout than the static one (1 875 against 1 069 ms): hydration of the network (layout of 300 steps for each of 9 groups, run twice, on the server and in the browser) and the rest of the app. The first run of the layout is a `computed` on the measured width, so it runs again when the width is known.
- The first load moves 1.9 times the bytes (two JSON fixtures, the message file, the Nuxt chunks) in twice the requests. Not investigated further.
- The 4× static run of the first load hit a `networkidle` timeout once in a first attempt, so it was run again without waiting for network idle; the numbers above are the second run.
- The spike report's numbers (Nuxt 250 ms and static 238 ms, normal) were from a stub; this is the first like-for-like page change.

## Not checked

Netlify preview, Safari and Firefox, the slide by eye (only that the document is kept and a view transition ran without an error), the tooltip and the network by touch, keyboard focus on a hub and the Enter key, 1100 and 1920 wide, the English page against the static page by pixels (only hydration warnings), the 390 tab-bar race (open decision 3 of handoff 7).

## For the user

The decisions of handoff 7 (English first frame, the 150 ms hold, the 390 tab-bar race, deleting the merged local branches) are still open and were not touched.
