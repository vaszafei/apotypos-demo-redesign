Continue issue #2, PR 4 (U7–U10): the shared parts A–F and the report frame. This is the last PR of the issue.

Start here:
1. Read the memory file project-issue2-part2-handoff.md and the plan docs/plans/2026-11-03-1145-refactor-shared-cards-charts-parts-plan.md (units U7–U10, KTD6, KTD7, KTD8).
2. Read docs/solutions/ before planning. These apply: workflow/shared-asset-change-checklist.md, workflow/check-class-names-against-shared-css.md, workflow/checks-must-sign-in-for-gated-pages.md, workflow/pr-and-merge-flow.md, conventions/theme-tokens-only.md, conventions/layout-requests-are-literal.md.
3. Save this prompt to docs/prompts/<today>-shared-parts/prompt.md. At the end write report.md there with the real commands and measurements.

State: PRs #101, #102 and #103 are merged (U1–U6). Cards, stat cards, chart rules and the contrast decision are done. The user kept the group colors, and the exceptions are in issue #2 and in the check.mjs header. Work from main on a new branch claude/shared-parts. Issue #2 stays open until this PR merges.

What to build (all in assets/parts.js, assets/parts.css, assets/messages-parts.js, loaded by pages.html only):
- U7: A summary callout (sum-), B method and limits block (method-), E headline and quote list (quote-), F filter chips and dataset switch (fchip-).
- U8: C period control with a volume brush (brush-; reuse assets/date-range.js), D entity × entity heatmap table (hmx-; one Dash.seq scale, masked small cells).
- U9: the report frame (frame-): back arrow, title, "open alone" link, the document below; use reports/france-riots/ as the sample.
- U10: report.md, tick the issue checklist against evidence, one lesson with /ce-compound, and "Closes #2" in the PR body.
- Each part appears on pages.html with sample data, in both languages. No part goes on a real page.

Rules that matter:
- Follow the CLAUDE.md loop: /ce-plan (a short plan check against the existing plan, wait for my approval), /ce-work in small iterations, /ce-code-review, /ce-compound.
- pnpm is broken on this machine. Run node docs/redesign/prototypes/scripts/check.mjs and node docs/redesign/prototypes/scripts/visual-check.mjs --themes paper,night from web/. visual-check now signs in. Any script you write that loads all pages must also set localStorage proto-user=lolovios.
- Search the shared CSS for each class name before you use it. Use the prefixes of KTD6.
- Bump ?v= for every shared asset you change, on all pages that load it.
- Prove no page moved by comparing .dcard and .dstat boxes on main against the branch, signed in, at 1920, 1440, 1100 and 390 px, in paper and night. Test the comparison on a tampered copy first.
- Use only existing type sizes, tokens and controls. Chart text is 12px or more.
- Say plainly which widths and themes you looked at and which you only measured.
- Do not merge until I say "lets merge". Update PR bodies with gh api -X PATCH, not gh pr edit.
- If the context goes above 70%, write a handoff with /ce-handoff in the prompt folder and stop.
