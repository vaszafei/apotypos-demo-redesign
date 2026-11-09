# Report: Nuxt app migration

Running report. Each unit adds a section with what was measured and what was only looked at.

## U1: app in `web/` (PR #129)

Measured (local build, Chrome, signed out, reduced motion, my own script, not the U2 one):

- `npm run generate` 8 s, typecheck passes, `.output/public` 9.8 MB; the static `index.html` and `404.html` are not overwritten by the Nuxt build.
- `/trends` against `topics-v2.html`: 517 of 1 836 000 pixels at 1440, 2 327 of 821 340 at 390. The bands are the same as in the trial build (`nuxt-spike`, built before the move), so U1 changed nothing visually.
- `pagereveal` and `pageswap` report a `viewTransition` from `/trends` to `groups-v2.html` and back.

Not measured: the look of the slide between the two worlds; the Netlify redirect with a query string; the Nuxt error page for an unknown URL (the user checked the preview and said it was all good, without detail).

## U2: pixel diff and Nuxt checks

New: `npm run check:pixel -- <route>` (`web/scripts/pixel-diff.mjs`) and `npm test` (4 tests of the comparison). `check:visual` and `check:parts` take `--root <dir>` or `--base <url>`; with either, the ported pages load at their Nuxt route.

Measured:

- `check:pixel -- /trends`, signed in as `lolovios`, animations put at their end state before each screenshot (the limit is 0.05%):

| Screen | Different pixels | Note |
|---|---|---|
| 1440 full page | 4 782 of 1 836 000 (0.260%) | 4 265 in the header (rows 10-45), the rest in the donut and the line labels |
| 390 full page | 254 of 821 340 (0.031%) | within the limit |
| 1440 date picker open | 5 818 (0.317%) | header 4 265, the rest as above |
| 1440 hover on the first chart | 4 734 of 1 296 000 (0.365%) | header 4 265, the rest as above |
| 1440 night theme | 8 217 (0.448%) | header 4 191; 3 869 in rows 212-522 not explained yet |
| 390 night theme | 4 884 (0.595%) | rows 93-104 (the tab bar) and the donut; not explained yet |

- Explained: the header band is the signed-in state of the static header (the account, no sign-in buttons); the Nuxt shell has no session until U6. The donut edges and the line labels differ only because the trial's `DashCard` always has `m-play`: with that class removed for one run, the 1440 full page, the picker and the hover differ only in the header band (4 265 px). U6 ports `motion.js` and removes the fixed class.
- Not explained yet: the night theme bands (the theme is set by the `data-theme` attribute after load on both sides), and the 390 full page without `m-play` (2 073 px; 254 with it). Both are for U6, where the theme and the tab bar move into the shell.
- The earlier number for the trial (162 pixels at 1440) does not reproduce: the same build gives 517 with my first script signed out, and the picker and hover numbers of the trial were clips. The plan's "within noise" is not met; the cause is that the trial's method is not recorded.
- `npm run check`: 1 failure, `assets/mme.css: .chart .q-label has font-size 11px, below 12px`. The assets are identical to `origin/main`, so it fails on `main` too. Not touched.
- `check:fixtures` passes; `check:parts` passes 43 checks on the static pages and on the Nuxt build (`--root .output/public`); `check:visual --only topics` has no findings in both.

Looked at: crops of the label, the donut and the bar end (Nuxt above, static below) before and after the animation fix.
