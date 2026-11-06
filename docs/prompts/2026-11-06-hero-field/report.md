# Report: the home hero field (2026-11-06)

Branch `claude/hero-stories`, PR #119. The faint area of articles per day (`Wave`) behind the hero is replaced by `assets/hero-field.js`, a canvas of dots.

## What it does (version 4: a network)
- The dots are articles. A story is its dots joined by thin lines into one web (each dot to its nearest placed dot, some to the second nearest, the dot nearest the middle is the hub). A thema is the stories that share it, joined by dashed arcs, a chain from the largest story, bowed away from the middle of the hero so the arcs keep off the text. 9 webs (4 on a phone): the top stories of the day, sized by their articles that day. A web takes the color the donut of the topics gives its thema (the 6 largest news themata of the day); the rest and the soft themata stay in the ink color. About 70 loose dots are the other articles, with no line; they take the themata in the shares of the day. A dot stands for several articles: it shows size, not a count.
- The webs roam (they are not at fixed places): each has a heading that turns slowly, turns away from the edges, from the text of the hero and from the other webs, and turns slowly as a whole. A web under the pointer almost stops.
- The pointer parts the loose dots and wakes them near it. A web it reaches lights up, with the webs and arcs of the same thema; the shared tooltip names the story, its thema and its articles that day. Nothing is a link, and outlets are not shown.
- Every 12 seconds the webs dissolve and form again from the day before (6 days, then the latest again). A line is as strong as its web is settled, and a line stretched beyond 2.5 times its length is not drawn, so a forming web does not throw lines across the hero.
- Reduced motion: one static settled frame. The loop pauses when the tab is hidden or the hero is off screen. `Wave` stays as the fallback when the story data does not load.

## Data finding
`home.issueDaily` has themata only until 2026-09-30; from 2026-10-01 the data is volume only (`volumeFrom`), and every story of those days has the topic «Άλλα». The home already shows "no topics" for those days. So the field uses the latest days that have themata (25 to 30 September in this fixture), and the tooltip names the date. With complete data this becomes the latest days by itself. If no day of the period has themata, it shows the latest days in the ink color.

## Measured (Chrome via Playwright, 1440x900 and 390x800)
- No console or page errors in any run.
- Clusters formed 2.6 s after load. Frames 6 s apart show the clusters at different places.
- A frame during the re-form had lines stretched across the hero (a hairball); fixed as described above and checked again.
- Hover: tooltip rows (Θέμα with the color, Άρθρα, the date) found; same-thema webs and arcs lit; tooltip hides when the pointer leaves; for a cluster near the top the tooltip goes under it (checked in the night theme).
- `node ../docs/redesign/prototypes/scripts/check.mjs` (from `web/`): All checks pass.

## History
Version 1 had two variants (stories; rings of outlets with threads) and a click to the story page: too crowded, and the user wanted interaction only. Version 2 had fixed cluster places and colored by outlet group: the user did not want fixed places, and wanted themata and stories, not outlets. Both were replaced. Version 3 had clusters of dots without lines: the user wanted connections between the article dots that show the stories and the themata, so version 4 draws the webs and the arcs.

## Not checked
Touch devices (hover is off there on purpose), Safari, the English text on screen, the pointer effect by eye in a live browser, a phone screenshot of version 3. In the night theme the colored clusters at rest are dim (alpha 0.5 on a dark page). `/ce-code-review` and `/ce-compound` were not run.
