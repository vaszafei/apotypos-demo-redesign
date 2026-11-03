---
title: Page checks must sign in, or the gated pages are not checked
date: 2026-11-03
category: workflow
module: prototypes/scripts
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - writing or running a script that loads every prototype page (visual check, box comparison, audit)
tags: [verification, playwright, sign-in, visual-check]
---

# Page checks must sign in, or the gated pages are not checked

## Context
The pages of the section Κόσμος (war, gaza, israel, un-israel, france and others) show "Απαιτείται σύνδεση" until `localStorage['proto-user']` holds one of the fixed accounts (`assets/shell.js`, `ACCOUNTS`). A script that sets only `proto-theme` loads these pages as a sign-in gate: no cards, no charts, no console errors.

## Guidance
- Every script that loads all pages sets `proto-user` to `lolovios` in its init script, next to `proto-theme`. `scripts/visual-check.mjs` does this since #2 part 3.
- A new count is a signal. After the fix the box comparison went from 952 to 1832 boxes on the same 41 pages: the extra boxes were the gated pages.
- Say which pages a "no findings" result covered. A result from the gate alone says nothing about the charts.

## Why This Matters
The "no findings" of the visual check and the "0 boxes differ" of PR #102 held for the gate on about 10 pages. Redoing them signed in found no layout change, but it also found a request (`cdn-cgi/rum`, the Cloudflare beacon in the standalone France reports) that no earlier run could see.

## When to Apply
When you write or edit a check, or read its result for the World pages.

## Related
- [Checklist after changing a shared prototype asset](shared-asset-change-checklist.md)
