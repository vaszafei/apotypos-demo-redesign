---
title: Remove dead exports from the prototype assets - Plan
type: refactor
date: 2026-10-29
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Remove dead exports from the prototype assets - Plan

## Goal Capsule

- **Objective:** The shared prototype scripts expose only what the pages use, so the Nuxt component map is drawn from live code, and every page looks and behaves exactly as it does on `main` today.
- **Means:** One PR on `claude/remove-dead-exports` that deletes the never-called functions, removes self-only names from the `window.*` namespaces, and drops the message keys and CSS rules only the deleted functions used (KTD1–KTD3).
- **Authority:** This plan, then `docs/solutions/workflow/shared-asset-change-checklist.md`, then `docs/prompts/2026-10-29-structure-audit-cleanup/handoff.md`. Grep evidence beats the handoff's static-analysis list (KTD1).
- **Stop conditions:** Stop and report if a grep finds a use of a name marked for deletion, or if the after-run of the visual check has a finding, or if a screenshot outside the noisy set (KTD4) differs from its baseline.
- **Execution profile:** Plain JS/CSS edits with no build step. Proof is the visual check plus a screenshot comparison, not unit tests.
- **Finish and ship:** The executor opens the PR. The user merges after "lets merge".

---

## Product Contract

### Summary

Remove 8 dead functions, make 5 self-only helpers private, and delete the message keys and CSS rules that only those functions used. No page may change.

### Problem Frame

The structure audit found exports that no page calls. They make the shared assets look bigger than they are, and the Nuxt component map would carry them over as components nobody needs. The cleanup comes before the map, with the visual check as the safety net.

The handoff's list came from a regex script that misses destructured uses (`const { DiffRow, scaleOf } = Entity`) and does not tell "used only inside the file" apart from "not used at all". The greps for this plan corrected both (KTD1).

### Requirements

**Deletion**
- R1. Delete the 8 functions no page or asset calls: `Dash.newsStories`, `Dash.Scale`, `Politics.divergeCell`, `Mme.HighlightsCard`, `Mme.OutletStats`, `Mme.topIssues`, `Mme.StanceBar`, `Home.SectionHead`.
- R2. Delete the message keys (both `el` and `en`) and CSS rules that only the R1 functions used.

**Privatization**
- R3. Remove from their `window.*` namespace the 5 helpers used only inside their own file: `Entity.Sunburst`, `Shell.itemOf`, `Mme.sumPairs`, `Mme.shareOf`, `Mme.critShare`. The functions stay.

**Safety**
- R4. `Entity.scaleOf` stays exported (KTD1).
- R5. Every page renders and behaves as on `main`: no visual-check findings, no screenshot differences caused by the change.

### Key Decisions

- **Delete the dead exports and make the self-only ones private, in one PR.** (session-settled: user-approved — chosen over delete-only and keeping all: one dead-code PR before the protoNote PR.) Governs R1, R3.

### Scope Boundaries

- Not in scope: `protoNote`, the fill-height helper, duplicate CSS selectors, the component map. Each gets its own PR, in the order the handoff states.
- `Entity.scaleOf` is not touched.

#### Deferred to Follow-Up Work

- `groups-v2.html` defines its own `Sunburst`, a copy of the one in `assets/entity-cards.js`. Whether they can merge is a separate change with a visible risk.
- `docs/prompts/2026-10-29-structure-audit-cleanup/export-usage.py` misses destructured uses. Fix it, or record its limit, with `/ce-compound` after this PR.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Grep evidence overrides the handoff list.** Three corrections:
  - `Entity.scaleOf` is used by `group-v2.html`, `topic-v2.html` and `outlet-v2.html` through destructuring, so deleting it would break three pages. It stays (R4). This changes the settled "delete 7" to delete 6 of those 7.
  - `Dash.Scale` and `Mme.StanceBar` have no call anywhere, not even in their own file. They move from "make private" to "delete".
  - The privatize list therefore has 5 names.
- KTD2. **Orphans of the deleted functions go in the same PR.** This covers message keys `mme.hl.*` (5 keys), `mme.o.title`, `mme.o.info` and `media2.scale.aria`, and CSS classes `.mme-hl`, `.mme-hl-list`, `.mme-ostats`, `.mme-ostat`, `.mme-ostat-value`, `.scale`, `.scale-line`, `.scale-avg`, `.scale-dot`, `.scale-cell`, `.scale-num`, `.home-section-head`, `.home-section-title` and `.home-section-lead`. The shared-asset checklist already requires deleting unused keys in both languages. A CSS rule whose class nothing creates cannot change a page, and leaving it would show up again as noise in the CSS PR. `.scale-legend` and `.scale-steps` are different classes and stay.
- KTD3. **Cache-bust every changed asset on every page that loads it**, at the highest value on `main` plus 1. The values were measured on `4ad57da`:

| Asset | Now | New | Pages |
|---|---|---|---|
| `assets/dash.js` | 16 | 17 | 26 |
| `assets/politics.js` | 10 | 11 | 14 |
| `assets/mme.js` | 20 | 21 | 5 |
| `assets/home.js` | 32 | 33 | 1 |
| `assets/shell.js` | 50 | 51 | 29 |
| `assets/entity-cards.js` | 7 | 8 | 4 |
| `assets/messages-mme.js` | 20 | 21 | 5 |
| `assets/messages-v2.js` | 46 | 47 | 26 |
| `assets/dash.css` | 81 | 82 | 26 |
| `assets/mme.css` | 33 | 34 | 5 |
| `assets/home.css` | 40 | 41 | 1 |

- KTD4. **Proof is a screenshot comparison, not just "no findings".** Before changing anything, run the visual check on `main` twice and save both runs. The pages whose PNGs differ between the two `main` runs are the noisy set. `visual-check.mjs` captures 500 ms after network idle with motion on, while `motion.js` count-ups and chart entrances can still be running. After the change, compare every PNG with the first baseline by hash. A difference outside the noisy set is a regression until it is explained. For a noisy page, open the pair and compare it with that page's main-versus-main difference.

---

## Implementation Units

### U1. Delete the dead functions

- **Goal:** The 8 functions in R1 and their namespace entries are gone.
- **Requirements:** R1, R4. Follows KTD1.
- **Dependencies:** none.
- **Files:** `docs/redesign/prototypes/assets/dash.js`, `assets/politics.js`, `assets/mme.js`, `assets/home.js` (all under `docs/redesign/prototypes/`).
- **Approach:**
  1. Before each deletion, grep the plain name across `*.html`, `assets/*.js` and `data/` to confirm only the definition and the export line match. For `Scale`, comments also match (`dash.js` above the function, `groups-v2.html` "Scale the band"). Apply the exception in the Dead names gate.
  2. Delete the function with its leading comment, and its entry in the `window.*` object.
  3. After the deletion, check that no helper in the same file was left without a caller. The known cases are already handled: `stanceSegments`, `rankOf` and `outletFacts` keep callers.
- **Patterns to follow:** the export object at the end of each IIFE.
- **Test scenarios:**
  - Load `media-v2.html` and `outlet-v2.html`. No console error, and the Mme cards render.
  - Load `index.html`. The home sections render with their titles.
  - Load a page that uses `Politics` (for example `elections-v2.html`) and one that uses `Dash`. No `ReferenceError`.
- **Verification:** the Dead names and Kept names gates pass for the R1 names.

### U2. Make the self-only helpers private

- **Goal:** The 5 helpers in R3 are no longer reachable from `window`.
- **Requirements:** R3.
- **Dependencies:** U1, because both units edit the same `mme.js` export line.
- **Files:** `docs/redesign/prototypes/assets/entity-cards.js`, `assets/shell.js`, `assets/mme.js`.
- **Approach:** remove each name from its `window.*` object only. The function bodies and their in-file calls stay unchanged.
- **Test scenarios:**
  - `groups-v2.html` still draws its sunburst, and the group pages still draw the Entity one.
  - Navigation and the header in `shell.js` still mark the current page on any v2 page.
- **Verification:** none of the 5 names appears after `Entity.`, `Shell.` or `Mme.` anywhere, or in a destructuring of those namespaces.

### U3. Delete the orphaned message keys and CSS rules

- **Goal:** The keys and rules in KTD2 are gone, and nothing that is still in use was removed.
- **Requirements:** R2.
- **Dependencies:** U1.
- **Files:** `docs/redesign/prototypes/assets/messages-mme.js`, `assets/messages-v2.js`, `assets/mme.css`, `assets/dash.css`, `assets/home.css`.
- **Approach:**
  1. Delete each key in both the `el` and `en` blocks.
  2. Delete each CSS rule, including the copies inside `@media` blocks. Remove a media block only when it becomes empty.
  3. Before deleting `.scale`, confirm that no HTML or JS sets `class` to `scale` (the word also appears in transforms and comments).
- **Test scenarios:**
  - Switch `media-v2.html` to `en`. No key is printed raw.
  - At 390 px, `index.html` and `media-v2.html` match their baseline screenshots.
- **Verification:** the Dead names gate passes for every KTD2 key and class.

### U4. Cache-bust and verify

- **Goal:** The browser loads the new files, and the proof in R5 exists.
- **Requirements:** R5.
- **Dependencies:** U1, U2, U3.
- **Files:** every `docs/redesign/prototypes/*.html` that loads a KTD3 asset.
- **Approach:**
  1. Bump `?v=` per the KTD3 table.
  2. Run the visual check. Compare the screenshots with the baseline per KTD4.
  3. Look at the pages that load `mme.js`, `home.js` and `entity-cards.js` at 1440 and 390 px in both themes.
- **Test expectation:** none beyond the checks above. This unit adds no behavior.
- **Verification:** the KTD3 grep shows one version per asset, with the new value.

---

## Verification Contract

| Gate | Command or action | Pass |
|---|---|---|
| Baseline | Before any edit, run the visual check twice on `main` and copy each `.visual-check/` to the session scratchpad | Two copies, and the noisy set (KTD4) listed |
| Visual check | `cd web && node ../docs/redesign/prototypes/scripts/visual-check.mjs` | Exit 0, "No findings", 336 loads |
| Screenshot diff | Hash compare every PNG against the first baseline copy | Identical outside the noisy set; noisy pages opened and no different in kind from their main-versus-main difference |
| Dead names | `grep -rnw` each R1 name and each KTD2 key or class in `docs/redesign/prototypes` | No match, except `Scale` and `scale`: there every remaining match must be a comment, a CSS `transform`/`scale:` value, a `scale` variable or parameter, a `*.scale.*` message key, `initial-scale`, or the kept `scale-legend`/`scale-steps` classes. No call, export, destructuring, `class: 'scale'` or `.scale` selector may remain |
| Kept names | `grep -rnw scaleOf docs/redesign/prototypes` | Definition, export and 3 pages |
| Versions | `grep -ho "assets/<file>?v=[0-9]*" *.html \| sort \| uniq -c` per KTD3 asset | One value per asset, equal to "New" |

## Definition of Done

- U1–U4 are done, and every gate in the Verification Contract passes.
- The PR states the before and after numbers of the visual check, the noisy set and its cause, that no page outside it changed, and which widths were looked at versus only measured.
- No other code changed: no reformatting and no unrelated edits in the touched files.
- `report.md` in `docs/prompts/2026-10-29-structure-audit-cleanup/` records the real commands and results.
