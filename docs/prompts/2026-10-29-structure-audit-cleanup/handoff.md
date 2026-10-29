# Handoff: structure audit cleanup (2026-10-29)

Next session: do the cleanup part of the structure audit, in small PRs, with the visual check before and after each one. Read `CLAUDE.md` and `docs/solutions/` first.

## State

- `main` is at `539b67b`. Merged today: #94 (7 v1 pages removed), #95 (`pnpm check:visual`). Compound-engineering setup, `CLAUDE.md` and four `docs/solutions/` notes are on `main`.
- 30 pages remain in `docs/redesign/prototypes/` (all `-v2` except `index`, `404`, `pages`, `methodology`).
- The plan of the visual check is `docs/plans/2026-10-29-001-feat-visual-check-plan.md` (result section at the end).
- The compound-engineering plugin was not loaded in the session that wrote this (`/ce-*` skills were missing). Check whether it loads now. If it does, run `/ce-plan` for this work. If not, follow the same loop by hand.

## Decisions already made by the user

1. Clean up now, in small PRs: dead code and duplicate CSS. Do not split `assets/` yet.
2. Build the safety net first (done: `pnpm check:visual`).
3. Write the component map for the Nuxt port as `docs/solutions/architecture/nuxt-port-component-map.md`, and a first-batch plan in `docs/plans/`.
4. Old v1 pages: deleted.

## Findings to act on (static analysis, regex over `*.html` and `assets/*.js`; re-run the scripts in this folder)

- Exports with no use anywhere: `Dash.newsStories`, `Politics.divergeCell`, `Mme.HighlightsCard`, `Mme.OutletStats`, `Mme.topIssues`, `Home.SectionHead`, `Entity.scaleOf`. Confirm with a grep for the plain name before you delete. Dynamic calls are not found by the script.
- Exports used only inside their own file (make them private): `Dash.Scale`, `Entity.Sunburst`, `Shell.itemOf`, `Mme.sumPairs`, `Mme.shareOf`, `Mme.StanceBar`, `Mme.critShare`.
- `protoNote` is copied into 13 pages (`function protoNote () { return h('p', { class: 'proto-note' }, t('proto.states')) }`). Move it to `UI` or `Dash` once.
- The "measure the slack and fill the height" code is written separately in `media-v2.html`, `outlet-v2.html`, `groups-v2.html` (`requestAnimationFrame`). Make one helper. Only if the three behave the same.
- 17 CSS selectors are defined in more than one file: `.tooltip`, `.mini-empty`, `.stance-key`, `.key-item`, `.dash-bar`, `.dash-error` in `app.css` and `dash.css`; `.swatch`, `.link-button`, `.report-tabs button` in `app.css` and `world.css`; `.chip` in `dash.css` and `world.css`; `:root` in five files. Run `duplicate-selectors.py`. The `to` entry is a keyframe step, not a selector.
- Largest inline page scripts (the future components): `groups-v2` 354 lines, `outlet-v2` 273, `elections-v2` 255, `narrative-v2` 235, `media-v2` 235.
- Namespaces and pages that load them: `UI` 31 exports / all pages, `Dash` 21 / 26, `Mme` 26 / 5, `Entity` 9 / 4, `Politics` 9 / 8, `Spread` 6 / 5, `Home` 8 / 1, `Shell` 9.

## How to work

1. Branch `claude/<short-name>` from `main`. One kind of cleanup per PR (dead code, `protoNote`, fill-height helper, CSS merge).
2. Run the check before you change anything and keep `.visual-check/report.json` as the baseline. Run it again after. Report the numbers. Open the screenshots of the pages that use the changed file, and say which widths you only measured and which you looked at.
3. A shared asset change needs the `?v=` bump on every page that loads it. Current highest: `components.js` 13, `dash.js` 16, `shell.js` 50, `messages.js` 32, `app.css` 35, `dash.css` 81, `tokens.css` 10. Take the highest on `main` plus 1 (`grep -ho "x.js?v=[0-9]*" *.html | sort | uniq -c`).
4. CSS merges change cascade order. Move one selector at a time, and check the pages with the selector on `paper` and `night`.
5. Open a PR only when there is a visible or behavioral change to preview. Merge only after "lets merge".
6. When a cleanup teaches something that is not obvious from the code, record it with `/ce-compound` in `docs/solutions/`.

## Commands and tooling

- Visual check: `cd web && node ../docs/redesign/prototypes/scripts/visual-check.mjs [--only text] [--widths 1440,390] [--themes paper,night|all]`. 336 loads take about 3 minutes. Output is `.visual-check/` (screenshots and `report.json`).
- `pnpm check:visual` fails with pnpm 11.9 on this machine (it runs an install and stops on the `esbuild` ignored-build warning). Use the `node` command. The pnpm binary is `~/.local/share/mise/installs/pnpm/11.9.0/pnpm` (the mise shim has no version set).
- Chrome: `/usr/bin/google-chrome` or `CHROME_PATH`.
- Analysis scripts in this folder, run from `docs/redesign/prototypes`: `python3 -I ../../../docs/prompts/2026-10-29-structure-audit-cleanup/export-usage.py` and `duplicate-selectors.py`.
- The first full run on `main` had no findings. If the next run has findings, they are new.

## Open

- The check was not tried in a cloud session, and has had no independent review.
- The user wants their rules from `docs/solutions/conventions/layout-requests-are-literal.md` for any visible change. A cleanup must not change how a page looks.
- Not decided: when to start the Nuxt port itself (the component map comes first).
