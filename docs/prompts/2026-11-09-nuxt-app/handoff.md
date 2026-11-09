---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-09T15:46:58Z"
title: "Nuxt app migration: approved plan, start at U1"
summary: "The plan to move all 26 static prototype pages into one Nuxt app in web/ is approved; a new session starts U1."
keywords: ["nuxt", "migration", "strangler", "web", "U1", "pixel-diff"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Read the approved plan, then start U1 (app in web/, both worlds served)."
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "84524173"
branch: "claude/nuxt-spike"
head: "54fbc4ea69c15e40eca8352699f9b9b65810f367"
---

# Handoff: Nuxt app migration, start at U1

## Where things stand

- The migration plan is **approved by the user**: `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md` (untracked, not committed yet). It has 17 units (U1 to U17), a Verification Contract and a Definition of Done. Read the Goal Capsule, KTD1 to KTD13, the unit table and the active unit; the rest is reference.
- No code was written in this session. The only new file besides this folder is the plan.
- Branch is `claude/nuxt-spike` (head `54fbc4e`), draft PR #128. The plan's U1 moves its work to a new branch `claude/nuxt-app` and `web/`.
- Not started: all 17 units.

## Decisions, with who made them

User's own words:

- Same design: "i want exactly the same design as we have worked". The first trial used Nuxt UI and Tailwind and looked different; the user rejected it.
- A real app, not a spike: "why you tell them spikes? we have to have a profational nuxt app" and "its has to be a profational nuxt app so yes". So `web/` and ordinary names, no "spike".
- Strangler (page by page, unported pages still served as static HTML): the user picked it over one long branch.
- Ιδιοκτησία is the first new page: the user answered "yes" to the question that named it.
- Tailwind: the user asked "why not tailwind?". I proposed Tailwind 4 without its reset, with `prefix(tw)`, for new parts only, and no Nuxt UI. The user answered "lets go" (approval of my proposal, not their own design).

My calls (the user approved the plan as a whole, but did not choose these):

- `@nuxt/i18n` with `no_prefix` and JSON per language (KTD7); fixtures converted by a `node:vm` script and read by `useFixture` (KTD8); `ssr: false` first, prerender tested in U16 (KTD11); npm instead of pnpm (KTD13); the redirects as a generated `public/_redirects` (KTD2); a page's HTML frozen after it is ported (KTD5).
- The plan's targets are mine: at most 0.05% differing pixels per screen with every band explained; Ιδιοκτησία page change within 10% of the static page at normal CPU and not slower at 4× CPU; first load at most 10% larger than static.

## Two things to confirm with the user early in U1

1. **npm instead of pnpm in `web/`.** Default npm with `package-lock.json`, Netlify command `npm run generate`. `pnpm` does not run on this machine (mise error).
2. **Ask before closing PR #128.** The plan says to close it with a comment pointing at the new PR, but that is the user's call.

## Review status of the plan

- `ce-doc-review` was **not run through its subagents**. I reviewed the plan myself, inline, and fixed what I found (the redirect mechanism, the screenshots that were never saved, the detail-page `?id=` URLs, the `.json` data files, the language switch, the 10% margin, U6 landing as two PRs).
- The deeper confidence pass was skipped. Treat the plan as reviewed once, by its author.

## Working style (the user's)

- No compound-engineering loop for prototype work (memory `feedback-prototype-workflow-no-ce-loop`): one branch `claude/<short-name>`, small commits, **push and open the PR early**, the user checks the Netlify deploy preview and answers with a screenshot. Merge only on "lets merge" (`docs/solutions/workflow/pr-and-merge-flow.md`). The plan itself was the exception, as a 17-unit migration needs one.
- Show options with screenshots before design changes. Brief answers. Report what was measured separately from what was looked at.
- UI text is Greek. The user writes Greek in Latin letters. Never guess anyone's pronouns.
- Use `nuxt-component` and `find-similar-component` for new components, `run` or `ce-test-browser` to check pages, `ce-handoff` when the context passes 70%.
- The user's global rules: no `var`, no Options API, no default exports for composables and utils, no hard-coded env vars (`useRuntimeConfig()`), no extras or comments beyond the ask.

## Gotchas

- `pnpm` does not run here. Use `npm` in `web/` and `node` for the repo scripts.
- Chrome is `/usr/bin/google-chrome`; `playwright-core` is in `web/node_modules/.pnpm/playwright-core@1.64.1/node_modules/playwright-core` (machine-local; `createRequire('/home/zafnitlab/Documents/apotypos-demo-redesign/web/')`). That path changes when U1 switches `web/` to npm.
- A Bash `rm -rf` with a glob after `cd` was refused by the safety check earlier. Do not work around it; use `git rm` / `git mv` or ask. Two empty placeholder CSS files in `nuxt-spike/app/assets/css/` (`main.css`, `tokens.css`) are unused, for U1 to delete.
- The `<html>` needs `data-theme="paper" data-icons="off" data-font="plex" data-header="v2"` or the layout differs (set in the trial's `nuxt.config.ts`).
- `python3 -m http.server` has no SPA fallback: open `/` first, deep links 404. Stop servers with `kill $(lsof -ti:<port>)`, not `pkill -f`.
- Netlify builds previews only for PRs with base `main`. `gh pr edit` fails: use `gh api -X PATCH repos/vaszafei/apotypos-demo-redesign/pulls/<n> -F body=@file`.
- In the prototype, `h()` does not set CSS custom properties from a `style` object; in Vue pass a string (`:style="`--dot:${c}`"`).
- The gated pages (World section) show the sign-in gate unless `localStorage['proto-user']` is `lolovios`. Every check must sign in (`docs/solutions/workflow/checks-must-sign-in-for-gated-pages.md`).
- Do not touch: PR **#107 (giannisni) stays unmerged**; #105, #93, #86, #1 are old. `docs/prompts/2026-11-09-nav-icons/` is untracked and not part of this work.
- The earlier handoff `/tmp/handoff-nuxt-migration.md` (machine-local) lists `statements-v2` as a page. **It does not exist.** There are 26 HTML files; `persons-v2.html` is the person file.
- Tailwind collision is real: the prototype's `--text-body` (16px) and `--text-primary` (`#404040`) share the `--text-*` family that Tailwind reads as font sizes. That is why `prefix(tw)` is required (KTD6).

## Pointers

- Plan: `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md`. Start at U1; its Files and Approach lists are the working order.
- Trial report (numbers, method, "not done" list): `docs/prompts/2026-11-10-nuxt-spike/report.md`. Trial scope: `docs/prompts/2026-11-10-nuxt-spike/prompt.md`.
- Trial code to move: `nuxt-spike/app/` (layout, `DashCard`, `TopicDonut`, `LinesChart`, `BarList`, `DateRange`, `ChartTooltip`, `AppIcon`, stores `period` and `tooltip`, `plugins/view-transition.client.ts`, `composables/useNav.ts`). Its CSS in `nuxt-spike/public/assets/` is a byte copy of the prototype CSS; U1 replaces it with the sync copy (KTD4).
- Today's deploy: `web/netlify.toml` (base `web`, `pnpm generate`, an `ignore` rule watching `web` and `docs/redesign/prototypes`, Node 22), `web/scripts/sync-prototype.mjs` (copies the whole prototype into `web/public/`).
- Static app: `docs/redesign/prototypes/assets/shell.js` (NAV, PROTOTYPES, gate, auth drawer, search, moves), `components.js` (`t`, `load`), `messages*.js`, `data/*.js`.
- Lessons to read before U1, U2 and U6: `docs/solutions/workflow/shared-asset-change-checklist.md`, `prove-no-visual-change-with-settled-dom.md`, `checks-must-sign-in-for-gated-pages.md`, `docs/solutions/design-patterns/cross-document-view-transitions-on-script-drawn-pages.md`.
- Per `CLAUDE.md`, save the new session's prompt in this folder (`prompt.md`, written) and write `report.md` here at the end with real commands and measurements.

## Next step (one path)

Read the plan, check `git status` and the branch, ask the user the two confirmations above, create `claude/nuxt-app` from `claude/nuxt-spike`, and do U1. Open a draft PR early so the Netlify preview exists, then U2 and the rest in the plan's order. The order of the page units U9 to U15 is the user's call before each starts.
