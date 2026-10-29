# apotypos demo redesign

A static Nuxt app (`web/`) that serves the redesign prototypes (`docs/redesign/prototypes/`). See `README.md`.

## Compound Engineering workflow

The project plugins are in `.claude/settings.json`: compound-engineering and mattpocock-skills. Claude Code asks to install them when you open and trust the folder.

For each task, use this loop:

1. `/grill-with-docs` (mattpocock-skills): agree on the goal and the terms before you plan.
2. `/ce-plan`: make the plan. Show it and wait for approval.
3. `/ce-work`: do the approved plan, in small iterations.
4. `/ce-code-review`: get a review from an agent that did not write the code.
5. `/ce-compound`: record the lesson in `docs/solutions/`.

Rules:

- The plugin writes under `docs/` (`brainstorms/`, `plans/`, `solutions/`). Do not move these folders.
- Read `docs/solutions/` before you plan. A past lesson may apply.
- One branch per task, `claude/<short-name>`. One pull request per branch.
- If the work runs in a new session, save its prompt in `docs/prompts/<YYYY-MM-DD>-<short-name>/prompt.md` first. At the end, write `report.md` there with the real results (commands and measurements, not plans).
- If the context goes above 70%, write a handoff with `/ce-handoff` in the prompt folder and stop.
- If your work conflicts with a recorded decision, tell the user. Do not override it silently.
