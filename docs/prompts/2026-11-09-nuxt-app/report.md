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

## U3: Tailwind 4 without reset (branch `claude/nuxt-tailwind`)

New: `tailwindcss` and `@tailwindcss/vite` in `web/`, `web/app/assets/css/tailwind.css` (the layer order, `theme.css` and `utilities.css`, both `prefix(tw)`, no preflight), registered in `nuxt.config.ts` (`css` and the Vite plugin). No token is mapped.

Measured:

- Built CSS without a `tw:` class anywhere: `entry.*.css` is 106 bytes (the licence line and the layer order). No reset rule, no utility. With a probe file containing `tw:p-4 tw:bg-red-500 tw:flex` it adds only `:root{--tw-color-red-500, --tw-spacing}` and those three classes; the probe was removed before commit. The variables are prefixed, so no prototype token is touched.
- In Chrome on the built `/trends`: an element with `tw:p-4 tw:bg-red-500 tw:flex` gets `padding 16px`, `oklch(0.637 0.237 25.331)` and `display:flex`; one with `p-4 flex` gets `0px` and `block` (the prototype owns the unprefixed names).
- `check:pixel -- /trends`, before and after: the four 1440 screens are identical, band by band. The two 390 screens are not stable, before or after (below).
- `npm run typecheck` exit 0, `npm test` 4 pass, `check:parts --root .output/public` all pass.

**The 390 numbers flip between two values on the same build.** 390 full page is 254 or 2 327 px; 390 night is 2 747 or 4 884 px. The difference is one band, rows 93-104 (the tab bar), 2 073 / 2 137 px. The same unchanged build gave 254 twice and 2 327 four times in six runs; the first runs of this session (before any change) gave 254 and 2 747.

Cause, measured: the tab bar's `scrollLeft` after load. In 12 fresh loads at 390, the Nuxt page was 77 every time; the static `topics-v2.html` was 77 seven times and 56 five times. The static page runs `centerTabs` (`assets/shell.js:1039`) sometimes before the font has loaded, and the tab ends up 21 px off. So it is a race in the static reference page, not something Nuxt or Tailwind changed. This also explains two open items from U2: the U2 report's 4 884 for 390 night (the other mode), and the 2 073 px band at 390 that looked like a U6 problem.

Consequence for the checks: a 390 result in `check:pixel` is one of two values until the static race is dealt with. Not changed here; it is a decision for a later unit (U6 or a fix in `shell.js`).

One more thing that did not change: Nuxt's own `error-404.*.css` and `error-500.*.css` still use UnoCSS-style classes, scoped by `data-v`; they were in the build before U3.
