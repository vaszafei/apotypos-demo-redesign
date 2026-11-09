---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-09T23:30:00Z"
title: "Nuxt app migration: U5 merged, U6 part 1 open (#134), U6 part 2 next"
summary: "i18n (U5) is merged. U6 part 1 (session, auth drawer, switches) is draft PR #134 waiting for 'lets merge'. Next is U6 part 2: motion.js port and the view-transition slide."
keywords: ["nuxt", "migration", "U6", "motion", "view-transition", "m-play", "page-move", "#134"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "After #134 is merged, do U6 part 2 (plan steps 4 and 5): motion and the slide."
repository: "vaszafei/apotypos-demo-redesign"
branch: "claude/nuxt-shell-session"
head: "f63431819442f00ecf9ec79fab48ef5fc38e95d6"
---

# Handoff 4: U5 merged, U6 part 1 in review

Earlier handoffs here: `handoff.md` (Gotchas, Working style), `handoff-2.md`, `handoff-3.md` (its Gotchas still hold). The running report with every number is `report.md` (sections U1 to U6a). The plan is `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md` (U6 at lines 305-326).

## State

- **U5 merged** (#133, merge `2d448a1`): `build-messages.mjs`, `@nuxtjs/i18n` (`no_prefix`, `?lang=`, `localStorage['apotypos-locale']`), `/trends` text by key. Report section U5.
- **U6 part 1 is draft PR #134** (`claude/nuxt-shell-session`, HEAD `f634318`, base main): session store, `AuthDrawer`, `SignInGate`, `ShellSwitches`/`LangSwitch`/`AuthLinks`/`UserMenu`, `stores/prefs.ts`, the layout with no hard-coded Greek, and a change to `scripts/pixel-diff.mjs` (the night screens load with the stored `proto-theme`). The user has not looked at it yet; merge only on "lets merge" (`gh pr ready 134`, then `gh pr merge 134 --merge`). Report section "U6, first pull request".
- **Not started:** U6 part 2, then U7 to U17.

## U6 part 2: what to do (plan step 4 and 5)

1. Branch `claude/nuxt-motion` from `main` after #134 is merged (or from `claude/nuxt-shell-session` if the user wants it stacked).
2. Port `assets/motion.js` (first-view animations, count-up, honors reduced motion) and the `page-move.js` first-frame hold. Grep first what the shell and `/trends` actually use (R8); port only that. `DashCard.vue` line 7 has a fixed `m-play` class: remove it and let the motion plugin decide. Plan files: `web/app/plugins/motion.client.ts`, `web/app/plugins/view-transition.client.ts`.
3. `--vt-old-y` must be set before a view transition so a scrolled page slides from where it was seen (`watchMoves` in `shell.js` around line 805).
4. Plan's tests: a page change started while scrolled 1400 px slides from where it was; Back and Forward go the right direction; a move between two items with no direction logs no rejection. The plan says to try the five failure modes of the view-transition lesson by hand in Chrome (`docs/solutions/` has the lesson; read it first) and write them as "looked at".
5. Expected effect on the pixel check: the remaining 517 px at 1440 (donut edges, line labels) should go to near 0 once `m-play` is not fixed. Verify with `npm run check:pixel -- /trends`.

## Numbers to compare against (check:pixel -- /trends, after #134)

1440 full 517, picker 1 553, hover 469, night 530. The 390 screens are the known two-valued result (full 254 or 2 327, night 2 381 or so) from the static page's `centerTabs` race; still undecided whether to fix `shell.js` or make the check handle it.

## Decisions and who made them

The user's own: "go" for U5, "merge then u6", everything in earlier handoffs.
My calls, listed in the PR bodies for the user to confirm: `$160k` escaped by key in the messages converter; one global message merge (six `home.*` keys); `state.failed` text on the error state; `?header=v1` not ported; "Προφίλ" opens the static table of pages; `data-*` attributes moved out of `nuxt.config.ts`; the `check:pixel` change; `node --test` instead of vitest.

## Gotchas (new)

- `@vueuse/core` is not auto-imported (no `@vueuse/nuxt`): import `useEventListener`, `useMediaQuery` explicitly.
- Exports of `app/stores/*.ts` are auto-imported by name (`THEMES`, `FONTS`, `USER_KEY`, `pickPref`): do not give them generic names.
- The head config of `nuxt.config.ts` overwrites `<html>` attributes set in JS after mount.
- Node tests can import `app/stores/*.ts` only if the file has explicit imports (`ref`, `defineStore`).
- `check:pixel` and `check:parts` need `npm run generate` first. Playwright scripts in the session scratchpad (`shell.mjs` is the whole shell check: drawer, focus, sign-in, gate, switches, phone drawer; it needs a temporary `app/pages/speeches.vue` for the gate and the build to be regenerated) are machine-local: `/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/cce41b79-7311-43b6-ab08-e36010c1b8bf/scratchpad/`.
- Not mine: PR #107 (giannisni) stays unmerged; `docs/prompts/2026-11-09-nav-icons/` is untracked and not part of this work. The merged local branches `claude/nuxt-spike`, `-app`, `-pixel-diff`, `-tailwind`, `-fixtures`, `-i18n` still exist; the user has not answered whether to delete them.
- This handoff is untracked until committed (on the U6 part 2 branch, as before).
