---
title: One color system in tokens.css - Plan
type: refactor
date: 2026-11-02
issue: 2 (part 1 of 3)
execution: code
---

# One color system in tokens.css - Plan

## Goal

Every color of the prototypes comes from `assets/tokens.css`. The accent, the data series and the stance colors look clearly different, a group has one color on every page, and a check fails the build if a hex color appears anywhere else.

**Out of scope:** card radius and shadow, the stat card, the diagram kit and the six audit parts. These are parts 2 and 3 of issue #2.

**Authority:** this plan, then `docs/solutions/` (theme tokens only, shared-asset checklist, check class names, settled-DOM proof).

**Stop and report if:** a page gains a console error or horizontal scroll; a text color drops below 4.5 to 1 or a mark below 3 to 1 on its surface in any of the five themes; or two slots fail the color-vision check.

## Token layers (tokens.css, `:root` = paper; themes override)

| Layer | Tokens | Notes |
|---|---|---|
| Neutrals | `--surface-page/card/raised/sidebar/sunken`, `--ink`, `--strong`, `--text-primary/secondary`, `--border`, `--rule`, `--bar-track`, `--bar-muted` | `--rule` and `--bar-muted` move from `dash.css`. `--surface-sunken` is new, the same as `--surface-card`. |
| Accent | `--accent`, `--focus` | UI only. Unchanged in paper (`#2f58f5`). |
| Categorical | `--cat-0` (no group, grey) … `--cat-8`, `--cat-9` (Antenna) | These are today's `SLOTS` values. One fixed group-to-slot map stays in `dash.js`, but it stores slot numbers, not hex values. |
| Sequential | `--seq-1` … `--seq-7` plus `--seq-text-1` … `--seq-text-7` | One ramp for the matrices: Fingerprints, Similarity, War weeks, and the `mme.js` share scale. The text color of each step is set once. |
| Diverging | `--stance-critical/neutral/supportive`, `--emph-more/less`, `--side-a/b` | Supportive becomes violet, not the slot 7 violet (see the distinctness check). `--side-a` and `--side-b` move from `politics.css`. |
| Data series | `--series-1` (= `--series-news`), `--series-other` | Teal-blue in paper (about `#1f7fa8`). Each theme picks a series hue that differs from its own accent, because fog and terra now match them. |
| Status | `--error-*`, `--notice-*`, `--target-bg`, `--success-*`, `--status-ok/over/open/no` | `--success-*` is new. The `world.css` status colors move into tokens. |

## Steps (each one a commit)

1. **Tokens.** Add the layers above to `tokens.css` for all five themes. Remove the `:root` block from `dash.css`, line 2 of `politics.css`, and the `:root` status block from `world.css`.
2. **CSS consumers.** Replace the leftover hex values: `dash.css:118` becomes `var(--rule)`, the `#ffffff` in `world.css:165` becomes `var(--surface-raised)`, and the `app.css:402` color becomes a token.
3. **JS consumers.** Add `Dash.color(name)`, which reads a token with `getComputedStyle` and returns hex. `textOn` and `tint` need hex. Values are cached per theme and the cache clears when `data-theme` changes. `SLOTS`, `NO_GROUP`, `GROUP_SLOT` and `TOPIC_SLOTS` in `mme.js` read slots through it. Where a color only goes into a `style` string, use `var(--cat-n)` directly.
4. **Inline page hex.** Change the hex values in elections, fingerprints, persons, similarity, speeches and war (10 places) to tokens. Matrix pages use the `--seq-*` ramp.
5. **Check.** Add `prototypes/scripts/check.mjs` and `pnpm check` in `web/`:
   - (a) It fails on any `#rgb` or `#rrggbb` in `assets/*.css`, `assets/*.js` and `*.html` outside `tokens.css`, `vendor/` and SVG files.
   - (b) For every theme, it parses `tokens.css` and checks that text is 4.5 to 1 and marks are 3 to 1 on the card and page surfaces.
   - (c) It checks that accent, series and supportive are far enough apart (ΔE2000 ≥ 15).
   - (d) It checks that the categorical slots stay apart under simulated protanopia, deuteranopia and tritanopia (Machado matrices, ΔE ≥ 8 for each pair, or report the pairs that fail).
6. **Reference.** Add a "Tokens" section to `pages.html`: swatches for each layer, read live from CSS, so a theme switch shows every theme.
7. **Bump and verify.** Bump `?v=` for every changed asset on all pages, then run the checks below.

## Verification (results go in report.md)

- `node scripts/check.mjs` shows 0 hex values outside tokens, and passes contrast and distinctness for every theme. The output is pasted in the report.
- `pnpm check:visual` with `--themes all`: no console errors, no failed requests, no horizontal scroll. I will look at screenshots at 1440 and 390 px of media, groups, fingerprints, politics/elections, world and war, in paper and night.
- Groups: each group has the same computed color on media-v2, groups-v2 and group-v2. I check this with Playwright `getComputedStyle`.
- Changes I expect to see: news bars turn teal-blue, supportive turns violet, matrix ramps shift slightly, and fog and terra series colors move off their accent. Everything else should look the same. I'll compare screenshots for the pages that should not change, without using the DOM comparison: the DOM will differ because hex values become `var()`.

## Risks

- `textOn` and `tint` on `var()` strings would break silently. They must always get resolved hex from `Dash.color`.
- A theme switch without a reload would keep stale JS colors. Clear the cache on the `data-theme` mutation and redraw as today. First check how the theme switch redraws.
- Supportive violet next to slot 7 (Σαββίδη `#6250d6`). They rarely share a chart. Pick a violet that passes check (c) against slot 7 too.
