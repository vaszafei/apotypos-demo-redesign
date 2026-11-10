---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-10T20:30:00Z"
title: "Plegma world map: brainstorm, plan and U1 prototype done; U2 to U4 next"
summary: "The Plegma plan (one fixed map, search flies to a story or theme, Orbit cards replace the chart pages) is written and doc-reviewed, and its flight/layout prototype U1 was judged by the user; the build has not started."
keywords: ["plegma", "hero", "world-map", "nuxt", "ce-plan", "prototype", "U1", "handoff"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Continue in a fresh session: build U2, U3 and U4 of the Plegma plan on a new branch, using the U1 decisions"
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "845241736ed44ba5d26a3871a5922fb530f2fd52"
branch: "claude/plegma-prototype"
head: "96812c35a8d7ce4d25796ee563efe4ec0f4f97b9"
---

# Handoff 2: Plegma world map after U1

Supersedes `handoff.md` in this folder (a shorter note written minutes earlier; this one adds the decision provenance and the traps). Nothing is pushed and there is no PR. The plan's Goal Capsule says: stop and ask when a unit needs the user's judgment, merge only on the user's word.

## What the user wanted (their words are quoted in the plan's Key Decisions)

Make the home hero background, which the user calls the "Plegma", the way into stories and themes: picking one in search flies the camera to its web, with floating cards and visual links to related stories. Today's hero is `docs/redesign/prototypes/assets/hero-field.js` (canvas, static page). Home is not ported to Nuxt; search, story and topic pages are.

## What exists now

- `claude/plegma-prototype` (3 commits on `main` 0666383, local only): the plan, the U1 prompt, the U1 report, handoff 1. Checkout otherwise clean except untracked files that are not mine (`docs/prompts/2026-11-09-nuxt-app/handoff-7.md` to `handoff-12.md`, `docs/prompts/2026-11-09-nav-icons/`). Leave them.
- **Plan** `docs/plans/2026-11-10-1628-feat-plegma-world-map-plan.md`: brainstorm requirements R1 to R16 (user-confirmed), KTD1 to KTD14, units U1 to U10, verification contract, definition of done. Doc-reviewed by four reviewers and corrected. Read its Goal Capsule, the Key Decisions (they quote the user), then the unit you build. U1 is done; U2 to U10 are not started.
- **U1 report** `docs/prompts/2026-11-10-plegma-prototype/report.md`: the user's picks, the measurements, and what the prototype showed that the plan did not know. It governs where it differs from the plan text; I did not edit the plan body.
- **Prototype** (machine-local, gitignored): `.context/compound-engineering/ce-prototype/2026-11-10-plegma-flight/01-flight-and-layout/` with `screens/001-plegma.html` (real fixtures, hero drawing code, canvas 2D) and `strips/` (the screenshots the user judged). Useful as a reference for the world code and camera maths (`pose()`, `fit()`, `place()`, `web()`); do not copy it into `web/app/` as is.
- Memory: `project-plegma-world-map.md` in the project memory folder.

## Decisions and who made them

- **The user chose** (their words in the plan): the Plegma view replaces the story and theme chart pages; one fixed world map (reversing their 2026-11-06 rule); Home framed on "the best of the latest week"; Orbit layout with the web top-left (written with a question mark); actions = outlets, step days, compare, arc to a same-theme story; a story with no theme gets NO arcs ("No arcs for them").
- **The user chose in U1:** flight "pull back and dive"; layout A seeded spread (first day across); cards arrive after landing; map region smaller than the 56% × 56% drawn.
- **My calls, not the user's** (all listed in the plan or report): selecting a web works anywhere including Home; day stepping shows the story as of that day; themes beyond the donut's colours stay ink (R4 wording); 600 articles for a full 32-dot web; arcs among a theme's 25 largest stories; map region about 50% × 50%; a far-apart compare shows a marker, not a second web; Home sections ported to Vue with pixel parity below the hero only.

## Facts a fresh agent would get wrong

- The stories fixture (`web/public/data/stories.json`, generated, gitignored) has two blocks: days 0 to 60 (1 Aug to 30 Sep) and 74 to 87 (14 to 27 Oct). Nothing exists for 1 to 13 Oct. 252 stories "start" on day 0 and 368 on day 74 only because the blocks are clipped; U2 must smear those back (see the report).
- All 2,453 stories from 1 October have theme «Άλλα» and no stance, framing or section data, so the newest third of the map, and so everything Home frames, shows plain webs, no theme colour, no arcs, and cards for days, outlets and related stories only.
- `PER = 32` in `hero-field.js` is dots per web, not articles per dot. The plan's KTD5 states this correctly.
- A story's peak day moves while it runs; its place uses the first day (KTD4).
- Nuxt auto-imports every `export const` in `web/app/utils/`: prefix constants per page (`docs/prompts/2026-11-09-nuxt-app/handoff-12.md`, gotchas).
- The user cannot open localhost URLs from this machine: send screenshots (they asked for exactly that). The ce-prototype helper and any `http.server` I started are stopped.

## Verification so far

U1 only: no console errors in headless Chrome runs; at 1× CPU every case held about 17 ms per frame; at 4× Home idle was 33 ms against 17 ms for the static hero and a flight into the 667-story theme dropped 22 of 66 frames (table in the report). No test, typecheck or build was run: nothing in `web/` has changed.

## Plausible next step (one path)

Branch from `main` (`claude/plegma-stage`), build U2 (layout generator in `web/scripts/` called from `web/scripts/sync-prototype.mjs`), U3 (`web/app/utils/plegma-world.ts`, `plegma-camera.ts`, `home.ts`, with vm tests against `docs/redesign/prototypes/assets/home.js`) and U4 (the stage in `web/app/layouts/default.vue`), with a draft PR early and the user's screenshots; then Home (U5, U6), the views (U7, U8), flights and compare (U9, U10). The user's earlier workflow rule: small commits, Netlify preview, no CE review loop on prototypes, merge only on "lets merge" via `gh api -X PUT .../merge` (`gh pr merge` fails here), `--body-file` for PR bodies.

Open questions for the user (none blocks U2): the exact map region size; whether the 4× CPU frame rate is acceptable once a cached layer is in; the older open items in `handoff-12.md` (English first frame, local `claude/nuxt-*` branches to delete).

Skills that fit: `nuxt-component`, `find-similar-component` (check `web/app/components` before creating one), `ce-work` for the units, `ce-prototype` only for a new feel question.
