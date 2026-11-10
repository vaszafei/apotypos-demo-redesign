# Report: the story page as a Nuxt page (`/story?id=`)

Branch `claude/nuxt-story`, from `main` at `eaf39c1`. First detail page of U9.

## What changed

- `web/app/pages/story.vue` and `components/StoryDetail.vue`: the page of `story-v2.html`. Route `/story`, the query stays `?id=` (entry in `ported-pages.json`; `story-v2.html` now redirects to `/story`, which Netlify does with the query).
- `utils/story-detail.ts` (pure: the rows of a story, window of at least 14 days, people, reach/echo, related stories, difference rows) and `types/story-detail.ts`.
- New components: `EntityTitle`, `EntityFact`, `EntityLink`, `SparkLine`, `ChartLegend`, `StackedBar`, `DataTable` (first rows and "show all"; no sorting yet), `ErrorPage` (404).
- Changed and shared with earlier pages: `BarList` (slots `label` and `bar`, generic rows; a link goes through `EntityLink`), `DivergingBar` (`colors`), `DayBars` (`selectable`), `GroupSunburst` (slots `name` and `sub`), `LinesChart` (an end-of-line link to a ported page is a router link), `StoryList` (router link), `utils/links.ts` (`storyHref` is `/story?id=`, `portedPath`, `searchTarget` keeps the query of an entity), `useFixture.ts` (`useFixtureLazy`).
- Layout: a detail page gets the back button, the trail bar and no page head, and marks the tab that lists it with `aria-current="true"` (`definePageMeta({ detail: '/stories' })`; `useNav` takes the section from it). The page head stays in the DOM with `v-show`, because the page that is left for a tab teleports its controls to `#page-actions` before the layout learns the route changed (a Vue error without it).
- `scripts/pixel-diff.mjs` takes a route with a query (`/story?id=100`). `scripts/story-detail.test.mjs`: related stories (against the inline code of `story-v2.html`, same ids and scores for 10 stories), reach (against `Spread.profiles`), sums, window, people order, difference rows.

## Why the page is drawn in the browser only

The id is in the query, which the prerendered page does not have, and the data of a story is 1.4 MB (`storyDetail.json`) that should not go into the payload. `story.vue` renders `StoryDetail` inside `ClientOnly`, with lazy fixtures. A first version with an async setup under `ClientOnly` gave `Cannot read properties of null (reading 'emitsOptions')` when going back and leaving fast; the lazy fixtures removed it.

## Measured

`npm test` 82 of 82, `nuxt typecheck` clean, `npm run generate` builds (`/story` is prerendered as an empty shell).

Pixel diff (`npm run check:pixel`, limit 0.05%), pixels that differ:

| Page | 1440 | 390 | hover | night 1440 | night 390 |
|---|---|---|---|---|---|
| `/story?id=100` (all cards) | 0 | 0 | 0 | 0 | 0 |
| `/story?id=4502` (7 people, 30 outlets) | 0 | 0 | 0 | 0 | 0 |
| `/story?id=9858` (no labels, the note card) | 0 | 0 | 0 | 0 | 0 |
| `/story?id=999999` (404) | 0 | 0 | none | 0 | 0 |
| `?id=100&state=empty`, `&state=error`, `&state=bad` | 0 | 0 | none | 0 | 0 |
| `/stories`, `/groups`, `/media`, `/media/writing` (after the shared components changed) | 0 | 0 | 0 | 0 | 0 |
| `/trends` | 0 | 0 | 0 | 0 | 2 137 |

`/trends` night at 390 is the known tab-bar race of the static page (2 137 is its usual value; not this change).

Browser checks on the build (Playwright): a story row on `/stories` opens `/story?id=` without a document load; a related story opens at scroll 0 with the new title; the back button goes to the page before (the previous story), the trail link goes to `/stories`; the tab Ιστορίες has `aria-current="true"`; `?lang=en` gives "Story", "Stories · Apotypos"; choosing a story in the global search opens it without a document load. Dev server, signed out and signed in, 1440: no warnings on `/story` for 5 stories and states; the English night case shows the known English first frame and the 390 width shows an `inert` mismatch on the sidebar, both of which `/stories` and `/trends` show too.

## Differences from the static page

- `/story` with no `id` shows the 404 card. The static page reads `Number(null)` = 0 and shows story 0. I judged that a bug and did not copy it.
- A link to a story or a search result is a router link; the static page loads a new document.

## Not checked

Netlify preview (the `story-v2.html?id=` 301 keeps its query on Netlify; only the `_redirects` line was read), Safari, Firefox, widths other than 1440 and 390, the page change time, the topic/outlet/group links on this page (they still open static pages: `topic-v2.html`, `outlet-v2.html`, `group-v2.html`), the sort of `DataTable` (not built).

## Shared with Home (U14)

`SparkLine`, `EntityLink`, `BarList`, `DayBars`, `DivergingBar`, `StackedBar`, `ChartLegend` are generic. `EntityTitle`, `EntityFact`, `DataTable`, `ErrorPage` and the detail-page layout are for the other detail pages (outlet, group, topic).
