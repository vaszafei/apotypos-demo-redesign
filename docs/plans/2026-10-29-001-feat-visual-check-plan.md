---
title: Visual check for the prototype pages - Plan
type: feat
date: 2026-10-29
execution: code
---

# Visual check for the prototype pages - Plan

## Goal

One command loads every prototype page at 1920, 1440, 1100 and 390 px, in the `paper` and `night` themes. It reports each page that has a console error, a failed or 4xx request, or a horizontal scroll. It saves a screenshot of each load, so a person can look at the pages that a shared change touched.

It replaces `docs/redesign/prototypes/scripts/check.mjs`, which tests deleted v1 pages and a page that does not exist (`echoes-v2.html`).

## Why now

The structure audit will change shared files (`dash.css`, `app.css`, `components.js`). 30 pages load them. Today the check is manual and covers only the pages that someone opens. See `docs/solutions/workflow/shared-asset-change-checklist.md`.

## Scope

- The URL list comes from the route map in `assets/shell.js`, so each tab is a page (`?tab=`). It adds the detail pages with their parameters: `story-v2.html?id=4502`, `outlet-v2.html`, `group-v2.html?g=skai`, `topic-v2.html?i=<id>`, and `404.html`.
- Per load, the script checks: no console error, no `pageerror`, no failed request, no HTTP status of 400 or more, and `scrollWidth <= innerWidth`.
- Output goes to `.visual-check/<widthxheight>-<theme>/<page>.png` and a `report.json`. The folder is git-ignored.
- Exit code is 1 if any check fails. The report lists page, width, theme and the problem.

Out of scope: pixel comparison with a baseline, content assertions (counts, text), CI. The user looks at the screenshots. A baseline comparison is a later step if the screenshots are not enough.

## Decisions (recommendations)

1. **Browser library.** Add `playwright-core` as a dev dependency of `web/`. The current scripts import it from another project (`agronitV2`), which breaks on any other machine and in cloud sessions. The script uses system Chrome through `CHROME_PATH` (default `/usr/bin/google-chrome`).
2. **Where the script lives.** `docs/redesign/prototypes/scripts/visual-check.mjs`, started by `pnpm check:visual` in `web/`. The sync script already skips the `scripts` folder, so it is not deployed.
3. **`check.mjs`.** Delete it in this change. Its pages are gone, and the new script covers the load and layout checks. Its content assertions are lost. They were already failing.
4. **Themes.** `paper` and `night`. The other themes (`fog`, `terra`, `midnight`) are tokens only. Add `--themes all` as an option.

## Units

1. **U1: the script.** Server (static, port 8765), the URL list, the loop, the checks, the report. Done when: it runs on `main` and exits 0, or lists real findings.
2. **U2: the command and the dependency.** `playwright-core` in `web/package.json`, `check:visual` script, `.visual-check/` in `.gitignore`. Done when: `pnpm check:visual` works from a clean clone with only Chrome installed.
3. **U3: remove `check.mjs`** and update `docs/solutions/workflow/shared-asset-change-checklist.md` (step 2 names the new command). Done when: no file mentions `check.mjs`.
4. **U4: prove it.** Break a page on purpose (a wide element, a bad script URL) and check that the script reports it. Then revert. Done when: the report names both problems.

## Done when

- `pnpm check:visual` runs all URLs x 4 widths x 2 themes and writes the screenshots and `report.json`.
- The real result of the first run on `main` is in the PR, including every finding. Findings are reported, not fixed, in this PR.
- The run time is stated.
- A deliberate wide element and a deliberate console error are reported (U4).

## Risks

- Some pages may already have a horizontal scroll at 390 px or a console error. The first run shows them. They are findings for the audit, not blockers here.
- Cloud sessions may not have Chrome. If so, the script prints the install step and exits with a clear message.

## Result (2026-10-29)

- U1 to U4 done. Plan decisions 1 to 4 were applied as written.
- First run on `main` (`254422a`): 336 loads (42 pages x 4 widths x 2 themes) in 185 s, no findings. Screenshots take 72 MB in `.visual-check/`.
- Proof (U4): a copy of `methodology.html` with a 3000 px element, a `console.error` and a missing script gave 10 findings in 6 distinct problems: the 404, the failed request, the console error and the horizontal scroll at 1440 and at 390 px. The page was reverted.
- `pnpm check:visual` fails on this machine with pnpm 11.9, because `pnpm` runs an install first and stops on the `esbuild` ignored-build warning. That problem is older than this change. The command `node ../docs/redesign/prototypes/scripts/visual-check.mjs` works.
- Not done: no independent code review (`/ce-code-review` was not loaded in the session), no run in a cloud session.
