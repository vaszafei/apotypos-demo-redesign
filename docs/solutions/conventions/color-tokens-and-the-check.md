---
title: Every color is a token in tokens.css, read lazily, and chosen by measurement
date: 2026-11-02
category: conventions
module: prototypes/assets
problem_type: convention
component: frontend
severity: high
applies_when:
  - adding or changing any color in docs/redesign/prototypes (CSS, page scripts, assets/*.js)
  - writing JS that computes with a color (tint, textOn, a mix, a contrast test)
  - picking a new color for data, stance, a group or a theme
tags: [tokens, colors, themes, dataviz, contrast, check]
---

# Every color is a token in tokens.css, read lazily, and chosen by measurement

## Context
Issue #2, part 1 (PR #100) moved every color into `assets/tokens.css`, in layers:
- neutrals and the accent;
- categorical `--cat-0…9`;
- parties `--party-*`;
- sequential `--seq-1…7` with `--seq-text-1…7`;
- diverging (stance, emphasis, `--side-a/b`, `--div-mid`);
- data series;
- status;
- `--shade` for shadows.

`pnpm check` (`scripts/check.mjs`) now fails in three cases: a color literal outside `tokens.css`, a contrast below its minimum in any theme, and accent, series and supportive too close together.

Three traps showed up along the way.

## Guidance
- **No literal colors outside `tokens.css`.** This covers hex, `rgb()` and `hsl()`. Add a token, then use `var(--x)`. For alpha, use `color-mix(in srgb, var(--x) 5%, transparent)`, which equals `rgba(x, 0.05)`. Run `pnpm check` before you push.
- **JS that needs a hex calls `Dash.color('--name')`.** That covers `tint`, `textOn`, `parseInt` slicing and canvas. A style that only shows a color uses `var(--name)`.
- **Never read a token at script load.** `dash.js` and `mme.js` load before `shell.js` sets `data-theme`, so a value read at load is always the paper value. `Dash.SLOTS` and `NO_GROUP` are getters for that reason, and `TOPIC_SLOTS` is a list of `var()` strings.
- **Hex values computed by JS do not follow a theme switch on their own.** The swatch click now redraws the page through `remount()`, as a log in does. It restores the scroll position twice, because `Dash.fit` charts draw one frame later and the page is shorter until then.
- **Matrices and heatmaps use `Dash.seq(v)`.** It returns a step of the ramp and the text color for that step. Do not build a new tint scale.
- **Choose colors by measurement, not by eye.**
  - CIEDE2000 for "looks different": 15 or more between accent, series and supportive.
  - WCAG contrast: 4.5 to 1 for text, 3 to 1 for marks.
  - Machado simulation for color vision deficiency.
  
  The color math is in `scripts/check.mjs`. One example of what eyes miss: a lighter dark-theme green (`#2fa02f`) passed contrast but was ΔE 1.8 from slot 8 (red) under deuteranopia.
- **Each theme needs its own distinctness check.** Fog and terra had copied the accent hue into the series color (ΔE 7.3), and only a per-theme check found it.

## Why This Matters
A literal color breaks in four of the five themes. A token read too early gives paper colors in night, with no error anywhere. Hues picked by eye repeated the original problem: three blues with three meanings.

## When to Apply
Every color change, every new chart, and every new theme.

## Related
- [Use theme tokens in CSS](theme-tokens-only.md)
- [Checklist after changing a shared prototype asset](../workflow/shared-asset-change-checklist.md)
