# Report: remove dead exports (2026-10-29)

Plan: `docs/plans/2026-10-29-1510-refactor-remove-dead-exports-plan.md`. Branch: `claude/remove-dead-exports`, base `main` at `4ad57da`.

## What changed

- Deleted 7 functions that no page or asset calls: `Dash.newsStories`, `Dash.Scale`, `Politics.divergeCell`, `Mme.HighlightsCard`, `Mme.OutletStats`, `Mme.topIssues`, `Home.SectionHead`.
- Removed 6 names from their namespace (the functions stay, they are used inside their own file): `Entity.Sunburst`, `Shell.itemOf`, `Mme.sumPairs`, `Mme.shareOf`, `Mme.critShare`, `Mme.StanceBar`.
- Deleted the message keys only those functions used (`mme.hl.*`, `mme.o.title`, `mme.o.info`, `media2.scale.aria`, both languages) and their CSS rules (`.mme-hl*`, `.mme-ostat*`, `.scale*`, `.scale-cell`, `.home-section-*`).
- Bumped `?v=` for the 11 changed assets on every page that loads them.
- `Entity.scaleOf` stays: `group-v2`, `topic-v2` and `outlet-v2` destructure it.

## Deviations from the plan

- The plan said `Mme.StanceBar` was never called and should be deleted. That was wrong: `GovCard` in `mme.js` calls it (`bar: StanceBar(o.stance, o.name, avg)`). My earlier grep output was cut at 160 columns and hid the call. The function was restored from `HEAD` unchanged and only made private, which is what the handoff and the user's answer said.
- The handoff's list was wrong in two places, found before planning: `Entity.scaleOf` is used (destructuring, which `export-usage.py` does not see), and `Dash.Scale` has no caller at all.

## Verification

| Check | Command | Result |
|---|---|---|
| Baseline 1 on `main` | `cd web && node ../docs/redesign/prototypes/scripts/visual-check.mjs` | 336 loads in 170 s, no findings |
| Baseline 2 on `main` | same | 336 loads in 173 s, no findings |
| Noise between the two `main` runs | md5 of every PNG | 77 of 336 differ (animations still running at capture: `motion.js` count-ups and chart entrances). No page height differs |
| After the change | same command | 336 loads in 168 s, no findings, exit 0 |
| After vs baseline 1 | md5 + pixel diff | 79 differ, no page height differs. 16 outside the noisy set |
| The 16, rerun | `--only <page>` 3 times on the branch, and once on `main` | `overton`, `topics`, `cases`, `story`: identical on `main` and branch. `fingerprints`, `elections`, `persons`, `media`: differ run to run on both (animation) |
| Settled DOM, all pages | Playwright, `reducedMotion: 'reduce'`, wait 3 s, `document.body.innerHTML` (with `?v=` stripped), at 1440 and 390 px, `paper` | Identical on 84 of 84 loads after normalizing the random chart `clipPath` ids (`bc-xxxxx-`). Same page heights. No console errors on either side |
| Dead names | `grep -rnw` per name and key | No match. `Scale` only in the `groups-v2.html` comment "Scale the band" |
| Kept name | `grep -rlw scaleOf` | `entity-cards.js` and the 3 pages |
| Versions | `grep -ho "assets/<file>?v=[0-9]*" *.html \| sort \| uniq -c` | One value per asset, the new one |
| Code review | `ce-code-review` focused (own read + one local adversarial reviewer) | Ready to merge. 1 P3 advisory (the plan text on `StanceBar`) |

Looked at: `fingerprints-v2?tab=spread` and `media-v2` at 1440 night, `overton-v2` at 1100 paper, `cases-v2` at 390 paper (before and after screenshots). Every other page and width was only measured (hash, pixel diff, DOM).

## Found, not changed

- `stanceKey` in `mme.js` was already unused on `main` (not an export). Out of scope.
- `groups-v2.html` has its own copy of `Sunburst`.
- `export-usage.py` misses destructured uses.
- The visual check takes screenshots with motion on, 500 ms after network idle, so about a quarter of the screenshots differ between two runs of the same code. A screenshot comparison needs `reducedMotion: 'reduce'` (as the DOM check above used) to be exact.
