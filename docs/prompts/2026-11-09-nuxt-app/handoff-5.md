---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-09T23:59:00Z"
title: "Nuxt app migration: U1 to U6 part 1 merged, continue at U6 part 2 (motion and slide)"
summary: "U5 (#133) and U6 part 1 (#134) are merged to main; U6 part 2 (motion.js port, m-play, view-transition scroll offset) is next, then U7."
keywords: ["nuxt", "migration", "U6", "motion", "m-play", "view-transition", "vt-old-y", "page-move", "U7"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Do U6 part 2 (plan steps 4 and 5): port motion, remove the fixed m-play class, set --vt-old-y before the view transition."
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "84524173"
branch: "main"
head: "a6cdeb34bf1997646ab659e2d6c5cf67566f50ce"
---

# Handoff 5: Nuxt app migration, U1 to U6 part 1 merged

This supersedes the "State" section of `handoff-4.md` (it was written while #134 was still a draft). Everything else in `handoff-4.md` (U6 part 2 steps, gotchas, decisions) still holds and is not repeated here. Older context: `handoff.md` (Gotchas, Working style), `handoff-3.md` (Gotchas). The running report with every measured number is `report.md` (sections U1 to "U6, first pull request"). The plan is `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md` (U6 at lines 305-326, U7 after).

## State, verified now

- `main` is at `a6cdeb3`, clean apart from two untracked items: `docs/prompts/2026-11-09-nav-icons/` (not part of this work) and `docs/prompts/2026-11-09-nuxt-app/handoff-4.md` plus this file (to be committed on the next branch).
- **Merged on the user's explicit "lets merge" / "yes merge, if all ok":** #133 (U5, i18n) and #134 (U6 part 1: session store, `AuthDrawer`, `SignInGate`, prefs store with `?theme=`/`?font=`/`?icons=`, `LangSwitch`, `ShellSwitches`, layout with no hard-coded Greek, and the `check:pixel` night-theme change). For #134 the Netlify checks showed Redirect rules SUCCESS and two NEUTRAL, plus one check with no name or result; no preview-deploy result was seen before the merge.
- **Not started:** U6 part 2, then U7 to U17. The user picks the order of U9-U15 before each starts.
- Open PRs on the repo are old and not part of this work (#107 giannisni must stay unmerged; #105, #93, #86, #1).

## Next: U6 part 2

Details are in `handoff-4.md` ("U6 part 2: what to do"). In short: branch `claude/nuxt-motion` from `main`; port only what the shell and `/trends` use of `assets/motion.js` and the `page-move.js` first-frame hold (grep first, R8); remove the fixed `m-play` class in `web/app/components/DashCard.vue` (line 7) so the motion plugin decides; set `--vt-old-y` before a view transition (`watchMoves`, `assets/shell.js` around line 805; plugin `web/app/plugins/view-transition.client.ts`). Read `docs/solutions/` for the view-transition lesson first; the plan wants its five failure modes tried by hand in Chrome and reported as "looked at".

Numbers to compare after the change (`npm run generate`, then `npm run check:pixel -- /trends`): 1440 full 517, picker 1 553, hover 469, night 530. The remaining 517 px (donut edges, line labels) should drop to near 0 once `m-play` is no longer fixed. The 390 screens are two-valued (static page `centerTabs` race, not Nuxt).

## Decisions and who made them

- The user's own: "go" for U5, "merge then u6", "yes merge, if all ok" for #134, and the earlier ones in `handoff-2.md` and `handoff-3.md`.
- My calls, listed in the #133 and #134 bodies and not objected to (merging is not an explicit decision on them): the `$160k` message escaped by key; one global message merge (six `home.*` keys); `state.failed` text on the error state; `?header=v1` not ported; "Προφίλ" opens the static table of pages; `data-*` attributes moved out of `nuxt.config.ts`; `check:pixel` now stores `proto-theme` before load; `node --test` instead of vitest.

## Still undecided (ask the user, do not decide)

- Whether to delete the merged local branches `claude/nuxt-spike`, `-app`, `-pixel-diff`, `-tailwind`, `-fixtures`, `-i18n`, `-shell-session`. Asked before; no answer.
- How to handle the static page's 390 tab-bar race: fix `shell.js` `centerTabs` or make `check:pixel` tolerate it.

## Working style

One branch `claude/<short-name>` from `main`, a draft PR early, report measured against looked-at, merge only on "lets merge" (`gh pr ready <n>` first, then `gh pr merge <n> --merge`). PR bodies end with the Claude Code line, commits with the Co-Authored-By line from the session reminder. Brief messages. The CE loop is not used for prototype work (memory `feedback-prototype-workflow-no-ce-loop`). Hand off again at 70% context.

## Gotchas not in earlier handoffs

- `@vueuse/core` is not auto-imported (no `@vueuse/nuxt`); import `useEventListener`, `useMediaQuery` explicitly.
- Exports of `web/app/stores/*.ts` are auto-imported by name (`THEMES`, `FONTS`, `USER_KEY`, `pickPref`): avoid generic names.
- The head config in `web/nuxt.config.ts` overwrites `<html>` attributes set from JS after mount.
- Node tests can import `web/app/stores/*.ts` only if the file has explicit imports (`ref`, `defineStore`).
- `check:pixel` and `check:parts` need `npm run generate` first.
- Machine-local: the session's Playwright scripts are in `/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/cce41b79-7311-43b6-ab08-e36010c1b8bf/scratchpad/` (`shell.mjs` checks the drawer, focus trap, sign-in, gate, switches and phone drawer; it needs a temporary `web/app/pages/speeches.vue` for the gate; `lang.mjs` checks the language switch). Pixel screenshots of the last run: `/tmp/apotypos-pixel-diff/`.

## Skills that fit

`nuxt-component` and `find-similar-component` for new components, `run` or `ce-test-browser` to look at pages, `ce-handoff` again at 70% context.
