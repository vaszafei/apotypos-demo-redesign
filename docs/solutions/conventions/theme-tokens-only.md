---
title: Use theme tokens in CSS, never literal colors
date: 2026-10-29
category: conventions
module: prototypes/assets
problem_type: convention
component: frontend
severity: high
applies_when:
  - writing or editing CSS in docs/redesign/prototypes/assets
  - adding a chart, card or state color
tags: [css, tokens, themes, dark-mode]
---

# Use theme tokens in CSS, never literal colors

## Context
`assets/tokens.css` defines the themes `paper` (default), `fog`, `terra`, `night` and `midnight` as `:root[data-theme]` blocks. The theme is stored in `localStorage` key `proto-theme` and set with `?theme=`.

## Guidance
- Never write `#fff`, `#1f1f1f` or pastel hexes in CSS. Use the tokens: `--strong`, `--on-ink`, `--surface-raised`, `--surface-page`, `--accent`, `--emph-more`, `--emph-less`, `--error-*`, `--notice-*`, `--skeleton*`, `--card-edge`, `--logo-filter`.
- For tints use `color-mix(in srgb, var(--accent) 12%, var(--surface-raised))`.
- Scope animation selectors narrowly. A broad `.is-swap > *` rule once hit the calendar `li` tiles, made them offset parents and broke `offsetLeft` scrolling. Scope to `.dcard.is-swap` and use bounding rects for scroll math.
- New charts read the shared frame `UI.CHART_FRAME` (left 44, bottom 24, labels 16 under the plot, bars at most 8 px, smooth lines through `UI.smoothPath`). Card head: `align-items:center; min-height:24px`, title offset 20 px.

## Why This Matters
A literal color is correct in one theme and broken in the others. It shows up only in `night` or `midnight`.

## When to Apply
All CSS and inline styles. Check `?theme=night` after any shared change.

## Examples
Selected tile: `background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised)); border-color: var(--accent);`.

## Related
- [Read layout requests literally](layout-requests-are-literal.md)
