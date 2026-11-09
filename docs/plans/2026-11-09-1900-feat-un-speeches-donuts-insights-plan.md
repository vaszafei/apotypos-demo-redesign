---
title: Αναλύσεις › ΟΗΕ — donuts, region insights, one set of numbers - Plan
type: feat
date: 2026-11-09
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Αναλύσεις › ΟΗΕ — donuts, region insights, one set of numbers - Plan

Repo: vaszafei/apotypos-demo-redesign. All paths are under `docs/redesign/prototypes/` unless they start with `docs/` or `web/`. Branch: `claude/un-speeches-donuts`. One PR.

## Goal Capsule

- **Objective:** The two ΟΗΕ pages (Όλες οι ομιλίες, Παλαιστίνη–Ισραήλ) answer "what did the leaders talk about, and who said what" with a few readable charts that carry an insight, and every number on them adds up to the same whole.
- **Means:** one shared donut (`Dash.Donut`), the existing sequential heatmap scale (`Dash.seq`) and the existing `Dash.card` / `UI.BarList` parts. No new page, no moved tab.
- **Authority:** the user's messages of 2026-11-09, then this plan, then `docs/solutions/`.
- **Stop conditions:** stop and ask if a number cannot be made to add up without changing what a card means, or if a donut needs a color already used for another meaning on the same page.
- **Who finishes:** the user looks at the deploy preview and says "lets merge".

---

## Product Contract

### Summary

Turn the agenda bars into a donut that includes Domestic affairs, add a donut of speaking hours by continent, turn the regions bars of Παλαιστίνη–Ισραήλ into a donut, add a region × topic heatmap that shows what each continent talks about, and compute every minute and rank from one source so the page agrees with itself.

### Problem Frame

Measured on 2026-11-09 at 1920, 1440, 1100 and 390 px (2.7 / 3.0 / 3.7 / 5.3 screens on Όλες οι ομιλίες; 2.7 / 2.9 / 3.7 / 5.0 on Παλαιστίνη–Ισραήλ; no horizontal scroll, no console errors):

- «Η συνολική ατζέντα» hides the largest topic, Domestic affairs (about 26% of the time), so the bars do not show a whole. It leaves 170 px blank under it at 1440.
- The numbers have two sources. `agenda` in `data/speeches.js` has 20 topics and says Israel–Palestine is 201 min from 77 leaders. The 192 rows carry only the 2 to 6 main topics of each speech (3172 of 3526 min), and give 184 min from 62 speeches. The rank is 4th by `agenda` and 3rd by the rows (184 against 180 for International Law). Παλαιστίνη–Ισραήλ shows both: the stat card says 201 and 77, the table and the note say 62.
- The data holds insights no card shows: Europe gives 13% of its time to Russia–Ukraine, the Middle East 22% to Israel–Palestine and Latin America 0.4%; the Middle East makes 15.5 attacks per hour of speech, Asia-Pacific 1.5; 107 of 192 speeches have no attack and the top 10 speakers make 41% of them.

### Requirements

**Charts**

- R1. «Η συνολική ατζέντα» is a donut of the minutes by topic. Domestic affairs is inside it. The whole is all the speaking time of the picked region (58.8 h for all). The 9 largest topics get a slice, the rest of the topics and the minutes with no main topic form one gray slice. Colors of the 8 largest topics are the ones of the «αποτύπωμα» bars of the table; Domestic affairs is the dark gray of the table. The legend beside it lists topic, minutes and share.
- R2. A new card «Ώρες λόγου ανά ήπειρο» is a donut of hours by region of all 192 speeches, with the speech count in the legend.
- R3. On Παλαιστίνη–Ισραήλ the card «Από ποιες περιοχές» is a donut of the minutes on the topic by region, with minutes, leaders and share in the legend.
- R4. A donut shows the exact figure on hover and keyboard focus (center text and a dimmed rest), as the Home donut does. It has a text alternative. A slice does not filter the page: the region pills stay the only region control.
- R5. A new card «Τι απασχολεί κάθε ήπειρο» is a heatmap: rows are regions (largest first), columns are the 9 largest topics, a cell is the share of the region's time, the color is how far it is above the average of all regions. A region with fewer than 5 speeches is shown as text, not colored, and says how many speeches it has.

**Numbers**

- R6. Every minute, speech count, leader count and rank on both pages is computed from the 192 rows. The page says in its info text that topics are the main topics of each speech. Totals add up: donut slices sum to the center, the stat card equals its donut, the stat card of Παλαιστίνη–Ισραήλ equals its table and its note.
- R7. «Θέση στην ατζέντα» is computed from the same rows (so it changes from 4th to 3rd).

**Care**

- R8. Region pills still filter Όλες οι ομιλίες. With a region picked, the agenda donut redraws for that region; the continent donut and the heatmap stay on all regions and mark the picked one. (Redraw per period, not dimming: see memory note on charts.)
- R9. Cards that are not named stay as they are: the 2×2 stats, «Ποιος δέχτηκε τις επιθέσεις», «Ποιοι μίλησαν για Ελλάδα», the table, and on Παλαιστίνη–Ισραήλ the leaders card, the attacks card, the stats and the table. No translation work (the user said so). Blank space the new layout leaves is measured and reported, not hidden.
- R10. Nothing is added or changed on Home or on any other tab.

### Key Decisions

- **Donut: yes, for part-to-whole with at most 10 parts.** (session-settled: user-approved — "tabs can produce a donut chart maybe"; answer "yes and maybe one with the time by continent".) Governs R1, R2, R3.
- **Domestic affairs is inside the agenda donut.** (session-settled: user-approved — "why not".) Governs R1.
- **The user asked me to discover charts and cards with insights.** (session-settled: user-directed — "i want you look the data… search and discover powerful charts cards and diagrams, readable minimal with insights".) The heatmap (R5) is my proposal under that mandate and is shown with a screenshot; it needs approval of this plan. Governs R5.
- **Make the numbers correct.** (session-settled: user-directed — "make the numbers correct".) I read it as one source and honest totals (R6, R7), not as removing a card. Governs R6, R7, R9.
- **No translation now.** (session-settled: user-directed — "dont mind about translation".) Governs R9.

### Success Criteria

- Donut slice values sum to the centre number on every donut, for all regions and for each of the 6 regions.
- On Παλαιστίνη–Ισραήλ the stat card, the regions donut, the leaders card and the table report the same minutes and speech count.
- The new cards are readable at 1920, 1440, 1100 and 390 px with no horizontal scroll and no console errors.

### Scope Boundaries

Non-goals (considered, not built):

- A slice that filters the page. The pills already do (no duplicate controls).
- Sankey or flow diagrams (the media Sankey was tried and removed).
- A chart by day of the debate (22–28 September; 20 to 42 speeches a day). The data shows small moves (Russia–Ukraine 8% on day 2, AI and Climate 7% on day 4); not asked and weak.
- Moving Home onto the shared donut.
- Translating English countries, roles and topic names.

#### Deferred to Follow-Up Work

- Home (`assets/home.js`, `.home-donut` rules in `assets/home.css`) adopts `Dash.Donut` in its own PR, with a settled-DOM proof.
- The leaders card of Παλαιστίνη–Ισραήλ repeats the first 15 rows of its table. Kept now because the user asked only for correct numbers.
- A card «Επιθέσεις ανά ώρα λόγου» (Middle East 15.5, Europe 10.0, Latin America 5.7, Africa 2.5, Asia-Pacific 1.5, with the main target of each). Mock exists; not in this plan unless approved (see Open Questions).

---

## Planning Contract

### Key Technical Decisions

- KTD1. **One new shared part, `Dash.Donut`, in `assets/dash.js`, styled in `assets/dash.css`.** `parts` in, a node out: `{ parts: [{ label, value, color, tip }], center: { num, cap }, size }`. The arc maths and the hover focus come from the Home donut (`assets/home.js` lines 231–292), which is page-only today; a second copy in each page would be a third. `.donut-wrap` and `.donut-num` already exist in `assets/dash.css`. Legend rows are built by the caller with `UI.BarList`-style rows (name, value). Home is not changed now (R10).
- KTD2. **One source for the numbers: a small pure function `Politics.topicMinutes(rows)` in `assets/politics.js`.** It returns, for the rows given, minutes per topic, leaders with at least 1 min, the untagged minutes, and the total seconds. `agenda` in the data file is no longer read by either page. This fixes R6 and R7 in one place, and the region filter already worked this way. Effect to tell the user: Israel–Palestine 201 → 184 min, UN reform 704 → 698, Domestic 846 → 833, rank 4th → 3rd.
- KTD3. **A color means one thing on a page.** On Όλες οι ομιλίες the 8 slot colors already mean topics (agenda donut and the table bars). The continent donut therefore uses one-hue tints (the `--seq-*` ramp, largest region darkest), not slots. Παλαιστίνη–Ισραήλ uses the same ramp for regions. Direct names in the legend carry the identity.
- KTD4. **The heatmap is `UI.MatrixChart` with `Dash.seq`**, the way `Parts.Heatmap` (`assets/parts.js`) builds it, but `parts.js` loads on `pages.html` only, so the page builds the matrix itself with the same two calls, not the part. Color = share of the region's time divided by the share of all regions, clipped; the text in the cell is the share. A row under 5 speeches is unfilled with «2 ομιλίες» (North America has 2).
- KTD5. **The region filter acts on the agenda donut only** (R8). The two region cards need all regions to mean anything.
- KTD6. **Layout, no card moved that the user did not name.** Όλες οι ομιλίες: the left column (c-7, a `card-col`) holds the agenda donut and under it the continent donut; the right column (c-5) is unchanged; the heatmap is a full-width card between the two blocks and the table. Παλαιστίνη–Ισραήλ: the regions card keeps its place and becomes a donut. Expected blank: measured in U5 and reported.
- KTD7. **Text keys** go in `assets/messages-politics.js` (el and en, no unused keys). Delete the keys and CSS the change orphans (`un.agenda.top`, `un.agenda.value`, `unpi.regions.value`, as found by `grep -F`).

### Layout sketch (1440 px; not to scale)

```
Όλες οι ομιλίες                         [pills: Όλες · Αφρική · Ευρώπη · …]
┌─ Η συνολική ατζέντα (donut + list) ─┐ ┌─ 2×2 stats ─────────┐
│  ◯ 58,8 ώρες    ■ Εσωτερικά   29%   │ ├─ Επιθέσεις: στόχοι ─┤
│                 ■ ΟΗΕ…        24%   │ ├─ Ελλάδα ────────────┤
├─ Ώρες λόγου ανά ήπειρο (donut) ─────┤ │                     │
└─────────────────────────────────────┘ └─────────────────────┘
┌─ Τι απασχολεί κάθε ήπειρο (heatmap, full width) ────────────┐
┌─ Όλες οι ομιλίες (table, unchanged) ────────────────────────┐

Παλαιστίνη–Ισραήλ: leaders card │ stats, [Περιοχές = donut], attacks │ table
```

### Verification Contract

- `scripts/un-check.mjs` (new, run with `node`, in the style of `scripts/fixtures-check.mjs`): loads `data/speeches.js` in `vm`, calls the same function the page uses (`Politics.topicMinutes`), asserts for all regions and for each region: slice sum = total, Israel–Palestine minutes and speeches equal the rows' own sum, rank equals the sorted position, and prints the numbers.
- `pnpm check` (or `node scripts/check.mjs`) exits 0 (color tokens only, labels of 12 px or more).
- `node scripts/visual-check.mjs` has no findings; screenshots of both pages at 1920, 1440, 1100 and 390 in `paper` and `night` were looked at.
- Card boxes of the unnamed cards are compared with the baseline taken on `main` before the change (same method as the layout comparison of issue #2): 0 differing boxes for the right column of Όλες οι ομιλίες, and for the stats, attacks card, leaders card and table of Παλαιστίνη–Ισραήλ, except where the new neighbour changes the column height.
- The report says what was measured and what was looked at, and that the English text, Safari and the phone drawer were not checked.

---

## Implementation Units

### U1. Session files and baseline

- **Goal:** the prompt is saved and the "before" boxes exist.
- **Requirements:** R9, R10.
- **Dependencies:** none.
- **Files:** `docs/prompts/2026-11-09-world-un/prompt.md` (the user's prompt, saved first), `docs/plans/2026-11-09-1900-feat-un-speeches-donuts-insights-plan.md` (this file).
- **Approach:** `git checkout -b claude/un-speeches-donuts` from an up to date `main`. Record the box of every `.dcard` of both pages at four widths in `paper` (scratchpad JSON).
- **Test scenarios:** Test expectation: none — setup.
- **Verification:** the baseline JSON has 8 entries (2 pages × 4 widths).

### U2. One source for the numbers

- **Goal:** `Politics.topicMinutes(rows)` exists and the check proves the totals.
- **Requirements:** R6, R7.
- **Dependencies:** U1.
- **Files:** `assets/politics.js`, `scripts/un-check.mjs` (create), `web/package.json` (script `check:un`).
- **Approach:** lift the per-region loop that `speeches-v2.html` already has into one function; return `{ total, tagged, topics: [{ topic, minutes, leaders, top }] }`. The page keeps the order of `agenda` only by sorting on minutes.
- **Patterns to follow:** `assets/politics.js` (`dataName`); `scripts/fixtures-check.mjs` for the vm loading.
- **Test scenarios:**
  - All regions: total 3526 min; tagged 3172; sum of topic minutes plus untagged equals the total.
  - Each of the 6 regions: the same sum rule.
  - Israel–Palestine: 184 min, 62 speeches, rank 3.
  - An empty row list returns zero totals and no NaN.
- **Verification:** `node scripts/un-check.mjs` exits 0 and prints the numbers.

### U3. The donut part

- **Goal:** `Dash.Donut` draws a donut with legend-linked hover and a text alternative.
- **Requirements:** R4.
- **Dependencies:** U1.
- **Files:** `assets/dash.js` (`Donut`, exported in `window.Dash`), `assets/dash.css` (`.donut-*` rules for focus, dim, legend row, small screens), `pages.html` (one example, in the «Διαγράμματα» section if present).
- **Approach:** take the arc and focus code of `home.js` (KTD1); the center shows the whole, on focus the share and the name; slices are `tabindex=0`; `prefers-reduced-motion` follows the existing `m-pop` rule. Check class names against shared CSS first (`docs/solutions/workflow/check-class-names-against-shared-css.md`); `.slice` rules exist for `.home-donut` only.
- **Test scenarios:**
  - 10 parts: arcs have gaps and the last arc ends at the first.
  - One part with 100%: a full ring, not an empty path.
  - A part of 0: no arc, still a legend row.
  - Hover and focus set `.is-dim` on the others and restore on leave.
  - At 390 px the donut sits above the legend.
- **Verification:** `pnpm check`; screenshot of the example at 1440 and 390 in `paper` and `night`.

### U4. Όλες οι ομιλίες

- **Goal:** the agenda donut, the continent donut and the heatmap, with the pills still working.
- **Requirements:** R1, R2, R5, R8, R9.
- **Dependencies:** U2, U3.
- **Files:** `speeches-v2.html`, `assets/messages-politics.js`, `assets/politics.css`.
- **Approach:** replace `agendaCard` with the donut card; add the continent donut under it in the same `card-col`; add the heatmap card before the table; the pills pass the picked region to the agenda card only (KTD5). The `colorOf` map of the table stays the single source of topic colors and the donut reads it.
- **Test scenarios:**
  - All regions: agenda slices sum to 58,8 h; Domestic affairs is the first slice and has the table's dark gray.
  - Pick «Μέση Ανατολή»: the agenda redraws on 6,5 h; the continent donut still shows 6 slices with the picked one marked; the heatmap row is marked.
  - North America (2 speeches): the heatmap row shows «2 ομιλίες» and no color; no NaN anywhere.
  - Hover a legend row: the matching slice stays, others dim, center shows the share.
  - Heatmap at 390 px scrolls inside its card; the page has no horizontal scroll.
- **Verification:** `node scripts/un-check.mjs`; visual check on `speeches-v2`; screenshots at 1920 and 1440 looked at; blank space under each column measured.

### U5. Παλαιστίνη–Ισραήλ

- **Goal:** the regions donut, and one set of numbers.
- **Requirements:** R3, R6, R7, R9.
- **Dependencies:** U2, U3.
- **Files:** `un-israel-v2.html`, `assets/messages-politics.js`.
- **Approach:** stat cards read the rows (184 min, 62 speeches, rank 3rd); «Από ποιες περιοχές» becomes the donut with the legend `minutes · leaders · share`; the info text of the stat and the note say what "topic" means. Nothing else moves.
- **Test scenarios:**
  - Stat card minutes = donut center = sum of the leaders card over all 62 speeches.
  - Rank text says 3ο.
  - A region with no speeches on the topic is not a slice.
  - 1100 and 390 px: no overflow.
- **Verification:** `node scripts/un-check.mjs`; visual check; screenshots at 1920 and 1440; boxes of unnamed cards compared with the baseline.

### U6. Shared asset checklist and close-out

- **Goal:** the cache numbers and the checks are done.
- **Requirements:** R9, R10.
- **Dependencies:** U4, U5.
- **Files:** every `*.html` (`?v=` of `dash.js` and `dash.css`; `politics.js`, `politics.css`, `messages-politics.js` on the pages that load them), `docs/prompts/2026-11-09-world-un/report.md`.
- **Approach:** follow `docs/solutions/workflow/shared-asset-change-checklist.md`; run `visual-check.mjs`; delete orphaned keys and rules (KTD7); write `report.md` with the real commands and numbers.
- **Test scenarios:** Test expectation: none — checklist.
- **Verification:** the report lists measured widths, looked-at screenshots and the not-checked list (English text, Safari, phone drawer).

---

## Open Questions

For the user, at approval (each has my default):

1. **Source of the numbers.** Default: the 192 rows everywhere (KTD2), which changes 201 → 184 and 4th → 3rd. Alternative: keep `agenda` (more complete per topic, no region split) and show «184 από τα 201 λεπτά έχουν περιοχή» under the regions donut.
2. **Heatmap «Τι απασχολεί κάθε ήπειρο».** Default: in. Cut it if you find it too much for this page.
3. **«Επιθέσεις ανά ώρα λόγου».** Default: out (Deferred). Say if you want it as a card; there is a mock.
4. **Continent donut colors.** Default: one-hue tints (KTD3) so blue does not mean both «ΟΗΕ και μεταρρύθμιση» and «Αφρική». Alternative: the slot colors, accepting the clash.
5. **Layout.** Default: continent donut under the agenda donut, heatmap full width above the table (KTD6). Alternative: continent donut next to the heatmap.
