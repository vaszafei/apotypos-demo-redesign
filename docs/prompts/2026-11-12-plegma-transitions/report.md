# Report: Plegma transitions (branch claude/plegma-transitions, 2 commits c0b43d2 and c7582c4)

## Before (CDP screencast of Home -> /topic?i=3 at 1440x900)
- 0-300 ms hero; at ~340 ms one frame of the unstyled footer and the back/trail bar; the hero fog cut to nothing in one frame.
- The theme web was drawn complete the moment the view mounted (no growth); the ring switch and a loading note ("Πρωτότυπο: ... ?state=empty") showed before the web.
- Title and cards arrived at ~2.0-2.4 s with a slide.

## Built
- `PlegmaStage.vue`: the web of a story, theme or outlet grows (nodes leave the center, nearer first; lines at 30%, ring at 55%; 1100 ms). It starts when the camera is 30% through its flight and the view has measured its area. The last frame of the hero is copied to two canvases that fade out over 800 ms while the camera flies. The stage fades (520 ms in, 260 ms out) on routes with and without the map instead of `hidden`.
- `plegma-camera.ts`: flights 800-2200 ms (were 900-3600), rounded to whole ms (a test depended on the old integer clamp).
- `PlegmaCard.vue` + `plegma.css`: a card is a box (fades in), an 8x5 grid of blocks (`i` spans, `--d` = row + column) that grow and shrink in a sweep from the top left (34 ms per diagonal, 420 ms each), and its body fades in under them; cards are staggered 110 ms by `order`. The card no longer scrolls itself, its body does. Reduced motion and phones: no blocks.
- Title, ring switch and the note under the web fade in with the cards.
- Ring switch: two rectangular 6px buttons, the pressed one filled like Εγγραφή.
- The footer and the trail bar are hidden on every map route at 1024+ (no flash); the "proto-note" is not shown while loading.

## Measured
- `npm test` 175 pass, `nuxt typecheck` exit 0. Screencast timelines: Home -> theme by search (fog fades 1.7-2.2 s after the click, web grows ~2.5-3.0 s, cards sweep in 3.0-3.6 s), Μέσα -> theme, theme -> Μέσα, Home -> story, Home -> outlet. No console or page errors.

## Not checked
- Safari, Firefox, phones, reduced motion by eye, the night theme, Back/Forward. Block color (30% ink on the page) and the 8x5 grid are first guesses; the user has not seen them.
- Cards of the non-map pages (Μέσα, etc.) have their own motion and were not touched.
- The search field (pill) and the Home chips are still pills; only the ring switch was changed.
