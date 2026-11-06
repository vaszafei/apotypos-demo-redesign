# Report: the home hero field (2026-11-06)

Branch `claude/hero-stories`. The faint area of articles per day (`Wave`) behind the hero is replaced by `assets/hero-field.js`, a canvas of dots.

## What it does
- The articles of a day are dots, the stories are clusters. 9 clusters (4 on a phone) for the top stories of the day, sized by their articles that day, in the free space around the text; about 70 loose dots; about 250 dots in all. A dot stands for several articles: it shows size, not a count.
- The pointer parts the loose dots and wakes them near it. A cluster the pointer reaches lights up: its dots take the color of the group of the outlet that ran them, in proportion to the outlet's articles, and the shared tooltip names the story, its first three outlets and the day. Nothing is a link (the user asked for interaction only).
- Every 12 seconds the clusters dissolve and form again from the day before (6 days, then the latest again). `Wave` stays as the fallback when the story data does not load.
- Reduced motion: one static settled frame, no loop. The loop pauses when the tab is hidden or the hero is off screen.

## Measured (Chrome via Playwright, 1440×900 and 390×800)
- No console or page errors in any run.
- Clusters formed at 2.6 s after load; the first version took about 6 s (spring stiffened).
- Hover tooltip found in light, night and reduced-motion runs; the tooltip hides when the pointer leaves.
- `node ../docs/redesign/prototypes/scripts/check.mjs` (from `web/`): All checks pass.

## Findings
- In the fixture every top story has the topic «Άλλα», so a topic cannot be a color. The color is the ownership group of the outlet.
- A first version had two variants (stories, rings with threads between the outlets of a story) and a click to the story page. The user found both crowded and wanted no click-through, so the rings variant and the click were removed.

## Not checked
- Touch devices (hover is off there on purpose), Safari, the English text on screen, the pointer effect by eye in a live browser (still images show only an empty bubble around the cursor), a phone screenshot after the last spring change.
- `/ce-code-review` and `/ce-compound` were not run.
