---
title: Preload the default font, or a masthead that wraps in the fallback font makes the first load jump
date: 2026-11-13
category: design-patterns
module: web
problem_type: design_pattern
component: frontend
severity: medium
applies_when:
  - a prerendered page has a large line of text that fits on one line only in the real font
  - the page "appears, then moves" on first load
tags: [layout-shift, fonts, ssr, first-paint, check-load]
---

# Preload the default font, or a masthead that wraps in the fallback font makes the first load jump

## Context
Αρχική showed the prerendered hero, then jumped: layout shift 0.131 (Chrome's "poor" starts at 0.1), at about 220 ms unthrottled. `font-display: swap` shows the fallback font first, and nothing preloaded IBM Plex Sans. In the fallback the masthead "ΑΠΟΤΥΠΟΣ / ΠΑΡΑΤΗΡΗΤΗΡΙΟ ΕΛΛΗΝΙΚΩΝ ΜΜΕ" wrapped to two lines. When Plex arrived it fit on one, so `.home-hero-inner` shrank from 389 to 337 px (exactly one 52 px line) and the nav links changed width.

## Guidance
- Preload the default font in `app.head.link` (`nuxt.config.ts`): `rel=preload as=font type=font/woff2 crossorigin`. The shift went to 0.000 on `/`, `/media`, `/trends`, `/stories`, `/groups`, at normal speed and at 4x CPU slowdown.
- Find the cause with the layout-shift entry's `sources` (which node, old rect, new rect), not by eye. A height change equal to one line height is a wrapped line.
- Measure with `npm run check:load -- / /media` (after `npm run generate`). It fails over 0.05 and with `--out <dir>` saves a frame for every change. The unit tests and `check:pixel` cannot see this: they only look after the page settles.
- A visitor who picked another font (`data-font`) still downloads the Plex preload. The default is the common case; the cost is one small file.

## Not solved here
- After a click from Μέσα to Αρχική, the new page's first animated frame comes about 1 s later. In headless Chrome the compositor commit is about 314 ms, and with the three canvases hidden it is about 30 ms. Headless uses software rendering, so this is probably exaggerated; check on a real GPU in the Performance panel before changing PlegmaStage.
