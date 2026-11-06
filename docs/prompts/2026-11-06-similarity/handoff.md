---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-06T19:00:00Z"
title: "Handoff 6: Ομοιότητα και πρωτοτυπία is done and merged; next is the section Πρόσωπα"
summary: "PR #118 is merged (the similarity tab went from 9 cards to 3). Next: the section Πρόσωπα (4 tabs). The user has not said what to change there; start with the same audit that worked for Ομοιότητα: what question each card answers, readable or not, value, then keep / redo / remove / move, and ask before planning."
keywords: ["apotypos", "people", "prosopa", "fingerprints", "persons", "statements", "handoff"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Πρόσωπα (top bar). Tabs: Επισκόπηση /fingerprints, Έμφαση και στάση /fingerprints/spread, Δηλώσεις /track, Φάκελος προσώπου /contradictions (sub-tabs Αντιφάσεις, Έλεγχος στοιχείων). Audit every card with a screenshot, propose, and wait for the user before changing anything."
repository: "apotypos-demo-redesign"
branch: "main"
---

# Handoff 6: Ομοιότητα και πρωτοτυπία done, next Πρόσωπα (2026-11-06)

Previous handoff: `docs/prompts/2026-11-06-stance-map/handoff.md`. This session's own files: `docs/prompts/2026-11-06-similarity/` (`prompt.md`, `research.md`, `report.md`). The work is PR #118, merged (merge commit `77615b7`).

## What happened this session (PR #118)

The tab `/similarity` (`similarity-v2.html`) went from 9 cards to 3, one card at a time with a screenshot each. The user removed: the 24×24 matrix, the lag card (the lag stays as a table column), the outlet panel, the same-group card, «Ξεκινά μόνος», «Όλα τα ζεύγη μέσων», «Άρθρα χωρίς υπογραφή» (merged into a map). Left:

1. «Μέσα κατά πρωτοτυπία» (table, chips removed).
2. «Πρωτοτυπία και υπογραφές» (new map of the 5 API outlets: x original %, y unsigned %).
3. «Ειδήσεις και clickbait ανά μέσο» (redone: a name on every dot, axis titles say what is measured; c-6, alone in its row).

Both maps use `DotMap` in `similarity-v2.html` (the label placer of `StanceMap`). `question.media.similarity` and `docs/redesign/tab-structure.md` were updated.

Open from that tab (not Πρόσωπα): the tab is still named «Ομοιότητα και πρωτοτυπία» but has no similarity card; whether the clickbait map stays there. Dead now, not deleted: `Spread.matrix`, `Spread.Ring`, keys `sim.mx.*`, `sim.table.*`, `stories.solo.*`. `/ce-code-review` and `/ce-compound` were not run.

## The next task: Πρόσωπα

**The user said only "work with prosopa". No card, question or change was named.** Do not guess a design. Ask or audit first.

Section in the top bar, tabs (verified in `assets/shell.js`, `docs/redesign/tab-structure.md`, and by loading the pages on 2026-11-06):

| Tab | Route | File | Measured at 1440 |
|---|---|---|---|
| Επισκόπηση | `/fingerprints` | `fingerprints-v2.html` | 998 px, 2 cards: «Τα πρόσωπα», «Πώς παρουσιάζει κάθε μέσο τα πρόσωπα» |
| Έμφαση και στάση | `/fingerprints/spread` | `fingerprints-v2.html?tab=spread` | not measured |
| Δηλώσεις | `/track` | `statements-v2.html` | 900 px, 1 card: «Ποιον παραθέτουν τα άρθρα» (the title on screen is «Πρώτος: Ντόναλντ Τραμπ (43,8%)») |
| Φάκελος προσώπου › Επισκόπηση | `/contradictions` | `persons-v2.html` | 1519 px, 8 cards (the file is one person; the person card and stat cards have no title) |
| Φάκελος › Αντιφάσεις | `/contradictions/pairs` | `persons-v2.html?tab=pairs` | not measured |
| Φάκελος › Έλεγχος στοιχείων | `/contradictions/checks` | `persons-v2.html?tab=checks` | not measured |

`tab-structure.md` (#62) has older heights (1928 / 900 / 3700 px) from before the tabs were split; trust the table above and re-measure the unmeasured ones.

Code and data (verify before relying on them):

- `fingerprints-v2.html` (238 lines): `personsModel`, `CellList`, `RangeChart`, `buildGrid`, `sortRows`, the color steps (`stepColors`, `LIMITS`). Data: `data/fingerprints.js`, `data/stanceRatings` (check the name in `load('stanceRatings'…)`), `data/groups.js`, `data/mme.js`.
- `persons-v2.html` (138 lines): `monthCard`, `verdictCard`, `themeCard`, `pairCard`, `checkCard`; data `data/personFile.js` (158 KB; keys `summary, themes, pairs, checked`). `statements-v2.html` (67 lines): data `statements` (`rows`).
- `data/peopleMatrix.js` exists; not checked which page uses it.
- Messages: `tab.people.*` and `pf.*` in `assets/messages.js` / `messages-v2.js` (check where each key lives).

## Suggested start (the method that worked for the similarity tab)

1. Read `docs/solutions/` (`layout-requests-are-literal.md`, `plan-decisions-quote-the-user.md`, `shared-asset-change-checklist.md`, `verify-dead-exports-before-deleting.md`) and `docs/redesign/tab-structure.md`.
2. Screenshot every card of the 4 tabs (see Tools).
3. For each card say: the question it answers, whether it is readable, whether it has value, and propose keep / redo / remove / move. Put it in one table.
4. Ask the user which tab or card to start with and what each card should answer. `CLAUDE.md`: ask, show a plan, wait for approval.
5. Then go **card by card with a screenshot**, as the user asked this session.

## What the user liked / corrected this session (patterns to reuse)

- **Card by card with a screenshot.** One card per message: the real screenshot, 2–3 options at most, a recommendation, one or two questions.
- **Read literally.** "remove that" removes the card; "divide it to same group only" means only that. When "that" could be two cards, ask (this session's `AskUserQuestion` worked).
- **Pairs are not the user's unit.** They asked why pairs and wanted groups of any size. Think about the unit of the measure before you design.
- **"I cannot understand" means redo simpler**, not explain more. The strip of 276 pair dots was rejected; the plain list of the 11 same-group pairs was accepted (and later removed with its card).
- **Charts like Στάση**: scatter, a name on every dot, light zones or dashed averages, axis titles that say what is measured, the explanation in the info tooltip. `DotMap` in `similarity-v2.html` is the reusable form.
- Say plainly when the web gives only general guidance (it did again: no rule for similarity between outlets).

## Data lessons that may apply to Πρόσωπα

- A ratio that divides by one side's size mostly shows size. The old matrix correlated 0,98 with the size of the column outlet; lift over-corrects (−0,81). Check the correlation with size before trusting a heat or rank view.
- Tiny entities distort averages (the tiny sites at about 2% turned 28,8% vs 25,5% into 16% vs 17%). Cut by a minimum count and say the cut on the card.
- Compare with a random baseline when a result might be chance (random sets of the same size).

## Tools and traps

- Serve the prototypes: start `python3 -m http.server 8765` with `run_in_background` from `docs/redesign/prototypes`. Stop it with `kill $(lsof -ti:8765)` (**not** `pkill -f`). Playwright: `web/node_modules/playwright-core` with `/usr/bin/google-chrome`; scroll before a screenshot (charts wait for their first view).
- **Stop your server before `visual-check.mjs`**: it starts its own on 8765 and fails with `EADDRINUSE`.
- A throwaway mock page in `docs/redesign/prototypes/_mock-*.html` (copy the `<head>` and scripts of the real page, then `Shell.start` with your own `render`) gives real styles. It **fails `check.mjs`** (color literals): use tokens and delete it before the commit.
- A Bash call that mixed a heredoc and a backgrounded server was blocked by a safety check ("could not be checked for dangerous rm"); write files with the Write tool and start the server in a separate call.
- Fixed header covers the top of an element screenshot: add `header { position: static !important }` through `addStyleTag`, then clip.
- A shared asset change needs a version bump on every page that loads it: `sed -i 's/messages-v2.js?v=59/messages-v2.js?v=60/' *.html` (check with `grep -ho "x.js?v=[0-9]*" *.html | sort | uniq -c`). Versions now: `messages.js` 45, `messages-v2.js` 59, `messages-spread.js` 30, `messages-mme.js` 29, `dash.js` 30, `dash.css` 103, `mme.js` 23 (the data file `data/mme.js` is 20), `mme.css` 54, `app.css` 51, `components.js` 20, `spread.js` 6, `shell.js` 64.
- `check.mjs` and `visual-check.mjs --only <text>` run from `web/`: `node ../docs/redesign/prototypes/scripts/check.mjs`. `check.mjs` passes on `main`.
- `gh pr edit` fails; use `gh api -X PATCH repos/vaszafei/apotypos-demo-redesign/pulls/<n> -F body=@file`. Merge only after "lets merge": `gh pr merge <n> --merge`.
- In `h()` a `style` object does not set CSS custom properties; pass a string. `h()` builds SVG only for `svg g rect line text path title desc circle clipPath defs` (a `polygon` is invisible: use `path`).
- Open PRs not from this session: #107 (giannisni, **must stay unmerged**), #105 (old Sankey, empty; ask before closing), #93, #86, #1 (old).
- One branch `claude/<name>`, one PR. Conventional commits.

## Not checked

English text on screen for the changed similarity cards, the empty state of the similarity tab, a phone view of the two maps by eye, the unmeasured Πρόσωπα tabs.
