# Prompt: build the Nuxt app (U1 onward)

The user approved the migration plan `docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md`. Read `docs/prompts/2026-11-09-nuxt-app/handoff.md` first, then the plan (Goal Capsule, KTD1 to KTD13, the unit table, U1).

Start U1: put the Nuxt app in `web/` and serve both worlds (the Nuxt pages and the not-yet-ported static pages). Before you start, ask the user two things: npm instead of pnpm in `web/` (default npm), and whether to close PR #128.

Rules: the design must match the static HTML exactly (pixel diff). Work on branch `claude/nuxt-app`, make small commits, open a draft PR early, and merge only after the user says "lets merge". At the end of each pull request, write `report.md` in a `docs/prompts/<date>-<name>/` folder with real commands and measurements. If the context goes above 70%, write a handoff with `/ce-handoff` and stop.
