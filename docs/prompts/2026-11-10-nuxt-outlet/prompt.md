# Prompt: Nuxt app, U9 outlet page

Continues `docs/prompts/2026-11-10-nuxt-group/` (#144 topic and #145 group are merged). Source: `docs/prompts/2026-11-09-nuxt-app/handoff-12.md`. The user said "go with recommend, we have to complete the media pages and tabs".

Goal: `/outlet?slug=` (`outlet-v2.html`, four tabs: overview, topics, stories, people) as a native Nuxt page, the last Μέσα page. The Mme cards of `assets/mme.js` 339 to 517 (`outletFacts`, `WeeklyAgenda`, `CoverageCard`, `StanceByTopic`, `EmphasisCard`, `VoicesCard`, `PortrayalCard`, `Headlines`) and `Spread.pairs` become pure code with tests and components. Then `outletHref` points to `/outlet?slug=`, and the link users follow.

Scope (the user's words, earlier): only entity pages that take the redesign become Nuxt pages; Αναλύσεις stay static. The pixel diff is a check, not a requirement; the current look stays until the redesign.

Process (memory `feedback-prototype-workflow-no-ce-loop`): branch `claude/nuxt-outlet`, small commits, early draft PR, merge only on the user's word (`gh api -X PUT .../merge`), `--body-file` for the PR body, report in `report.md`.

After the page: ask the user about the open items (English first frame, 150 ms hold off localhost, 390 tab-bar race, deleting merged local `claude/nuxt-*` branches, plan housekeeping, Netlify/Safari/Firefox checks).
