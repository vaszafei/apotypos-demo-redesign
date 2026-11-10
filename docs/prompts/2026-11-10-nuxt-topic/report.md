# Report: the topic page as a Nuxt page (`/topic?i=`)

Branch `claude/nuxt-topic`, from `main` at `d97e154`. Second detail page of U9 (after the story page); the group and outlet pages are next.

## What changed

- `web/app/pages/topic.vue` and `components/TopicDetail.vue`: the page of `topic-v2.html`. Route `/topic`, the query stays `?i=` (entry in `ported-pages.json`; `topic-v2.html` now redirects to `/topic`). Like the story page it is drawn in the browser (`ClientOnly`, lazy fixtures): the index is in the query and `storyDetail.json` is 1.4 MB.
- `utils/topic-detail.ts` (pure: stats of a topic, its stories, the outlets with more or less of it, similar topics, the correlation) and `scripts/topic-detail.test.mjs` (the correlation against the inline code of `topic-v2.html` for 64 pairs, the rest by their rules).
- New shared components: `StanceCard` (Entity.StanceCard; the story page uses it now too) and `DiffList` (Entity.DiffRow: the difference bars, with a slot for the name). The outlet and group pages need both.
- `composables/useDetailTitle.ts`: the trail bar of a detail page shows the name of the entity (the `title()` of the static page): the topic name here; the story page keeps the tab name. The page title of the document is `<topic> · Απότυπος`.
- Links: `topicHref` is `/topic?i=`; `TopicDonut` uses `EntityLink`, so every topic link (Τάσεις, Home movers, the donut, the line ends, the story page, search) is a router link. `GroupsData` has `topicsAll` and `topics` of a group (the data had them).

## Measured

`npm test` 89 of 89, `nuxt typecheck` clean, `npm run generate` builds.

Pixel diff (`npm run check:pixel`, limit 0.05%), pixels that differ: 0 on every screen (1440, 390, hover, night 1440, night 390) for `/topic?i=` 0, 1, 5, 12 (catch-all), 35 (smallest), `/topic` (no index = topic 0), `i=999` and `i=abc` (404), and `i=7&state=` `empty`, `error`, `bad`. After the shared changes: 0 on `/story?id=` 100, 4502, 9858, `/stories`, `/groups`, `/media`, `/media/writing`; `/trends` 390 gives 2 073, the known tab-bar race of the static page.

Own browser checks (Playwright, build): for topics 0, 5, 12, 35 the tooltip of every hover target (the daily columns, every difference bar, the stance bars, the sparklines: 44 to 49 targets) is the same text as on the static page. A topic link on `/trends` opens `/topic?i=` without a document load; a similar topic opens at scroll 0; back returns to the previous topic; the trail link goes to `/trends`; the story page's topic link opens the topic; the trail shows the name of the topic and the tab name again after leaving. `?lang=en`: "Topic", "Wildfires and heatwaves · Apotypos". Dev server (signed out, signed in, signed in with night, icons and English, 390, 404, three states, and a client navigation to a similar topic and back): no warnings, except the known `inert` mismatch of the sidebar at 390 (also on `/stories` and `/trends`).

## Differences from the static page

- The sparkline of a story row has the label `media2.spark.articles`; the static page asks for `outlet2.stories.spark`, which no message file has, so it reads out the key. Only the spoken label differs.
- The story page's stance card shows its note under the card only when it has two rows to compare (as `Entity.StanceCard`); before it also showed it under the "not enough articles" text.
- A topic link is a router link; the static page loads a new document.

## Not checked

Netlify preview (the `topic-v2.html?i=` 301 keeps its query: only `_redirects` was read), Safari, Firefox, widths other than 1440 and 390, the page change time, touch and keyboard on the bars, the group and outlet links on this page (they still open the static pages).
