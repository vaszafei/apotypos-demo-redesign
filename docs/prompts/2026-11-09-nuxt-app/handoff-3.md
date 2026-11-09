---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-09T21:30:00Z"
title: "Nuxt app migration: U1 to U4 merged, continue at U5"
summary: "Tailwind (U3) and the fixtures converter with useFixture (U4) are merged; U5 (messages converter and @nuxt/i18n) is next, then U6."
keywords: ["nuxt", "migration", "U5", "i18n", "messages", "build-messages", "nuxt-i18n", "useFixture", "U6"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Continue the Nuxt app migration at U5 (messages converter and i18n), then U6."
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "84524173"
branch: "main"
head: "82e78816a7419568af2e3b42f0cfaaf1d2df0a11"
---

# Handoff 3: Nuxt app migration, U1 to U4 merged, continue at U5

Earlier handoffs in this folder: `handoff.md` (before U1; its "Gotchas" and "Working style" still hold) and `handoff-2.md` (U1 and U2; its gotchas still hold, and its open question about the 390 px numbers is answered below). The running report with the real numbers is `report.md` (a section per unit, U1 to U4). The plan is `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md`.

## Where things stand

On `main`, HEAD `82e7881`, after the user said "lets merge" for each PR and I ran `gh pr ready` then `gh pr merge --merge`:

- **U1 (#129), U2 (#130):** see `handoff-2.md`.
- **U3 (#131, merge `41af7b1`), done.** Tailwind 4 in `web/` with `prefix(tw)` and no preflight: `web/app/assets/css/tailwind.css` (layer order, `theme.css`, `utilities.css`), registered in `web/nuxt.config.ts` (`css` and the `@tailwindcss/vite` plugin). No token mapped. Built CSS with no `tw:` class is 106 bytes. Details in `report.md`, section U3.
- **U4 (#132, merge `82e7881`), done.** `web/scripts/build-fixtures.mjs` converts the 29 `docs/redesign/prototypes/data/*.js` to `public/data/<key>.json` (run by `sync-prototype.mjs`). `web/app/utils/fixtureStatus.ts` holds the rule of `App.load`; `web/app/composables/useFixture.ts` is the composable (`{ data, status, refresh }`; `?state=empty|error|bad`). `/trends` reads `home` and `overton` through it. `web/fixtures/` is gone.
- **Not started:** U5 to U17 (plan table, lines 186-204).

## Findings from this session that change how to read earlier numbers

- **The 390 px results of `check:pixel` have two values on the same build.** 390 full page is 254 or 2 327 px; 390 night is 2 747 or 4 884 px. The extra band is always rows 93-104 (the tab bar), 2 073 / 2 137 px. Cause, measured: the *static* reference page runs `centerTabs` (`docs/redesign/prototypes/assets/shell.js:1039`) sometimes before the font has loaded (the tab bar's `scrollLeft` was 56 in 5 of 12 fresh loads, 77 in 7); the Nuxt page was 77 in 12 of 12. So this is not a Nuxt defect and not caused by U3 or U4. This answers the "not explained yet" items in `handoff-2.md` for the 390 tab-bar bands. Not fixed: whether to fix `shell.js` or make `check:pixel` handle it is undecided.
- **The 1440 numbers are the stable proof.** Before and after U3 and U4 the four 1440 screens are identical band by band (the numbers are in `report.md` U2). The night-theme band at 1440 (rows 212-522, about 3 870 px) is still not explained; it is for U6.
- The pixel baseline is deterministic apart from that 390 race (two runs gave identical output), so "identical to before" is a valid check for 1440.

## Decisions, with who made them

The user's own: everything listed in `handoff-2.md`, and "lets merge" for #131 and #132, "go" for U3 and U4.

My calls, not chosen by the user:

- U4 used `node --test` instead of the plan's vitest, because Node 22.22 strips the types of a `.ts` util (`web/scripts/fixture-status.test.mjs` imports `../app/utils/fixtureStatus.ts`), and a test file inside `app/composables/` would be auto-imported by Nuxt. Stated in the #132 body and in `report.md`; the user merged it without comment, which is not an explicit decision on it. The same runner is the natural choice for U5's `build-messages.test.mjs`.
- `?state=notfound` is not supported by `useFixture` (the plan has four statuses).
- The shifts card on `/trends` shows nothing when its fixture is not ready (the static page shows an empty or error card). Unchanged from the trial.

## U5: what the next session does, from the plan

Plan lines 285-303. Goal: pages read Greek and English text by the existing keys, with no retyping.

1. `web/scripts/build-messages.mjs` loads the message files and merges them in the order a page loads them, with the prototype's override rule, into `web/i18n/locales/el.json` and `en.json` (generated). It fails (naming the key) on `|`, `@`, `$` or an unbalanced brace, and compiles every message with the vue-i18n compiler.
2. `@nuxt/i18n` with `strategy: 'no_prefix'`, default locale `el`, fallback `el`, storage key `apotypos-locale`, and `?lang=`.
3. Replace the Greek strings hard-coded in `web/app/pages/trends.vue` (and any in components such as `DashCard`, `NavLink`, the layout) with keys. The plan's check: `/trends` has no hard-coded Greek in its Vue file.
4. If the two language files together are over 150 KB gzipped, split by message group and load the group a page needs. Write the size result in `report.md`.
5. Tests per the plan: `t('shell.menu')` Greek and, with `?lang=en`, English; a key missing in English gives Greek; `{count}` interpolation equals the prototype for three sample keys; a message with `|` fails the converter with the key name; switching the language on `/trends` changes the text and keeps the layout.

Facts checked now, read-only:

- The message sources are `docs/redesign/prototypes/assets/messages.js` (66 KB, sets `window.MESSAGES = { el: {...}, en: {...} }`) and the files that add to it with `Object.assign(window.MESSAGES.el, {...})`: `messages-v2.js` (46 KB, several `el`/`en` blocks, later ones override), `messages-mme.js`, `messages-home.js`, `messages-parts.js`, `messages-politics.js` (92 KB), `messages-spread.js`, `messages-world.js` (54 KB). About 330 KB of source in total.
- Which pages load which files differs: `topics-v2.html` loads `messages.js`, `messages-v2.js` and `messages-mme.js` (lines 18-20). The merge order and which groups `/trends` needs have to be read from each page's `<script>` lines; the plan says "the order the pages load them".
- A grep for `|` or `@` in the eight files gave 0 lines each. `$` and brace balance were not checked.
- The locale logic to copy: the language block at the top of `docs/redesign/prototypes/assets/components.js` (reads `?lang=`, then `localStorage['apotypos-locale']`, Greek by default) and `t()` in the same file. The Nuxt shell (`web/app/layouts/default.vue`) has the nav and switches with Greek strings typed in (for example the theme names in the `themes` array), and `web/app/utils/links.ts`, `useNav.ts` hold labels too. Whether those move to keys in U5 or U6 is not decided in the plan; U6 is the shell.
- `@nuxt/i18n` is not installed (`grep` of `web/package.json` and `nuxt.config.ts` found nothing). Use context7 for its current Nuxt 4 / v10 options before configuring; `ssr: false` and `strategy: 'no_prefix'` are already assumed by the plan.
- `docs/solutions/workflow/shared-asset-change-checklist.md` says to delete unused keys in both languages; the converter must not edit the prototype's message files (KTD4/KTD5: the static pages keep working unchanged).

## Verification to run for U5 (the way the earlier units were proved)

`npm run generate`, `npm run typecheck`, `npm test`; `check:pixel -- /trends` must equal the 1440 numbers in `report.md` (the 390 screens have the two-valued result above); `check:parts --root .output/public`; a Chrome look at `/trends?lang=en` and at the language switch. Note `check:pixel` and `check:parts` need `npm run generate` first.

## Next after U5

U6, shell behavior (plan lines 305-326), as two PRs (session store and switches; then motion and the slide). It is where the header band (4 265 px at 1440, signed-in state), the fixed `m-play` class in `web/app/components/DashCard.vue` line 7 and the night-theme bands get fixed. The user decides the order of pages U9-U15 before each starts.

## Working style (from `handoff.md`, memory and this session)

One branch `claude/<short-name>` from `main` (suggested `claude/nuxt-i18n`), open a draft PR early, report measured against looked-at, merge only on "lets merge" (`gh pr ready <n>` first, then `gh pr merge <n> --merge`). PR bodies end with the Claude Code line from the session reminder; commits end with the Co-Authored-By line. Brief messages. The CE loop is not used for prototype work (memory `feedback-prototype-workflow-no-ce-loop`).

## Gotchas

- `web/public/`, `web/.output/` and `web/app/generated/` are gitignored and rebuilt by `npm run generate` / `npm run sync`. `check:pixel` exits with a message if `.output/public/_nuxt` is missing.
- `npm test` is `node --test scripts/*.test.mjs` (Node 22 does not take a directory). Node 22.22 imports `.ts` files with no flag.
- A fixture script runs in a `node:vm` context, so an object it builds has a different prototype: `assert.deepEqual` (strict) fails on it; compare the JSON.
- `gh pr merge` refuses a draft; run `gh pr ready` first. PR bodies: `gh pr create --body-file`, or `gh api -X PATCH repos/vaszafei/apotypos-demo-redesign/pulls/<n> -F body=@file` (`gh pr edit` fails).
- Redirects do not run on a local static server; gated pages need `localStorage['proto-user'] = 'lolovios'` (`check:pixel` and `check:parts` set it).
- Machine-local: my throwaway scripts of this session are in `/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/4c6c16f4-8b03-4177-8868-86f4a452ae45/scratchpad/` (`states.mjs` checks the `?state=` pages and the data requests of `/trends`; `race.mjs` measures the tab-bar race; `before.txt` is the `check:pixel` output before U3). Screenshots of the last `check:pixel` run: `/tmp/apotypos-pixel-diff/`.
- Not mine, do not touch: PR #107 (giannisni) stays unmerged. `docs/prompts/2026-11-09-nav-icons/` is untracked and not part of this work. The merged local branches `claude/nuxt-spike`, `claude/nuxt-app`, `claude/nuxt-pixel-diff`, `claude/nuxt-tailwind`, `claude/nuxt-fixtures` still exist; I asked the user whether to delete them and have no answer.
- This handoff is untracked on `main` until someone commits it (on the U5 branch, as was done with `handoff-2.md`).

## Skills that fit

`nuxt-component` and `find-similar-component` for new components, `run` or `ce-test-browser` to look at pages, context7 for `@nuxt/i18n`, `ce-handoff` again when the context passes 70%.
