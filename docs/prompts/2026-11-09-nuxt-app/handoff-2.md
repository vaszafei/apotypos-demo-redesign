---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-09T19:10:00Z"
title: "Nuxt app migration: U1 and U2 merged, continue at U3"
summary: "The app lives in web/ and Θέματα is at /trends; the pixel-diff script exists and shows what U6 must fix; U3 (Tailwind 4 without reset) is next."
keywords: ["nuxt", "migration", "strangler", "web", "U3", "tailwind", "pixel-diff", "check:pixel", "U6"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Continue the Nuxt app migration at U3 (Tailwind 4 without reset), then U4, U5, U6."
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "84524173"
branch: "main"
head: "c384640dca30060d65bfbf03978491c29c430071"
---

# Handoff 2: Nuxt app migration, U1 and U2 merged, continue at U3

Earlier handoff: `docs/prompts/2026-11-09-nuxt-app/handoff.md` (written before U1; its "Gotchas" and "Working style" sections still hold). Running report with the real numbers: `docs/prompts/2026-11-09-nuxt-app/report.md`.

## Where things stand

On `main` (HEAD `c384640`), after the user said "mergw then" and I merged both with `gh pr merge --merge`:

- **U1 done, PR #129 (merge `a237148`).** The trial moved from `nuxt-spike/` to `web/` (npm, `package-lock.json`, no Nuxt UI). `web/scripts/sync-prototype.mjs` copies the pages not listed in `web/ported-pages.json`, writes `public/_redirects` and `web/app/generated/prototypes.json` (gitignored). `web/app/components/NavLink.vue` and `web/app/utils/links.ts` link a ported route with the router and the others with a plain `<a>`. Only `/trends` is ported.
- **U2 done, PR #130 (merge `c384640`).** `npm run check:pixel -- <route>`, `npm test` (4 tests), and `--root <dir>` / `--base <url>` on `check:visual` and `check:parts`. Shared helpers in `web/scripts/lib/` (`static-server.mjs`, `ported.mjs`).
- **PR #128 (the trial) shows MERGED.** GitHub marked it merged because #129 contained its commits. The open question about closing it is gone. The local branches `claude/nuxt-spike`, `claude/nuxt-app`, `claude/nuxt-pixel-diff` are merged and can be deleted; I did not delete them (the user's call).
- **Not started:** U3 to U17 (plan table in `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md`, lines 186-204).

## Decisions, with who made them

The user's own:

- Same design as the static pages ("i want exactly the same design as we have worked"), a professional app in `web/`, strangler page by page, Ιδιοκτησία first, Tailwind 4 without reset with `prefix(tw)` and no Nuxt UI ("lets go" to my proposal).
- "yes" to my orientation message, which named two things: npm instead of pnpm, and leaving PR #128 open until they decided. So npm is confirmed.
- "all good" after checking the #129 Netlify preview (no detail given), and "mergw then" (merge both). That is the "lets merge" that `docs/solutions/workflow/pr-and-merge-flow.md` requires, for #129 and #130 only.

My calls, not chosen by the user:

- Topic links in Nuxt point at the static page `topic-v2.html?i=<k>` (the trial's `/topic/<k>` had no page). Helper: `topicHref` in `web/app/utils/links.ts`.
- `web/fixtures/topics.json` and `shifts.json` are an interim home for the trial's hand-converted JSON; `sync-prototype.mjs` copies them to `public/data/`. U4 replaces them with converter output and deletes the folder.
- `pngjs` is a devDependency. `check:pixel` finishes every running animation before the screenshot (a settled-state rule from `docs/solutions/workflow/prove-no-visual-change-with-settled-dom.md`), and sets the night theme by the `data-theme` attribute after load on both sides.
- I retargeted #130 from `claude/nuxt-app` to `main` just before merging, after #129 had merged.
- `docs/prompts/2026-11-09-nuxt-app/report.md` is one running report with a section per unit.

## What U2 found, which U6 has to fix

`check:pixel -- /trends` (signed in as `lolovios`, limit 0.05%) is over the limit on 5 of 6 screens (numbers in the report). Causes:

- **Header band, 4 265 px at 1440 (rows 10-45, x 912-1341).** The static header shows the signed-in state; the Nuxt shell has no session. This is U6 step 1 (session store, `proto-user`).
- **Donut edges and line labels.** The trial's `web/app/components/DashCard.vue` line 7 has a fixed `class="dcard m-play"`, so the entrance animations always run, and they leave transform layers that change the anti-aliasing. I proved it by removing the class for one run (then only the header band remained at 1440 full page, picker and hover), and put it back. U6 ports `motion.js`, which adds the class only when motion is allowed.
- **Not explained yet:** the night-theme bands (about 3 900 px in rows 212-522 at 1440; rows 93-104, the tab bar, at 390), and the 390 full page without `m-play` (2 073 px; 254 with it). I think they belong to U6 (theme from `proto-theme`, tab-bar scroll centering) but have not confirmed it. The plan says to stop and ask when a band cannot be explained.
- The trial report's "162 pixels at 1440" does not reproduce (same build gives 517 with my first, signed-out script). The plan's U2 test "reproduces the trial's numbers within noise" is therefore **not met**; the trial's method was not recorded.

## Verification performed, and what was not

Measured: `npm run generate` (8 s), `npm run typecheck`, `npm test` (4 pass), `check:parts` (43 pass, static and `--root .output/public`), `check:fixtures` (pass), `check:visual --only topics` (no findings, both modes), cross-document view transitions fire in both directions (`pagereveal`/`pageswap` report a `viewTransition`).

Not done: looking at the slide between a static page and `/trends`; the Netlify redirect keeping a query string (plan KTD2); the Nuxt error page for an unknown URL on the preview. The user's "all good" covered the preview without saying what they opened.

Pre-existing failure, not mine: `npm run check` fails on `assets/mme.css: .chart .q-label has font-size 11px, below 12px` (`docs/redesign/prototypes/assets/mme.css:188`). The assets equal `origin/main` from before this work, so it fails on `main`. Not touched.

## Next: one path, U3 then U4, U5, U6

1. **U3, Tailwind 4 without reset** (plan lines 250-264): `tailwindcss` + `@tailwindcss/vite`, `web/app/assets/css/tailwind.css` importing only `theme.css` and `utilities.css`, both with `prefix(tw)`; no token mapped yet. Proof: the `/trends` numbers from `check:pixel` before and after must be identical (record "before" first), and the built CSS must have no reset rules.
2. **U4, fixtures converter and `useFixture`** (lines 266-283) and **U5, messages converter and i18n** (lines 285-303). Both depend only on U1.
3. **U6, shell behavior** (lines 305-326): land as two PRs (session and switches, then motion and slide). Its regression line is the pixel diff of `/trends` "not worse than U1"; given the findings above it should get better.

Per the user's working style: one branch `claude/<short-name>` from `main` (now that #129 and #130 are merged, base `main` gives a Netlify preview), open a draft PR early, report measured against looked-at, merge only on "lets merge" (a draft PR needs `gh pr ready` before `gh pr merge`). The user decides the order of pages U9-U15 before each starts.

## Gotchas learned in this session

- `web/public/`, `web/.output/` and `web/app/generated/` are gitignored and rebuilt by `npm run generate` / `npm run sync`. `check:pixel` needs a fresh `npm run generate` first (it exits with a message if `.output/public/_nuxt` is missing).
- Nuxt generate with `ssr: false` does not overwrite the static `index.html` and `404.html`; the build also writes `200.html` and `trends/index.html`. Netlify's non-forced `/* /200.html 200` rule lets static files win.
- Redirects do not run on a local static server (`/topics-v2.html` is a 404 locally); only the Netlify preview shows them.
- Gated pages need `localStorage['proto-user'] = 'lolovios'`; `check:pixel` and `check:parts` do it.
- `npm test` is `node --test scripts/*.test.mjs` (Node 22 does not take a directory).
- `git rm` removes a directory that becomes empty; recreate it before a `git mv` into it. `rm -rf web/node_modules` with an exact path was allowed (the refusal in the old handoff was for a glob after `cd`).
- `gh pr merge` refuses a draft; run `gh pr ready <n>` first. PR bodies: `gh api -X PATCH repos/vaszafei/apotypos-demo-redesign/pulls/<n> -F body=@file` (`gh pr edit` fails).
- Machine-local: my throwaway scripts (`smoke.mjs`, `bands.mjs`, `vt.mjs`, `dom.mjs`, `crop.cjs`) are in the session scratchpad `/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/7b327268-1bce-401a-9810-6bf76ed9d10f/scratchpad/`. `check:pixel` replaces the first two; `vt.mjs` (checks that a view transition exists on a move between the two worlds) has no repo equivalent. Screenshots and diff images of the last `check:pixel` run are in `/tmp/apotypos-pixel-diff/`.
- Do not touch: PR #107 (giannisni) stays unmerged. `docs/prompts/2026-11-09-nav-icons/` is untracked and not part of this work. This handoff is untracked until someone commits it.

## Skills that fit

`nuxt-component` and `find-similar-component` for new components, `run` or `ce-test-browser` to look at pages, `ce-handoff` again when the context passes 70%. The project's CE loop is not used for prototype work (memory `feedback-prototype-workflow-no-ce-loop`).
