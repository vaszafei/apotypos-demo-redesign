# Report: the home hero field (2026-11-06)

Branch `claude/hero-stories`, PR #119. The faint area of articles per day (`Wave`) behind the hero is replaced by `assets/hero-field.js`, a canvas of dots.

## What it does (version 4: a network)
- The dots are articles. A story is its dots joined by thin lines into one web (each dot to its nearest placed dot, some to the second nearest, the dot nearest the middle is the hub). A thema is the stories that share it, joined by dashed arcs, a chain from the largest story, bowed away from the middle of the hero so the arcs keep off the text. 9 webs (4 on a phone): the top stories of the day, sized by their articles that day. A web takes the color the donut of the topics gives its thema (the 6 largest news themata of the day); the rest and the soft themata stay in the ink color. About 70 loose dots are the other articles, with no line; they take the themata in the shares of the day. A dot stands for several articles: it shows size, not a count.
- The motion is slow and soft (the user found version 4 too quick, and its re-forming abrupt). The webs drift at 4 to 8 px/s (version 4: 9 to 15), turn slowly, and each dot wanders a few pixels on two slow waves, so a web breathes. On load the dots start all over the hero and gather into webs over about 8 seconds.
- Nothing snaps when the day changes (every 20 s, was 12). There are always the same 9 webs (4 on a phone); each keeps its place, shape and dots from day to day and takes the story of its rank. The dots of a web fade in or out one by one after their own delay of up to 5 s, its color blends into the new thema over 2.5 s, and the arcs of the themata fade in and out. A line is as strong as the weaker of its two dots.
- The pointer parts the loose dots and wakes them near it. A web it reaches lights up, with the webs and arcs of the same thema; the shared tooltip names the story, its thema and its articles that day. Nothing is a link, and outlets are not shown.
- The days are 6 (then the latest again). A line is as strong as its web is settled, and a line stretched beyond 2.5 times its length is not drawn, so a web that gathers does not throw lines across the hero.
- The tooltip of the field is translucent (the card color at 74%, blurred), with a class `is-field` that only the field adds and removes, so the tooltip of the charts stays as decided.
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

## Version 5
The user said the movement is too quick and the repositioning should be more entropic. Version 5 keeps the webs and the arcs and changes how they move, as described above. Checked with screenshots at 1.5, 4, 8, 10, 21.5, 24 and 28 s, hover, reduced motion and a phone: no console errors, check.mjs passes. The speed is judged from still frames only; it needs a look in a live browser.

## Version 6 (zoom tried and removed)
The tooltip of the field was made translucent (kept). A click-to-zoom on a web was built (caption, camera, Esc / click outside to leave) and checked, then the user did not like it and asked to remove it, so it is gone: a click on the field does nothing. Checked after the removal in Chrome: tooltip has the `is-field` class on hover and loses it when hidden, a click does not navigate or zoom, no console errors, check.mjs passes.

## Not checked
Touch devices (hover is off there on purpose; on a phone the webs are not clickable), Safari, the English text on screen, the pointer effect by eye in a live browser, a phone screenshot of version 3. In the night theme the colored clusters at rest are dim (alpha 0.5 on a dark page). `/ce-code-review` and `/ce-compound` were not run.
