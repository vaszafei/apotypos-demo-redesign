# PlegmaStage split: report

Branch `claude/plegma-stage-split` (not pushed). Commits: harness (2), state object, core + articles + theme, hero + frame + pointer.

## Result
- `web/app/components/plegma/PlegmaStage.vue`: 1650 -> 171 lines (the loop, the size, the watchers, the template).
- `web/app/utils/plegma/stage/`: `stage-state.ts` (103), `stage-core.ts` (134), `stage-articles.ts` (275), `stage-theme.ts` (284), `stage-hero.ts` (240), `stage-draw.ts` (346), `stage-pointer.ts` (223), `stage-draw-util.ts` (45).

## Measured
- `npm run check:stage` (new): 20 scenes (home, story, story rings, theme, outlet, three backdrop pages; night and phone; tooltip sweeps over 288 points for four scenes). Branch against a baseline from the `main` build (43e850c): 20 of 20 identical, canvases and tooltips. The harness repeated on one build: identical.
- `npm run typecheck` clean (checked that it catches an error in the new files). `npm test` 174 of 174.
- Motion on, headless Chrome (a script in the session scratchpad, not kept): home, click, pointer, home to story to theme to story, back, backdrop page, resize. No console errors. Not compared as pixels.

## Not measured
- Safari, Firefox, a real GPU. Flights, the hero-frame copy and the dive were run, not compared.
- `check:load` was not rerun (no change to the load path).

## Found, not fixed
1. Cold load of `/story?id=1`: about 1 in 5 loads the nodes stay gray (articles arrive after the last draw). Same rate on `main` (6 of 30) and on the branch (5 of 30).
2. Under reduced motion switching the story ring does not redraw (`plegma.ring` is not in the watch at the end of `PlegmaStage.vue`).

Lesson: `docs/solutions/workflow/prove-a-canvas-refactor-with-the-canvas-pixels.md`.

## Update: both bugs fixed (same branch)
1. Not late articles: the sector cache (stage-articles.ts) did not see a replaced article list with the same length, so the ring arcs kept gray slots (nodes were colored). Keyed on the list now.
2. `plegma.ring` added to the watch in PlegmaStage.vue.
- check:stage without any hand redraw: 20 of 20 identical to a baseline of the old build; story scene 20 of 20 in a row (before: 3 of 12 and 1 of 5 differed); old build fails story-stance without the redraw (3315 px), new passes. A forced late groups.json: 8719 colored px (gray arcs) before, 9343 after, 16 of 16 each. typecheck clean, npm test 174 of 174.
