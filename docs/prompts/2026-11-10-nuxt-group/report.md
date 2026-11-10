# Report: the group page as a Nuxt page (`/group?g=`)

Branch `claude/nuxt-group`, from `main` at `cf8f954`. Third detail page of U9. Scope set by the user: only the pages that take the redesign are ported (group, outlet); Αναλύσεις stay static.

## What changed

- `web/app/pages/group.vue` and `components/GroupDetail.vue`: the page of `group-v2.html`. Route `/group`, the query stays `?g=` (Politis Group when there is none). Drawn in the browser like the story and topic pages.
- `utils/group-detail.ts` (the daily articles of the group, the window of the title card, its stories, topics and how it writes) and `utils/profiles.ts` (`Spread.profiles` of `assets/spread.js`: which groups wrote a story and how it started). `scripts/group-detail.test.mjs` runs the profiles against the static `spread.js` (same result for all stories) and checks the rest by their rules.
- New shared components, all needed by the outlet page too: `DailyCard` (Entity.DailyCard: the daily columns with the news / topics switch), `SegmentedControl`, `HBar`. Extended: `StackedBar` (`minN`, so a stance bar of few articles is a text), `EntityTitle` (slot `title`, the name with its color dot), `DayBars` (null days).
- Links: `groupPageHref` is `/group?g=`; the sunburst, the tiles, the network and the story page open the group as a router link (`GroupsNetwork` leaves the router for a static page only when the page is not ported).
- Renamed `STORIES` of the topic page to `TOPIC_STORIES` (Nuxt auto-imports both names, and the group page then showed 5 stories instead of 4).

## Measured

`npm test` 95 of 95, `nuxt typecheck` clean, `npm run generate` builds.

Pixel diff (limit 0.05%, a check, no longer a requirement): 0 on every screen (1440, 390, hover, night 1440, night 390) for all 8 groups and `/group` with no slug. After the shared changes: 0 on `/topic?i=5`, `/story?id=100`, `/groups`, `/media`; `/trends` night 390 gives 2 137, the known tab-bar race.

Own browser checks (Playwright, build): the tooltip of every hover target (21 to 30 per group: daily columns, difference bars, stance bars of the table, sparklines) is the same text as on the static page for 4 groups, in the news mode and in the topics mode of the daily card. A group link on `/groups` and on the story page opens `/group?g=` without a document load; the trail shows the group name; the tab Ιδιοκτησία is marked; back works. A first run found a real defect (the topic rows of the card "Θέματα του ομίλου" had empty names in their tooltips), fixed. Dev server (signed out, signed in, night with icons and English, 390, 404, three states): no warnings except the known `inert` mismatch at 390.

## Differences from the static page

- An unknown group, `?state=error` and `?state=bad` show the tab name in the trail bar (`Ιδιοκτησία`); the static page shows `Μέσα` there (455 pixels in the trail text). I kept the Nuxt text.
- A group link is a router link; the static page loads a new document.
- The sparkline label of a story row is `media2.spark.articles` (the static `outlet2.stories.spark` has no message), as on the topic page.

## Not checked

Netlify preview (the `group-v2.html?g=` 301 keeps its query: only `_redirects` was read), Safari, Firefox, widths other than 1440 and 390, the page change time, touch and keyboard on the bars, the outlet links on this page (they still open the static page).
