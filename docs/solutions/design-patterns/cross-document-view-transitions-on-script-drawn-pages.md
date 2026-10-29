---
title: Cross-document view transitions on pages drawn by body scripts
date: 2026-10-29
category: design-patterns
module: prototypes/assets
problem_type: design_pattern
component: frontend
severity: medium
applies_when:
  - adding or changing a page transition (@view-transition, pagereveal, pageswap)
  - a page draws its content from scripts at the end of the body
  - reacting in one script to state another script sets in pagereveal
tags: [view-transitions, pagereveal, render-blocking, motion, shell]
---

# Cross-document view transitions on pages drawn by body scripts

## Context
The prototype pages slide between Sections and Sub-tabs with cross-document view transitions (`@view-transition { navigation: auto; }` in `docs/redesign/prototypes/assets/app.css`). Each page is an empty HTML shell that `Shell.start` draws from a script at the end of the body. Five things went wrong while building it, and the final code does not explain them. Each came up only in some runs, on some pages, or in a scrolled state.

## Guidance

1. **Hold the first frame until the page is drawn.** Without a hold, Chrome sometimes painted the loading skeleton before the body scripts ran. `pagereveal` then fired before `Shell.start` registered its listener, so the transition showed the skeleton and had no direction. This happened in some runs and not others. `docs/redesign/prototypes/assets/page-move.js` is loaded in the `<head>` and adds a render-blocking `<link rel="expect">` to an id that does not exist, so the frame waits for the end of the parse (`docs/redesign/prototypes/assets/page-move.js:11-13`). It does this only when a move is pending, so a page opened directly still draws at once.

2. **Do not chain listeners of the same event with a microtask.** A first attempt had `motion.js` listen to `pagereveal` and queue a microtask to read `data-vt`. That microtask runs right after its own listener returns, before the next `pagereveal` listener (the shell's) has set `data-vt`. `motion.js` now watches the attribute instead: `new MutationObserver(() => { if (root.dataset.vt) glideTab() })` (`docs/redesign/prototypes/assets/motion.js:264`).

3. **A frozen group puts the old picture at the new box.** The page and sidebar groups use `animation: none` so they do not morph between boxes (Αρχική has no sidebar). The cost is that the old snapshot sits at the new element's position. A visitor scrolled 1400 px down saw the old content jump before it slid. The shell records the old `.page-main` top on `pageswap`. On `pagereveal` it sets `--vt-old-y` to old top minus new top (`docs/redesign/prototypes/assets/shell.js:627-649`). The CSS offsets the old picture with `translate: 0 var(--vt-old-y, 0px)` (`docs/redesign/prototypes/assets/app.css:839`).

4. **Guard pages with no route.** `methodology.html`, `pages.html` and `404.html` call `Shell.start` with no `route`. Mapping such a page to a place in the order threw inside `pagereveal`, before `skipTransition()`, so the browser's default morph played. `stepOf` now returns null for a missing route (`docs/redesign/prototypes/assets/shell.js:601`). This matches the guard in the shell's mount.

5. **Catch the rejection of a skipped transition.** `skipTransition()` rejects `viewTransition.ready`, which is an uncaught error on every move that does not slide. Add `e.viewTransition.ready.catch(() => {})` before the skip (`docs/redesign/prototypes/assets/shell.js:642`).

## Why This Matters
All five break silently. The page still works, but the move shows the skeleton, has no direction, jumps or morphs, or logs an error, and only in some runs or some states. Tests at the top of a page, on a page with a route, or in a single run all pass.

## When to Apply
Any change to `watchMoves` in `docs/redesign/prototypes/assets/shell.js`, the view-transition block in `docs/redesign/prototypes/assets/app.css`, `docs/redesign/prototypes/assets/page-move.js`, or a new page that loads `shell.js`. Test a move started while scrolled, Back and Forward to and from a page with no route, and at least three runs of each move.

## Examples
Find a mid-slide frame with CDP playback at 5–10% (`Animation.setPlaybackRate`). Take a screenshot shortly after the click, and compare where the old content is with a screenshot taken before the click.
