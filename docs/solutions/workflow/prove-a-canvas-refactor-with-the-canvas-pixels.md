---
title: Prove a refactor of a canvas renderer with the canvas pixels and a tooltip sweep, against a baseline built from main
date: 2026-11-13
category: workflow
module: web/app/utils/plegma/stage
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - a large imperative canvas file (PlegmaStage.vue) is split and must draw exactly what it drew
  - the check cannot compare the settled DOM, because the output is pixels
tags: [canvas, refactor, verification, reduced-motion, tooltip, flaky-baseline]
---

# Prove a refactor of a canvas renderer with the canvas pixels and a tooltip sweep, against a baseline built from main

## Context

`PlegmaStage.vue` was 1650 lines: one canvas renderer with about 100 shared module-level `let`s. The split (PR on `claude/plegma-stage-split`) had to change no pixel. The DOM comparison of `prove-a-file-move-with-the-prerendered-html.md` does not see a canvas.

## Guidance

`npm run check:stage -- --out <dir> [--baseline <dir>] [--root <other build>]` (`web/scripts/stage-check.mjs`):

1. Reduced motion removes the clock from the drawing, so the pixels repeat. Read both canvases with `toDataURL` and compare with zero tolerance.
2. Make the baseline from a build of `main` in a worktree (`--root <worktree>/web/.output/public`), not from the branch before the last step. Symlink `node_modules` into the worktree.
3. Prove the harness first: two runs of the same build must give identical files. This found three flakes, each fixed in the harness:
   - settle needs three equal reads and at least 3 s, because the fixtures load lazily after `networkidle`;
   - a hover sweep needs two moves a pixel apart and one retry on "no tooltip";
   - a ring switch does not redraw under reduced motion (the stage does not watch `plegma.ring`), so the harness flips `prefers-reduced-motion` for 1.5 s and back to force a redraw.
4. Hover changes nothing on the canvas with reduced motion. Sweep the pointer over a 24 x 12 grid and keep the tooltip text at each point: that proves the pointer code (what is picked, in which order).
5. Check what the harness cannot: motion on (flights, the hero-frame copy, the dive) was only run as a smoke of console errors, not as pixels.

How the split was made safe: one commit per step, each checked (typecheck, harness against the main baseline, tests). Step 1 moved the mutable state into one object `st` by a scripted rename that skips strings and comments; the typechecker catches every name it missed. Steps 2 and 3 moved blocks into `createStageX(st, deps, core)` factories whose bodies are the old text.

## Why This Matters

A 1650-line file with shared mutable state cannot be reviewed by reading. The pixels and the tooltips can be compared in minutes.

## Two pre-existing bugs found on the way

- On a cold load of `/story?id=1` about 1 in 5 loads (6 of 30 on `main`) had gray ring arcs (the nodes were colored). The cause was not that the articles arrive late: the sector cache in `stage-articles.ts` was keyed by story id, length and ring, so when the groups fixture arrived after the articles and the list was replaced with the same length and new slots, the arcs kept the old slots. The cache now also keys on the list. A forced late `groups.json` gave 16 of 16 gray before and 16 of 16 colored after.
- Under reduced motion the ring switch did not redraw: `plegma.ring` was not in the stage's watch.

The harness no longer redraws by hand after a load or a ring switch; before the fixes this made 3 of 12 and 1 of 5 runs of the story scene differ, after them 20 of 20 are the same. A random headless sample of 200 loads never showed the gray, so look at the pixels (a forced late fixture) when a bug is a race.

## Related

- [Prove a file move with the prerendered HTML](prove-a-file-move-with-the-prerendered-html.md)
- [Prove a no-visual-change refactor by comparing the settled DOM](prove-no-visual-change-with-settled-dom.md)
