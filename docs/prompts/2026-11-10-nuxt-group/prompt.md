# Prompt: Nuxt app, U9 group page

Continues `docs/prompts/2026-11-10-nuxt-topic/` (the user merged #144). The user's scope for the rest of the migration: only the entity pages that take the redesign (group, outlet; story and topic are done) become native Nuxt pages. The Αναλύσεις pages stay static, they are not redesigned ("we dont need to make them to nuxt"). The pixel diff is no longer a requirement for these pages; it stays as a check. The user said "go with your recommendations": keep the current look until the redesign, order group then outlet.

Process (memory `feedback-prototype-workflow-no-ce-loop`): one branch `claude/nuxt-group`, small commits, early draft PR, merge only on the user's word.
