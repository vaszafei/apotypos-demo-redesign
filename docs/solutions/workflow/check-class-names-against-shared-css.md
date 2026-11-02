---
title: Search the shared CSS for a class name before using it
date: 2026-11-02
category: workflow
module: prototypes/assets
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - adding a new component class to app.css, dash.css or another shared stylesheet
tags: [css, class-names, shared-assets, collisions]
---

# Search the shared CSS for a class name before using it

## Context
The auth modal started with the obvious names `.chip`, `.check` and `.field`. All three already existed: `.chip` (tag chip, dash.css), `.check` (a filter checkbox, app.css) and `.field` (the date-range field, app.css). The page loaded without errors, but the reason chips looked like tag chips, a sed edit rewrote the old `.check` rule, and `.field` would have changed the date range on every page that has it.

## Guidance
- Before naming a class, search every stylesheet in HEAD: `git grep -n "^\s*\.name[ ,.:\[{]" HEAD -- '*.css'`.
- Prefix the classes of a component with its name (`.auth-field`, `.reason-chip`) instead of using the plain word.
- When a script edits CSS by pattern (sed, python replace), check `git diff -U0 | grep '^-'`: only lines you meant to remove may be there.

## Why This Matters
There is no build step and no CSS scoping, so a collision shows up only as a wrong look, and often on a page nobody opened.

## When to Apply
Every new class in a shared stylesheet.

## Related
- [Checklist after changing a shared prototype asset](shared-asset-change-checklist.md)
