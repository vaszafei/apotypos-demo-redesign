# Report: one color system (2026-11-02)

Branch `claude/wizardly-pasteur-uizc4e`, PR #100, issue #2 part 1. Plan: `docs/plans/2026-11-02-1400-refactor-color-tokens-plan.md`.

## What changed

- `assets/tokens.css` holds every color, in layers:
  - neutrals (with the new `--surface-sunken`, plus `--rule` and `--bar-muted`)
  - the accent
  - categorical `--cat-0`…`--cat-9` and `--cat-strong`
  - parties `--party-*`
  - sequential `--seq-1…7` with `--seq-text-1…7`
  - diverging: stance, `--stance-critical-strong`, emphasis, `--side-a/b`, `--div-mid`
  - data series
  - status, with the new `--success-*` and `--notice-text`
- The local `:root` blocks of `dash.css`, `politics.css` and `world.css` are removed.
- `dash.js`:
  - `Dash.color(name)` returns a token as hex. Its cache key includes the theme.
  - `Dash.seq(v)` returns a ramp step and the text color for that step.
  - Groups map to slot numbers.
  - `SLOTS` and `NO_GROUP` are getters that read the tokens.
- `mme.js`, `fingerprints`, `similarity`, `elections`, `persons`, `speeches` and `war` read tokens instead of hex.
- `scripts/check.mjs` is new, run with `pnpm check` in `web/`.
- `pages.html` has a new "Χρώματα" section with every token. A theme switch updates it live.
- `?v=` was bumped on all pages for 8 assets: `tokens.css` 13, `app.css` 42, `dash.css` 84, `politics.css` 6, `world.css` 5, `dash.js` 18, `mme.js` 22, `messages.js` 35.

## Color decisions (measured with CIEDE2000 and WCAG contrast)

| Token | Before | After | Reason |
|---|---|---|---|
| `--series-1` paper and terra | `#2a78d6` / `#cf5b30` | `#1a7f9a` | ΔE 21 from the accent (was 12); 3.8 to 1 on the card |
| `--series-1` fog | `#1f7fa8` | `#4a5fd8` | The fog accent is teal (`#0a6c8f`), so the old series was ΔE 7.3 from it; now 16.1 |
| `--series-1` night and midnight | `#5d9bea` / `#4ea4f2` | `#38b6cf` | ΔE 20.9 / 16.8 from the accent |
| `--stance-supportive` | `#2a62c4` | `#874099` (dark themes: `#b98ae8`) | ΔE 20.5 from the accent (was 7.7); ΔE 20 from critical under color vision deficiency; ΔE 14 from slot 7 |
| `--cat-6`, `--cat-7`, `--cat-9` in night and midnight | `#008300`, `#6250d6`, `#4b5d73` | `#1f8f1f`, `#8a7cf0`, `#7d8ea6` | They were 2.84, 2.43 and 2.08 to 1 on the midnight card; now 3.35, 4.16 and 4.21 |

Approaches I dropped:
- Using `#2fa02f` for slot 6 in the dark themes. It passed contrast, but it was ΔE 1.8 from slot 8 (red) under deuteranopia.

## Results

`node docs/redesign/prototypes/scripts/check.mjs`, exit code 0:

```
1. Hex colors outside tokens.css (57 files)
  ok: none
  [paper]  note: 4 slots below 3 to 1 on the card (light themes keep the dataviz palette): --cat-2 --cat-3 --cat-4 --cat-5
           warn: --cat-1/--cat-7 deuteranopia ΔE 5.5, --cat-2/--cat-6 protanopia ΔE 4.7, --cat-2/--cat-8 tritanopia ΔE 5.5
  [fog], [terra]: the same note and warnings
  [night], [midnight]: warn: --cat-1/--cat-7 protanopia ΔE 5.5, --cat-2/--cat-6 protanopia ΔE 4.3, --cat-2/--cat-8 tritanopia ΔE 5.5, --cat-6/--cat-8 deuteranopia ΔE 7.4
All color checks pass.
```

Check of the check:
- I added a temporary page with `#123456` and set supportive back to `#2a62c4`.
- The check gave 4 failures and exit code 1: the hex value, and the accent/supportive and series/supportive distances in paper and fog. I then restored both files.

`pnpm check:visual --themes all`: 840 loads (42 pages × 4 widths × 5 themes) in 459 s. No findings.

Playwright (`reducedMotion: 'reduce'`, 1440 px, paper and night) on media-v2, groups-v2, group-v2, similarity-v2 and fingerprints-v2:
- `Dash.groupColor` gives the same color for each group on all 5 pages.
- The group dots on the page match the slot map.
- In night, slots 6, 7 and 9 read the lighter values.
- Similarity draws 463 cells from `--seq-*`.
- There are 0 console errors.

I logged in as a fixed account and loaded war-v2 (paper and night), elections-v2, speeches-v2 and persons-v2 (checks tab): 0 console errors.

Screenshots I looked at:
- 1440 px: pages.html tokens (paper), similarity matrix (night), fingerprints people matrix (paper and night), media-v2 (paper and fog), war-v2 (night).
- 390 px: elections-v2 (paper), from the visual check.
- Other widths were only measured by the visual check, not looked at.

## Differences from the plan

- **War heatmap:** it stays a red mix of `--stance-critical`, now over `--surface-raised` instead of white. I did not move it to the sequential ramp, because it shows the share of war language and red carries that meaning. In night the cells now sit on the dark surface; before, they mixed toward white.
- **Fingerprints:** it stays a stepped diverging scale with its own text computation. Only its colors come from tokens: emphasis, stance and `--div-mid`.
- **Theme switch without a reload:** colors that the JS computed as hex (`tint`, `textOn`, `groupColors`, fingerprints) keep the old theme until the page redraws. This was already true before. Colors written as `var()` change at once.

## Open points for the user

- In the light themes, slots 2–5 are below 3 to 1 on the card (2.24–2.66). Three slot pairs are close for color vision deficiencies (ΔE 4.3–5.5). Both come from the existing palette, which the decision kept. A new palette would change every group color.
- Slot 1 (Alter Ego, `#2a78d6`) is still a blue near the accent: ΔE 12.4.

## Review and follow-up (after the merge of #100)

An agent that did not write the code reviewed `origin/main..HEAD`. It loaded 29 pages in paper and night and found no page errors and no `NaN`/`undefined` colors. It confirmed two gaps:

1. **Theme switch:** hex colors computed by JS (`Dash.color`, `groupColors`, `tint`) kept the old theme until a reload. Example: fingerprints cells stayed on the paper colors after a switch to night.
   - Fix: the theme swatch now redraws the page with `remount()`.
   - It keeps the scroll position, restoring it again two frames later because the charts draw one frame late.
   - It keeps the focus on the visible swatch.
   - Measured with Playwright on groups, fingerprints, war and index, scrolled to the bottom, then switched to night:
     - scroll before and after: 201/201, 74/74, 2056/2056, 996/996;
     - focus on the night swatch;
     - 0 errors;
     - fingerprints cells changed from `rgb(215, 202, 209)` to `rgb(222, 213, 220)`.
2. **`check.mjs` saw only hex:** 17 `rgba()` literals (shadows and hover washes) were in `app.css`, `dash.css`, `date-range.css`, `home.css` and `politics.css`.
   - They are now `color-mix(in srgb, var(--shade) N%, transparent)`. `--shade` (`rgb(17 17 17)`) and `--shade-black` (`rgb(0 0 0)`) are the same in every theme, so the result is identical.
   - The check now also fails on `rgb()`/`hsl()` with a literal number. Tested with a temporary `rgba(1,2,3,.5)`, which was reported.

Not fixed (design, same as before this work):
- `--div-mid` has no dark value, so the fingerprints and net-balance scales are light cells on the dark card in night.

`pnpm check:visual` (paper and night) after the follow-up: 336 loads (42 pages × 4 widths × 2 themes) in 178 s. No findings.
