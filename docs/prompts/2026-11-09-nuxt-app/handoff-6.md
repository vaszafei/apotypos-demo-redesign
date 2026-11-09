---
artifact_contract: "ce-handoff/v1"
title: "Nuxt app migration: U6 part 2 is draft PR #135; next U7 after the user's decision on the slide into Nuxt pages"
summary: "Motion and the page slide are done and measured on claude/nuxt-motion (#135, draft). 1440 pixel diff is 0. A move from a static page into a Nuxt page is skipped because the first frame cannot be held on a static host."
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
repository: "vaszafei/apotypos-demo-redesign"
branch: "claude/nuxt-motion"
head: "8e9c2c1"
---

# Handoff 6: U6 part 2 in review (#135)

Supersedes the State and "Next" of `handoff-5.md`; its Gotchas and Working style still hold. Numbers, the five failure modes and what was tried are in `report.md`, section "U6, second pull request".

## State

- `claude/nuxt-motion` is pushed, draft PR #135 against `main`. Merge only on "lets merge" (`gh pr ready 135`, then `gh pr merge 135 --merge`). The user has not looked at it.
- Done: `plugins/motion.client.ts`, `plugins/view-transition.client.ts`, `utils/move.ts` (+ `scripts/move.test.mjs`), `DashCard` without `m-play`/`delay`, `$motion.replay` on a new period in `trends.vue`. Pixel diff at 1440: 0 on all four screens. `npm test` 40/40, typecheck clean.
- Not started: U7 (global search, plan after U6), then U8 to U17. The user picks the order of U9-U15.

## Decisions waiting for the user (ask, do not decide)

1. A move from a static page into a Nuxt page is skipped (no slide, no error). Cause: `ssr: false` draws the page after the first frame, and only a pending request holds a frame; a dynamic `<style blocking=render>`, a TLA module script and `rel=expect` released by a timer do not (test scripts in the machine-local scratchpad below). Options: prerender pages into the HTML (changes KTD11) or accept it. Nuxt to static slides.
2. The 390 tab-bar race of the static page: fix `centerTabs` in `shell.js` or make `check:pixel` tolerate it. 390 results are 0 or 2 073 (night 0 or 2 137).
3. Delete the merged local branches `claude/nuxt-spike`, `-app`, `-pixel-diff`, `-tailwind`, `-fixtures`, `-i18n`, `-shell-session`? Asked twice, no answer.

## Gotchas (new)

- Nuxt's `NAV` in `composables/useNav.ts` is a partial copy of the static NAV (no people "spread", no world sub-pages); the slide order depends on it.
- The tool's rm-safety check sometimes rejects a Bash command that has no `rm` (a heredoc with python or node); write the file with the Write tool and run it separately.
- `import { NAV } from '../composables/useNav.ts'` needs the `.ts` extension for `node --test`.
- Machine-local test scripts: `/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/4e2db0fc-ec1a-4ab9-a714-d6916d273a95/scratchpad/` (`srv.mjs` serves `.output/public` with the Netlify rules, `cross.mjs` cross-document moves, `spa.mjs` needs temporary second ported pages, `motion.mjs`, `period.mjs`, `holdtest3.mjs`).
- Untracked and not mine: `docs/prompts/2026-11-09-nav-icons/`. #107 (giannisni) stays unmerged.
