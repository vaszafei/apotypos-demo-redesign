# U9, second page: Μέσα › Ιστορίες (`/stories`)

Branch `claude/nuxt-stories`. Static page: `stories-v2.html`. In `web/ported-pages.json` as `/stories`.

## What was built

- `utils/stories.ts`: the lists of the page as pure functions (the stories of each day, the list of a period, Τάσεις, the lines), tested in `scripts/stories.test.mjs`. The list of a day and of a period is compared with `Home.index` and `Home.rangeInfo` of the static `assets/home.js`, loaded in a vm. Τάσεις and the lines are inline in the static page, so they are tested for their rules (order, minimum of 10 articles before, the axis covers 7 days, the values are the days of the story), not against the static code.
- `composables/useStories.ts` (the `stories` fixture, the period; the first visit shows the last day, as the static page does), `components/StoryList.vue` (the list, drawn in parts of 100 as the scroll nears the end), `pages/stories.vue`, `utils/storyName.ts`, `types/stories.ts`.
- Changed and shared: `LinesChart` has the options `band`, `tall`, `sparse`, `sqrt` and `hrefOf` of `Dash.LinesChart` (the other pages do not pass them, so they draw as before); `BarList` rows take a `tip` (the white tooltip, as `HBar` with a label); `links.ts` has `storyHref`; `nuxt.config.ts` loads `home.css` with the other sheets (see below).
- Not fetched: `storyDetail.json` (1.4 MB). The static page loads it for the outlets of the first story, which this page does not draw (the list card is `part: 'list'`). Difference: if that file alone fails, the static page shows the error state and this page does not. `?state=error|empty|bad` forces both fixtures in the static page, and there the two pages agree.

## Measured

`npm run generate`, then `npm run check:pixel -- /stories` (a pixel counts above 24 of 255 in a channel; limit 0.05%): 0 on all six screens (1440, 390, date picker open, hover on the first chart, night 1440, night 390).

Rerun after the shared components changed (`LinesChart`, `BarList`, `home.css` in every page): `/groups`, `/media`, `/media/writing` 0 on all screens. `/trends`: 0 on all but the 390 tab bar of the static page (2 073 and 2 137 pixels in bands y 93 to 104, the same numbers as in handoff 7; a rerun gave 0 for the normal screen and 2 137 for night, so it is the race).

A script against the static page (`stories-checks.mjs`, machine-local, not committed), 1440 unless said:

| Case | Pixels that differ |
|---|---|
| `?state=empty`, `?state=error`, `?state=bad` | 0 (390: 2 152 in the tab bar, see below) |
| `?lang=en` | 0 (390: 2 055 in the tab bar) |
| the whole window (3 428 stories at 100 rows), list scrolled to the end (700 rows drawn) | 0 |
| last 7 days; hover on a bar of Τάσεις | 0 |
| the first day of the window (no period before: Τάσεις is the empty text) | 0 |
| the whole window at 390 | 0 in the page; 2 152 in the tab bar |

The 390 bands are all rows 93 to 104 across the page: the scroll of the tab bar. In `?state=empty` and `?state=error` the static page leaves it at 0 and in English at 115, this page centers the current tab (138) in every case. That is the 390 tab-bar race of the static page in handoff 7, now with a cause for the empty and error states.

Hydration warnings in dev, signed out, signed in, signed in with `?theme=night&icons=all&lang=en`, and signed in with `?state=empty`: none. `npm test` 76 of 76; typecheck clean.

## Found while checking

- `home.css` is the sheet of Αρχική and of this page only. Loaded by this page alone (`useHead` link), the list appeared unstyled on a client navigation from `/trends` or `/media` (`list-style: disc`, `display: block` at the moment of insertion, also at 4× CPU), because the sheet loaded after the list. As one of the global sheets the list is styled when it appears (`none`, `grid`), and the five ported pages are still 0. Its only rule outside the home classes, `.dash .chart .donut-cap`, changes nothing in them. When the Home page is ported (U14), it needs no sheet of its own.
- The static empty state is `section.dcard.c-12` with the inbox icon, straight in the grid; the first copy (a card column, no icon) differed by 2 486 pixels. `/trends` and the `/media` pages have the short form; they were not changed here.
- In `?state=empty` the data is there, so the date picker would show; the static page has none in that state.

## Not checked

Links from the story rows and from Τάσεις (they go to the static `story-v2.html?id=`, the page is not ported), Netlify preview, Safari, Firefox, widths other than 1440 and 390, the page change time of this page.
