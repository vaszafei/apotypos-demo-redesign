---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-14T23:00:00Z"
title: "ΟΗΕ port, part 1: /speeches hall is a Nuxt page (PR #168 open); Θέματα card, the Israel page and the checks are left"
summary: "PRs #166 (/groups) and #167 (Μέσα payloads) merged. PR #168 (claude/ohe-hall) has the hall of the General Assembly as the Plegma on /speeches, with tabs, region chips and three cards. Not merged; user has not seen it."
keywords: ["ohe", "speeches", "un-hall", "plegma", "nuxt-port", "pr-168"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Show the user the screenshots of PR #168, then Θέματα card (sunburst), Παλαιστίνη–Ισραήλ page, remaining checks"
repository: "vaszafei/apotypos-demo-redesign"
branch: "claude/ohe-hall"
---

# Handoff: ΟΗΕ hall

"User" marks the user's own words; the rest is my reading.

## User's words this session
- Wanted no more CPU-throttled tests ("just fix them"): media pages fixed by size + screenshots only (#167).
- "go with ohe": defaults I proposed — Israel attackers = version A, stat cards stay, Greek names by a translation, story page skipped (user did not answer the story-page question; treated as dropped).
- Merges only on the user's word ("merge and continue" merged #166 and #167).

## State
- main = 35f7414 (#166, #167 merged). Branch `claude/ohe-hall`, 2 commits, pushed, PR #168 open, not merged.
- Built: `web/app/utils/un-hall.ts` (countries, seats, layouts, `unIsraelLayout` ready), `un-countries.ts` (Greek names), `components/un/UnHall.vue`, `UnSpeechList.vue`, `pages/speeches.vue`, `useNav.ts` world tabs with sub-tabs, `layouts/default.vue` nested sidebar, `ported-pages.json` (+/speeches), `politics.css` added to the global sheets, new `un.*` texts in `docs/redesign/prototypes/assets/messages-politics.js`, CSS at the end of `plegma.css`, tests `scripts/un-hall.test.mjs`.
- Verified: `npm test` 181 pass, `npm run typecheck` 0, screenshots of hall + 3 tabs at 1918x960 (scratchpad, machine-local).
- Not checked: the user has not seen it; English UI; 1440x900; phone; Safari/Firefox; reduced motion by eye; hover tooltip; click on a card to toggle on a real pointer.

## Left (in this order, small commits)
1. Θέματα card: the old agenda sunburst (`Dash.Sunburst` in `docs/redesign/prototypes/assets/dash.js`; no Nuxt version exists) next to the Θέματα tab; the region heatmap card is dropped (user: regions are the chips).
2. `/un-israel-palestine` page: `speeches`-like page using `UnHall` with `israel` set and tab `attacks`; cards from `un-israel-v2.html` (stat cards 184 min / rank 3 / 50 / 3 stay; donut and table; Israel attacks: 48 from 19 leaders in data vs 50 from 21 on the static card, cause not found). Add to `ported-pages.json` and drop the static link in `useNav.ts` children.
3. Ask the user for the screenshots' verdict before polishing; look at the hall size (it is ~520 px wide in a 650 px column).
- Known rough edges: Greece card chips «Cyprus»/«Greece» stay English (as on the static page); `UnHall` sets dot attributes imperatively, the SSR page renders it in `ClientOnly`; hall labels may overlap (Ισραήλ / Ιράν seats are adjacent).

## Constraint to tell the user
`docs/prompts/2026-11-09-nuxt-app/handoff-12.md` said Αναλύσεις stays static; the user's newer word changes that for ΟΗΕ only.
