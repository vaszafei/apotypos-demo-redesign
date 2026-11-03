# Report: issue #2, PR 4 (U7–U10), the shared parts

Branch `claude/shared-parts`. Plan: `docs/plans/2026-11-03-1145-refactor-shared-cards-charts-parts-plan.md` (U7–U10). This work ran over two sessions; `handoff.md` in this folder is the handoff between them.

## What was built

- `assets/parts.js`, `assets/parts.css`, `assets/messages-parts.js` (el + en). Only `pages.html` loads them. No part is on a real page.
- A summary (`sum-`), B method and limits (`method-`), E headlines and quotes (`hlq-`, not `quote-`: politics.css has `.quote-list`), F filter chips and dataset switch (`fchip-`), C period control with a volume brush (`brush-`), D entity × entity heatmap (`hmx-`), the report frame (`frame-`, sample `reports/france-riots/compare.html`, back → `france-v2.html`).
- `pages.html` has a «Μέρη» section with every part and sample data.
- `scripts/check.mjs`: rule 5 (chart text ≥ 12px) now also covers `.hmx` and `.brush`.
- `scripts/parts-check.mjs` (new, `pnpm check:parts` in `web/`): the behavior checks of the parts, which were a scratchpad script before.

Commits: `3942021` (plan check), `a3469d0` (U7), `cd1120a` (U8), `84da385` (U9), `b731b96` (review fixes, Part C correction, parts-check).

## Part C corrected by the user

The plan said "preset chips + picker + brush, user-directed". The user corrected this on 2026-11-03: "i said the periods not to be on the chart but in date picker". The chip row is removed. The card now has the date picker (its popover holds the four presets) on the right, the daily columns and the summary line. The picker stays on the right because its popover is anchored to the right edge (`date-range.css`: `.dr-pop { right: 0 }`). On the left it opened off screen, and the first parts-check run caught that (a click timeout, "element is outside of the viewport"). The plan's U8 line is corrected. Issue #2 item C says "chips + from/to selects"; it is ticked with a note.

## Code review (ce-code-review, full depth, mode:agent)

Run dir (machine-local): `/tmp/compound-engineering-1000/ce-code-review/20261103-161052-0800801b/`, receipt `review.json`. 7 reviewers (correctness, adversarial in-process because no other-provider CLI is installed, project-standards, testing, maintainability, julik-frontend-races, learnings-researcher). 9 findings merged into 3 primary findings, and all 3 were confirmed by the validator, which reproduced them in Chrome. Verdict: "Ready with fixes", no P0/P1.

| # | Finding | Fix |
|---|---------|-----|
| 1 | The route table's type filter called `draw()`, which rebuilt every section: the frame reloaded (a 2nd HEAD) and the parts lost their state | `render()` builds the sections above the table once; `draw()` replaces only the filter bar and the table |
| 2 | The frame measured `documentElement.scrollHeight`, which never drops below the frame's own height, so it never shrank | It measures `documentElement.getBoundingClientRect().height` |
| 4 | Chips, the switch, presets and the picker dropped keyboard focus on redraw; the `aria-live` line was a new node each time | Focus goes back by button index (the `fingerprints-v2.html:206` pattern); a choice in the picker's popover gives the focus to the picker's button; the summary lines stay one node and only their text changes |

The reviewer's "view jumps ~840px" was only partly the frame. Measured on main and on the branch (1440 × 900, the filter bar scrolled to the top, then "Dashboard" clicked):

| | before: bar top / in document | after: bar top / in document |
|--|--|--|
| main `33f9491` | 0 / 5845 | 841 / 5845 |
| branch `b731b96` | 0 / 10564 | 841 / 10564 |

The table gets shorter, so the browser lowers the scroll position. This happens on main too. The bar keeps its place in the document. parts-check tests that place, not the place on screen.

Not fixed, listed by the review as residual risks:
- Hook classes with no rule (`hmx-masked`, `fchip-card`, `page-parts`, `frame-body`): parts-check uses `hmx-masked` and `fchip-card`.
- `.fchip` copies `.mme-chip`, incl. the **ink-fill pressed state**. `docs/solutions/conventions/layout-requests-are-literal.md` records "tinted accent fill + accent border" for the selected state. The plan (U7) read that lesson as being about tiles. Compared as text after renaming the classes, `.fchip`/`.fchip-row`/`.fchip-n` are the same six rules as `.mme-chip`/`.mme-chips`/`.mme-chip-n` in `mme.css`; only the order differs. Measured `.fchip`: 14px/400, height 30, padding 12px, radius 999px; pressed paper bg rgb(17,17,17) text white, night bg rgb(238,236,230) text rgb(16,19,25). `.mme-chip` was not measured in a browser: it did not render on the default view of `topics-v2.html` (`Mme.ChipsCard`).
- `UI.BarChart` redraws on resize during a drag and ends the drag (unchanged `components.js`).
- `assets/motion.js:159` still names `.kpi-strip` and `.card-col`, which PR #102 removed. Dead selector, left as is.

## Checks (real runs on `b731b96` unless noted)

From `web/`:

- `node ../docs/redesign/prototypes/scripts/check.mjs` → "All checks pass." Tamper (session 1): appending `.hmx td { font-size: 11px; }` → exit 1, "FAIL assets/parts.css: .hmx td has font-size 11px, below 12px"; restored → exit 0.
- `node ../docs/redesign/prototypes/scripts/parts-check.mjs` → "All parts checks pass." 43 tests, 0 failed: A empty state; E expand/collapse, `rel=noopener` + `_blank` ×3; F aria-pressed, switch by keyboard, focus kept on the switch and on a chip, same summary node; B opens; C drag 3→9 = 2026-08-03..09 with 1 event, backwards drag 08-13..08-21, no chips on the card, a picker preset (Σεπτέμβριος) mutes 31 columns, picker days 09-05..09-07 mute 58 (4 events), focus on `.dr-trigger` after each apply, same summary node; D 96 cells, 23 masked «—» with no label, 73 with tooltip, scrolls inside the card at 390 (paper, night) with page scroll 0; Frame loads, height 3206 vs document 3205, 700 px wide → 4127, back to 1440 → 3206; open-alone link, back link + label, missing document → error state, retry → second HEAD; table filter: same iframe node, 0 new HEAD, bar 10564 → 10564 in the document, chip state kept; English: no raw keys, heading "Parts"; no console errors or 4xx at paper/night × 1440/390 apart from the beacon.
- **parts-check catches the bugs:** the same script on a copy of `84da385` (`git archive`, before the fixes): "9 failed", namely the switch focus (BODY), the summary node ×2, the chip focus ×2, the picker focus, the frame shrink (`g3` 4125 vs document 3205), the table filter rebuild (`sameFrame:false`, 1 HEAD) and the lost chip state («Όλα»). This copy still had the chips on the card, so it ran the chip tests before the chip row was removed.
- Box comparison (KTD7; signed in; `.dcard` and `.dstat` boxes; main baseline from a worktree at `33f9491`; 1920, 1440, 1100, 390 × paper, night): main 336 loads / 2128 boxes / 0 page errors; branch 336 loads / 2200 boxes / 0 page errors; "336 loads compared, 1832 boxes, 8 loads differ, 0 boxes differ". The 8 are `pages.html` × 4 widths × 2 themes, the new section: page height 9209 → 13928 (1920, 1440), 9662 → 14480 (1100), 13750 → 22822 (390); boxes 37 → 46. The comparison was tested on a tampered copy first (session 1): `.dcard { border-width: 2px }` → "2 loads differ, 9 boxes differ".
- `node ../docs/redesign/prototypes/scripts/visual-check.mjs --themes paper,night` → 336 loads in 214 s, 40 findings in 5 problems, all known:
  - `france-v2.html` and `pages.html`: `HTTP 404 cdn-cgi/rum?` and its console line. This is the Cloudflare beacon of the report document, which the local server does not have. It was on france-v2 before this branch; pages.html gets it through the frame.
  - `pages.html: request failed: reports/france-riots/compare.html`. This is the frame's `HEAD` request. Chrome under Playwright reports every HEAD `fetch` as `net::ERR_ABORTED`, with or without `content-length`, even on an empty page with no iframe (scratchpad `headfail.mjs`). The fetch still resolves with `ok`, and the iframe loads (`requestfinished GET document`). Not a defect.

## Looked at vs measured only

- **Looked at** (screenshots): session 1, the parts section at 1440 paper + night and 390 paper + night; the brush at 1440 paper and 390 night; the heatmap at 1440 night; the frame at 1440 paper and 390 night (bar). This session, after the fixes: the filter card at 1440 paper and 390 night; the brush card without chips, closed and with the picker open, at 1440 paper and 390 night.
- **Measured only:** 1920 and 1100 (the box comparison), all other pages (the box comparison and the visual check), and the fog, terra and midnight themes (not run).

## Issue #2

Every acceptance box and every audit box (A–F, report frame) is ticked, with the evidence above and in PRs #100–#103. Item C carries the note about the date picker.
