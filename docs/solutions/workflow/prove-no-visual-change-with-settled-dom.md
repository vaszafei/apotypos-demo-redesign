---
title: Prove a no-visual-change refactor by comparing the settled DOM, not screenshots
date: 2026-10-29
category: workflow
module: prototypes/assets
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - a cleanup or refactor of the prototype assets must not change how any page looks
  - comparing visual-check screenshots before and after a change
tags: [visual-check, screenshots, motion, playwright, verification, refactor]
---

# Prove a no-visual-change refactor by comparing the settled DOM, not screenshots

## Context

PR #96 deleted dead exports from `docs/redesign/prototypes/assets/` with the rule "no page may change". The plan was to hash-compare the visual-check screenshots before and after. That did not work as a proof:

- Two runs of unchanged `main` gave 77 of 336 different PNGs. `docs/redesign/prototypes/scripts/visual-check.mjs` takes each screenshot 500 ms after `networkidle` (lines 64-65), with motion on. `docs/redesign/prototypes/assets/motion.js` is still playing card entrances, a 900 ms count-up (line 106) and the `m-play` state for up to `delay + 2400` ms (line 63).
- A full run and an `--only <page>` run catch different stages of the animation, because the full run has 4 workers and a busier CPU. So `--only` reruns on the branch cannot be compared with a full-run baseline. Some pages differed "deterministically" between the two that way, and were identical when both sides used `--only`.
- The noisy pages are the ones a refactor touches most (`index`, `media-v2`, `outlet-v2`, `topic-v2`, `group-v2`).

## Guidance

Keep the visual check for what it finds: console errors, failed requests, 4xx and horizontal scroll. To prove that nothing renders differently, compare the settled DOM of every page on `main` and on the branch:

1. Make a worktree of `main` in the scratchpad: `git worktree add --detach <scratch>/main-wt origin/main`.
2. Serve each tree on its own port. Load every URL from the `PROTOTYPES` map in `docs/redesign/prototypes/assets/shell.js`, plus the detail pages the visual check adds. Use Playwright with `reducedMotion: 'reduce'`, which `motion.js` honors (line 8). Wait for `networkidle` plus a few seconds.
3. Save `document.body.innerHTML`, `scrollHeight` and console errors for each page and width (1440 and 390 are enough).
4. Before comparing, strip `?v=\d+` (the cache bump differs by design) and normalize the random bar-chart clip ids (`bc-<random>-`).
5. Compare. Identical HTML and height on every load is the proof. Report anything else as a real difference.

```js
// The core of the dump, per page (Playwright)
const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const body = (await page.evaluate(() => document.body.innerHTML)).replace(/\?v=\d+/g, '')
```

```python
# Normalizing before the comparison
norm = lambda s: re.sub(r'bc-[a-z0-9]+-', 'bc-X-', s)
```

When screenshots are compared anyway, take two baselines on `main` first. Treat the pages that differ between them as noisy. Compare like with like (full run against full run), and open any pair that differs.

## Why This Matters

A hash or pixel diff on these pages flags timing, not change. Faced with dozens of "differences", a reviewer either gives up on the proof or opens hundreds of pairs, and a real regression can hide among them. In PR #96 the DOM comparison settled the question in one pass: 84 of 84 loads identical once the clip ids were normalized.

## When to Apply

- Any cleanup PR in the structure audit (dead code, `protoNote`, the fill-height helper, CSS merges) where the rule is "the pages must not change".
- Not for a change that is meant to look different. There, look at the screenshots, as `shared-asset-change-checklist.md` says.

## Examples

PR #96 (dead exports). Visual check: no findings before or after. Screenshots: 79 differ from baseline 1, 16 of them outside the noisy set. Settled DOM: 84 of 84 identical. The full numbers are in `docs/prompts/2026-10-29-structure-audit-cleanup/report.md`.

## Related

- [Checklist after changing a shared prototype asset](shared-asset-change-checklist.md)
