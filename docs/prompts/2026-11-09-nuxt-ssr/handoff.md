---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-09T23:59:00Z"
title: "Nuxt app: switch to ssr true so the page slide works into Nuxt pages"
summary: "U6 part 2 is draft PR #135; the user decided the slide into Nuxt pages must work and ssr true is accepted, with everything it breaks fixed. Nothing of the ssr work is started."
keywords: ["nuxt", "ssr", "prerender", "view-transition", "pagereveal", "hydration", "KTD11", "U6", "#135"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "To continue: measure what ssr true breaks on /trends, fix each thing, restore the arrival slide in pagereveal. Ask first whether #135 is merged."
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "84524173"
branch: "claude/nuxt-motion"
head: "67337cb"
---

# Handoff: prerender the Nuxt pages (`ssr: true`) so the slide works

`handoff-6.md` in `docs/prompts/2026-11-09-nuxt-app/` has the migration state and gotchas; this file adds the new task. Numbers and what was tried are in `docs/prompts/2026-11-09-nuxt-app/report.md`, section "U6, second pull request".

## The user's decision

Said by the user in this session: "it has to slide, as nuxt is powerfull, so we have to do that, and if that requires ssr, we have to fix everything that true make." After I explained the cost they asked why not now, as more pages will come; I agreed (my reading: every later page would otherwise need fixing). They have not said where to work, in a fresh session or the old one; this handoff is for a fresh one. This overrides KTD11 of `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md` ("a single-page app like the static prototype"): update KTD11 there and say so in the PR.

## Current state

- PR #135 `claude/nuxt-motion`, HEAD `67337cb`, draft, mergeable and clean. The user has not looked at it and has not said "lets merge". It holds: `web/app/plugins/motion.client.ts`, `web/app/plugins/view-transition.client.ts`, `web/app/utils/move.ts` (+ `web/scripts/move.test.mjs`), `DashCard.vue` without `m-play`/`delay`, `$motion.replay` in `web/app/pages/trends.vue`. Pixel diff at 1440: 0 on all four screens; `npm test` 40/40; typecheck clean.
- Not started: all the `ssr: true` work, U7 and later. `main` is at `a6cdeb3`.
- Untracked, not mine: `docs/prompts/2026-11-09-nav-icons/`. This file is untracked too (nothing was committed or pushed for it).
- An attempt to save a prompt file, commit it and update the memory index was rejected by the user mid-way; none of it ran. No memory entry about the ssr decision exists yet.

## Why ssr, in one paragraph

With `ssr: false` Vue draws the page after the first frame. A move from a static page into a Nuxt page cannot slide, because `assets/page-move.js` holds the first frame and nothing can do that until Vue has drawn on a static host. Tested in Chrome with a page that logs at `ready` whether it was drawn: dynamic `<style blocking="render">`, module script with top-level await and `blocking="render"`, `rel=expect` released by a timer: none hold. A dynamic `<link rel=stylesheet blocking="render">` to a request that never answers does hold, but a static host has no such request to release. So `pagereveal` in `web/app/plugins/view-transition.client.ts` (end of file) now calls `skipTransition()` on every arrival; leaving a Nuxt page slides. With the page in the first HTML the first frame is already drawn.

## What `ssr: true` makes worse (my list from reading the code, not measured; measure each, fix each)

- **Per-visitor state is unknown at build time.** HTML is built Greek, paper theme, default font and icons, signed out. Set after load by `plugins/locale.client.ts` (`?lang=`, `localStorage['apotypos-locale']`), `stores/prefs.ts` + `plugins/prefs.client.ts` (`?theme=`, `?font=`, `?icons=`, `proto-theme`), `stores/session.ts` + `plugins/session.client.ts`, and the head config in `web/nuxt.config.ts`. Goal: no visible flash and no hydration warning. Likely tool: an inline head script that sets `data-theme`/`data-font`/`data-icons` before first paint, as the static shell does (check `assets/shell.js`).
- **Sign-in gate** on Αναλύσεις (`SignInGate.vue`, `gated` in `web/app/layouts/default.vue`): a signed-in user must not see it flash.
- **English.** i18n is `no_prefix` (one URL, both languages), so the prerendered text is Greek and an English visitor sees Greek first. If fixing it needs `/en/...` URLs, that changes KTD4 and every link: ask the user before doing it.
- **Browser-only code at render time:** `useMediaQuery` in `layouts/default.vue` (drawer `inert`), `matchMedia`, `sessionStorage`, `Intl` with the browser locale. Guard or move to `onMounted`. The two motion/transition plugins are `.client` and stay so.
- **Data in the HTML:** `useFixture` fetches `public/data/*.json`; the prerender must be able to read them, and the payload carries the data. Measure `.output/public/trends/index.html`.
- **Hydration mismatches** in `LinesChart.vue` / `TopicDonut.vue` (measured width, number and date formats).
- **Motion:** `m-intro` is added by the plugin, so with the page in the HTML the cards may show full charts before the class exists. The prerendered `<html>` may need the class.
- **`public/_redirects`** is written by `web/scripts/sync-prototype.mjs` with a last rule `/* /200.html 200` (SPA fallback); check it with prerendered routes and that `/topics-v2.html` still redirects to `/trends`.
- **Checks:** `npm run generate`, then `npm run check:pixel -- /trends` three runs: 1440 must stay 0; 390 is two-valued from the static page's `centerTabs` race (0 or 2 073; night 0 or 2 137), unresolved. Vue hydration warnings in the Chrome console count as failures.

## Restoring the slide (what the earlier version of `pagereveal` did, deleted before commit)

Read the kept move (`readMove` in `web/app/utils/move.ts`); count it when the navigation is a traverse (`navigation.activation.navigationType === 'traverse'`, a `pageshow` with `persisted`, or `back_forward` timing) or when `kept.nav` and `kept.href` is this page. A static link goes to the old URL of a ported page, which redirects to its route, so compare `new URL(href).pathname` with `/${page.html}` of `web/ported-pages.json` and the search string. `directionOf(kept.from, location path, isColumn)`; no direction: `skip(e.viewTransition)` (catches `ready`). Otherwise set `data-vt` and `--vt-old-y = kept.top - pageTop()` and clear both in `finished.finally`. Use `location.pathname` (trailing slash removed) for the current route, not the router: it is not resolved at the first frame. Delete the skip-always branch and its comment. The static shell's own side is `watchMoves` in `docs/redesign/prototypes/assets/shell.js` (about lines 795-840) and must keep working unchanged.

## Failed approaches not to retry

The four render-blocking holds above (and `<link rel=expect>` as in `page-move.js`: it only waits for the end of the parse). Also, removing the hold altogether makes Chrome abort the arrival transition ("opt-in disabled" error, `pagereveal` with no `viewTransition`).

## Verification to do (the slide was only measured, never seen)

Take a slowed mid-slide frame with CDP `Animation.setPlaybackRate` at 0.05 to 0.1 and look at it, for static to Nuxt scrolled 1400 px, Back and Forward, and a few runs of each (the lesson `docs/solutions/design-patterns/cross-document-view-transitions-on-script-drawn-pages.md` says some failures show only in some runs). Report measured against looked-at.

## Machine-local test scripts

`/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/4e2db0fc-ec1a-4ab9-a714-d6916d273a95/scratchpad/` (may be gone): `srv.mjs` (serves `web/.output/public` with the Netlify rules; update it if prerendered routes need different fallbacks), `cross.mjs` (cross-document moves: logs `pagereveal`, `ready`, `data-vt`, `--vt-old-y`, errors), `motion.mjs`, `period.mjs`, `spa.mjs` (needs temporary second ported pages: edit `web/ported-pages.json` and add `web/app/pages/<name>.vue`, revert both), `holdtest3.mjs`. Playwright runs through `playwright-core` from `web/` with `/usr/bin/google-chrome`. The Bash tool's rm-safety check sometimes rejects commands with no `rm` in them (heredocs with python or node): write the file with the Write tool and run it separately.

## Plausible next steps

One path: ask whether #135 is merged and whether to branch `claude/nuxt-ssr` from `claude/nuxt-motion` or from `main`; set `ssr: true`; run the build and Chrome console to see what actually breaks; fix each item; restore the arrival slide; look at the frames; report; draft PR early. Merge only on the user's "lets merge". Open questions the user has not answered: the 390 tab-bar race (fix `shell.js` or tolerate in `check:pixel`), and whether to delete the merged local branches `claude/nuxt-spike`, `-app`, `-pixel-diff`, `-tailwind`, `-fixtures`, `-i18n`, `-shell-session`.

## Working style

Branch `claude/<short-name>`, small commits, draft PR early, prototype workflow (not the CE loop), brief messages, commits end with the Co-Authored-By line from the session reminder, PR bodies with the Claude Code line, hand off again at 70 percent context. Skills that fit: `run` or `ce-test-browser` to look at pages, `nuxt-component` for components, `ce-debug` for hydration problems.
