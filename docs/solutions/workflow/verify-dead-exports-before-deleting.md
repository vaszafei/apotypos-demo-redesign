---
title: Verify each dead export with an untruncated grep before deleting it
date: 2026-10-29
category: workflow
module: prototypes/assets
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - deleting or privatizing a name in a window.* namespace of the prototype assets
  - acting on a list of unused exports from a handoff or from export-usage.py
tags: [dead-code, exports, grep, namespaces, cleanup]
---

# Verify each dead export with an untruncated grep before deleting it

## Context

The structure-audit handoff listed 7 "unused" exports and 7 "used only in their own file" (`docs/prompts/2026-10-29-structure-audit-cleanup/handoff.md`). Three of the 14 were wrong, and each wrong entry would have broken a page:

- `Entity.scaleOf` was listed as unused. `group-v2`, `topic-v2` and `outlet-v2` use it through `const { DiffRow, scaleOf } = Entity`. The analysis script itself (`export-usage.py` in the same folder) handles that destructuring and did not flag `scaleOf`, so the error came from copying the list by hand.
- `Dash.Scale` was listed as "used only in its own file". It has no caller at all. The script counts every word match in the defining file, and the comment `// Scale: a line from the lowest...` counted as a use.
- `Mme.StanceBar` was correctly "used only in its own file". But a check grep in PR #96 was piped through `cut -c1-160`. The call `bar: StanceBar(o.stance, o.name, avg)` sits past column 160 of a long line in `GovCard`, so the output hid it. The function was deleted, caught by the gate grep before the commit, and restored.

## Guidance

Treat any list of dead exports as candidates. Before deleting or privatizing each name:

1. Run a word grep for the plain name over every page and asset, with no truncation: `command grep -rnw <name> --include=*.html --include=*.js --include=*.mjs .`. To shorten a long line, print a window around the match (`grep -oE ".{60}<name>.{40}"`), never `cut`.
2. Read every match. Classify each one as a definition, an export entry, a comment, a namespaced use (`Mme.x`, `window.Mme.x`), a destructuring (`const { x } = Mme`), or a bare call inside the defining IIFE.
3. Decide from that classification:
   - **unused** (definition, export, comments only): delete the function
   - **self-only** (bare calls in its own file): remove the name from the `window.*` object and keep the function
   - **used elsewhere**: keep the export
4. Look for dynamic access, which a name grep cannot see: `command grep -rnE "(Dash|Mme|Entity|Shell|Politics|Home|UI)\[|Object\.(keys|values|entries)\(window\."`.
5. After the deletion, rerun the grep. The only matches left should be comments, and the kept names should still have their callers.

## Why This Matters

The pages have no tests and no build step. A wrong deletion surfaces only as a `ReferenceError` on a page someone opens. The visual check catches that, but only after a full run. A wrong "self-only" call is quiet: the export disappears, and nothing fails until another page needs it.

## When to Apply

- Every dead-code PR in the structure audit, and any later cleanup that trusts `export-usage.py` or a handoff list.
- Also for orphaned message keys and CSS classes. Grep with `-F` and the exact key or class. Keep `--include` before the pattern, because `--` before the pattern makes grep read the `--include` flags as file names.

## Examples

PR #96: the plan deleted 7 functions and made 6 private, after these checks moved `scaleOf` from "delete" to "keep" and `Dash.Scale` from "privatize" to "delete". `StanceBar` went back to "privatize" after the untruncated grep showed its call.

## Related

- [Checklist after changing a shared prototype asset](shared-asset-change-checklist.md)
- [Prove a no-visual-change refactor by comparing the settled DOM](prove-no-visual-change-with-settled-dom.md)
