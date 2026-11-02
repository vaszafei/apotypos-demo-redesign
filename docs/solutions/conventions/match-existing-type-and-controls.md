---
title: Take type sizes and control styles from the app, not from a new design
date: 2026-11-02
category: conventions
module: prototypes/assets
problem_type: convention
component: frontend
severity: high
applies_when:
  - building a new panel, form or component in docs/redesign/prototypes
  - the request says "prettier" or "more professional"
tags: [typography, tokens, forms, consistency]
---

# Take type sizes and control styles from the app, not from a new design

## Context
The auth modal used the same font family as the app (`--font-text`, IBM Plex Sans), but its sizes, weights and control shapes were new: 13 px labels, sentence case, 44 px fields with a 10 px radius, a 20 px title. None of them exist elsewhere, so the modal looked like a different product. The user noticed at once.

## Guidance
- Before styling a component, read the existing styles for the same job and reuse them: labels (12 px caption, 700, uppercase, 0.08em), text and buttons (`--text-small`, 14 px), fields (40 px high, 8 px radius), headings (`--text-heading` or the `.card-title` / `.page-title` styles), selected state (accent tint and border).
- Use only the type tokens (`--text-caption` 12, `--text-small` 14, `--text-title` 20, `--text-heading` 28). A literal `13px` is a sign that something is off-scale.
- "Prettier" means spacing, alignment and states inside the app's scale. It does not mean new sizes.
- After building, measure with `getComputedStyle` (family, size, weight, letter-spacing, text-transform) next to an existing element, and show the table.

## Why This Matters
A new size scale on one component looks like a bug, and the user has to find it.

## When to Apply
Every new component or panel, and every restyle.

## Related
- [Use theme tokens in CSS](theme-tokens-only.md)
- [Search the shared CSS for a class name](../workflow/check-class-names-against-shared-css.md)
