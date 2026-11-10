# U9, first pair: Μέσα › Επισκόπηση (`/media`) and Στάση (`/media/writing`)

Branch `claude/nuxt-media`. Static pages: `media-v2.html` and `media-v2.html?tab=writing`. Both are in `web/ported-pages.json` (the second with `query: tab=writing`).

## What was built

- `utils/mme` (the period sums of `assets/mme.js`), tested against the static page in `scripts/mme.test.mjs`.
- `composables/useMme.ts`: the `mme` and `groups` fixtures, the period, the sums, group colors.
- Components: `DayBars` (stacked days with drag select), `GroupTiles` (the group treemap), `StanceMap`; `utils/squarify.ts`, `utils/stance-labels.ts`.
- Changed and shared with other pages: `DashCard`, `TopicDonut` (used by `/trends` and `/groups`), `useInk`, `utils/ink.ts`, `utils/links.ts`. U14 (Home) will use the same cards.

## Measured

`npm run generate`, then `npm run check:pixel -- <route>` (a pixel counts above 24 of 255 in a channel; limit 0.05%).

| Route | 1440 | 390 | date picker | hover | night 1440 | night 390 |
|---|---|---|---|---|---|---|
| `/media` | 0 | 0 | 0 | 0 | 0 | 0 |
| `/media/writing` | 0 | 0 | 0 | 0 | 0 | 0 |

Rerun after the shared components changed: `/groups` 0 on all screens. `/trends`: 0 on all but the 390 tab-bar race of the static page (2 073 and 2 137 pixels, the same numbers as in handoff 7; one earlier run gave 0, so it is a race).

States (`?state=empty|error|bad`, 1440 and 390, a script against the static page): 11 of 12 cases at 0 pixels. `/media?state=empty` at 390: 760 of 768 690 pixels (0.099%), two bands of text inside the group tiles (y 1277 to 1289 and 1356 to 1364). The tile rectangles and the text boxes are equal to two decimals on both sides; the cause was not found. The static card is still `m-wait` in that state and the Nuxt card is `m-play`; forcing `m-play` on the static page did not change the number.

Hydration warnings in dev, three visitors (signed out, signed in, signed in with `?theme=night&icons=all&lang=en`) on both pages: none.

`npm test` 72 of 72; `npm run typecheck` clean.

## Found while checking

- `?state=empty` on the static page gives `{ kind: 'empty', data }`, and the page still uses the data of the groups list (only `failed` drops it). `useMme` accepted only `ready` and so lost the group colors; now it takes the data whenever it is there.
- The static tile is an `entity-link` (`min-height: 24px`), so a tile under 24 px tall grows. `GroupTiles` lacked the class, so small tiles were shorter (15 against 24 px); the normal-state pixel diff did not show it.
- `useMediaQuery` gives the real value at hydration: the prerendered 170 px chart was redrawn at 230 px and Vue warned. `wide` and `phone` now wait for `useMounted`.

## Not checked

Links from the list cards to the detail pages (none is ported, so they go to the static URLs), Netlify preview, Safari, Firefox, English by pixels, widths other than 1440 and 390, the page change time of these two pages.
