---
title: Read layout requests literally and never rearrange cards unasked
date: 2026-10-29
category: conventions
module: prototypes/layout
problem_type: convention
component: frontend
severity: high
applies_when:
  - a request changes one card, column, tab or control on a prototype page
  - a change leaves blank space or uneven heights
tags: [layout, cards, requests, ux-preferences]
---

# Read layout requests literally and never rearrange cards unasked

## Context
The layout pass works from a deploy-preview screenshot and a short request. Twice, a helpful rearrangement was rejected: moving «Γρήγορη πρόσβαση» beside the calendar to avoid a gap, and importing cards into Επισκόπηση to balance heights.

## Guidance
- Change only the named card or property. "Minimize" the search means a smaller height (36 to 30 px), not an icon, not a new position.
- Never move a card between tabs or columns unasked. If the request leaves blank space, report the blank and its size, and offer 2 or 3 options.
- Never stretch cards or match column heights. A card ends where its content ends and starts right under the previous card of its column (two independent columns, not shared grid rows).
- A loose measure ("decrease the width by one flex") is read in grid columns (c-N of 12). Say how it was read and offer the alternative.
- Card titles are generic («Δηλώσεις ανά μήνα»), not findings. Keep the finding as the first sentence of the info tooltip. Do it on the page named; ask before a site-wide sweep.
- Show all the data and scroll inside the card instead of a fixed top-N.
- Selected state is a tinted accent fill with an accent border, number stays dark. Use ▲ (teal) and ▼ (orange) for changes, not +/−.
- Add no decoration unasked: no info icon on shortcut cards, no hover hint, no duplicate counts.
- Quick-action buttons are small: 2×2, fixed ~88 px, name, one short line, arrow. A page with nothing to say gets no subtitle.
- Charts must read without a key. Compare with a second thin gray bar and a legend, not with ticks alone.

## Why This Matters
A misread costs a full round trip, and the rejected rearrangements changed pages the user had already approved.

## When to Apply
Every layout request on the prototypes, and any Nuxt port that must match them.

## Examples
Request: "shorten this card, not the story card". Do exactly that. Do not match the heights, and report the gap.
