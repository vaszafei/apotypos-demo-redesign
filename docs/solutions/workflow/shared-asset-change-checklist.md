---
title: Checklist after changing a shared prototype asset
date: 2026-10-29
category: workflow
module: prototypes/assets
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - editing components.js, dash.js, shell.js, messages.js, app.css, dash.css or tokens.css
tags: [cache-bust, verification, playwright, prototypes]
---

# Checklist after changing a shared prototype asset

## Context
The prototypes are 36 plain HTML pages that share `assets/*.js` and `assets/*.css` with no build step. Browsers and Netlify cache them, so a change can look unchanged, or break pages you did not open.

## Guidance
1. Bump `?v=` for the changed asset on **all** pages. Take the highest value on `main` plus 1: `grep -ho "components.js?v=[0-9]*" *.html | sort | uniq -c`. A page-only asset (for example `home.js`) is bumped on its page only.
2. Run `pnpm check:visual` in `web/` (or `node ../docs/redesign/prototypes/scripts/visual-check.mjs`). It loads every page at 1920, 1440, 1100 and 390 px in `paper` and `night`, reports console errors, failed requests, 4xx and horizontal scroll, and saves screenshots to `.visual-check/`. It takes about 3 minutes. Open the screenshots of the pages that use the changed asset. Use `--only <text>` for a few pages, `--themes all` for all five themes.
3. Verify at 1920, 1440, 1100 and 390 px, and with `?theme=night`: measure card boxes, no horizontal scroll, no console errors, and look at a screenshot at 1440 and 1920.
4. Say plainly which widths were only measured and which were looked at.
5. When a script edits `index.html` by slicing, anchor on unique text found after the start index. An earlier match once duplicated a chunk.

Tooling:
- Serve from `docs/redesign/prototypes` with `python3 -m http.server 8765`. Stop it with `kill $(lsof -ti:8765)`. `pkill -f` kills the shell.
- Playwright with `executablePath: '/usr/bin/google-chrome'`. Test scripts go in the session scratchpad.
- In `h()` a `style` object does not set CSS custom properties. Pass a string.
- Page-only message files load after `messages.js` and override with `Object.assign(window.MESSAGES.el|en, {...})`. Delete unused keys in both languages.

## Why This Matters
A stale or unbumped asset gives a preview that does not show the change. An unchecked shared change breaks pages nobody looked at.

## When to Apply
Every change to a file in `assets/` that more than one page loads.

## Related
- [Theme tokens only](../conventions/theme-tokens-only.md)
