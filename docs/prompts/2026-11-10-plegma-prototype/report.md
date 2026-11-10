# Report: Plegma flight and layout prototype (U1)

Plan: `docs/plans/2026-11-10-1628-feat-plegma-world-map-plan.md`, unit U1. Branch `claude/plegma-prototype`. Prompt: `prompt.md` in this folder.

The prototype is one page that draws all 7,515 non-generic stories of `web/public/data/stories.json` and `storyDetail.json` on a canvas, with the hero's web and arc drawing. It is machine-local and gitignored: `.context/compound-engineering/ce-prototype/2026-11-10-plegma-flight/01-flight-and-layout/` (`screens/001-plegma.html`, `strips/` with the screenshots and frame strips the user judged). A missing prototype is not a blocker; this report and the plan's requirements govern.

## What the user chose (their picks from the strips, 2026-11-10)

| Question | Choice | Over |
|---|---|---|
| Flight path | 2, pull back and dive | 1 glide, 3 three beats |
| Layout rule | A, seeded spread (first day across, vertical spread by seed) | B theme bands, C size ridge |
| Card arrival | a, after landing (camera settles, cards slide in one after another, 120 ms apart) | b during the dive, c out of the web |
| Map region | smaller than the drawn box (top-left 56% × 56% of the screen) | as drawn, larger |

Consequences for the plan: KTD4's vertical rule is the seeded spread, so the banded candidate and the Key Decision's "if the user picks it" clause are not used. KTD7's mechanism is the dive path. KTD8's card arrival is "after landing". KTD14's map region is smaller than the prototype's box; the exact size was not given, my call is about 50% × 50% of the screen (top-left), to be set against the real cards in U7 and confirmed in the first screenshot there.

## Things the prototype showed that the plan did not know

- **The stories fixture has two blocks and a gap.** Stories exist for days 0 to 60 (1 Aug to 30 Sep) and 74 to 87 (14 to 27 Oct); days 61 to 73 (1 to 13 Oct) have no story. The map has an empty 13-day stretch.
- **First days are clipped at the start of each block.** 252 stories have first day 0 and 368 have first day 74 only because the block begins there. A plain first-day axis piles them into two columns. The prototype smears a story whose first day is 0 or 74 back by up to six days from its seed (`smear`); U2 should do the same, with the two block starts read from `stories.json` (`dates[0]` and `dbCovered[0]`), not hard-coded.
- **A far-apart comparison is not readable.** Fitting both webs of a pair months apart in the map region gives zoom 0.12 and two specks. KTD11's "both draw as webs at any zoom" does not hold at that zoom. The decision for U10: keep the focused story's framing and show the second story as a marker with its name and a line, and fly to it only when selected (my call, not shown to the user).
- **A theme of 667 stories frames as a thin strip of dots.** Frame a theme on its largest stories (the ones with arcs, about 25), not all of them (KTD14 says arcs are limited to the largest; the framing should be too).
- **A 7-article story gets a readable web** when focused (minimum 8 dots), as R6 asks. An October story has three headline cards, one empty slot and no dock; its related stories card works for it.
- **Dots of a web:** a square-root scale to 32 dots at 600 articles (the ladder, `strips/6-dot-ladder.png`): 6 articles 9 dots, 60 articles 14, 400 articles 27, 800 and 3,219 articles 32. The user was shown the ladder but did not comment; 600 stays my default for KTD5.
- **Arcs per theme:** 25, chained by first day, were drawn for the 14-story theme and the 667-story theme; the user did not comment. 25 stays my default for KTD14.

## Measurements (headless Chrome, 1440×900, software rendering, this machine; bands is the layout the user did not pick, spread is the one they did)

Frame intervals over 5 s idle or 2.6 s of a flight; `draw` is the time the prototype spent drawing one frame.

| Case | 1× CPU | 4× CPU |
|---|---|---|
| Static hero idle (today) | median 16.7 ms, 0 frames over 50 ms | 16.7 ms, 0 |
| Prototype, spread, Home idle | 16.7 ms, 0 | median 33.3 ms, p95 49.9, 4 over 50 ms |
| Prototype, spread, flight Home to story | 16.7 ms, 0; draw median 1.2 ms, p95 5.3 | 16.7 ms, p95 50, 3 over 50 ms; draw median 3.3 ms |
| Prototype, spread, flight story to the 667-story theme | 16.7 ms, 0 | median 33.3 ms, p95 83.3, 23 over 50 ms of 64 |

Reading: canvas 2D holds 60 frames per second at 1× with all 7,515 stories. At 4× CPU Home idle runs at half the static hero's rate and the flight into the large theme drops frames. The cause is drawing every story every frame, so the build needs a cached layer for the dots that do not move and a redraw of only the webs, not a new technique. WebGL is not needed on this evidence (KTD3). The 4× result is the one to fix before U4 is called done.

## Commands

- `node` + `playwright-core` (`web/node_modules`) with `/usr/bin/google-chrome` against the prototype served by the ce-prototype helper; frames taken with a manual clock (`P.seek(ms)`), montage and labels with ImageMagick.
- CPU throttling through CDP `Emulation.setCPUThrottlingRate`; the static hero served from `docs/redesign/prototypes` by `python3 -m http.server`.
- No console errors in any run.

## Not checked

Real-time feel of the flight (the user judged frames, not motion), night theme, English, Safari, Firefox, touch, the cards' final look (they were placeholders with real numbers), and a flight that starts while another runs.
