# Prompt: Μέσα › Ομοιότητα και πρωτοτυπία (2026-11-06)

Source: `docs/prompts/2026-11-06-stance-map/handoff.md`.

## User request 1

The tab: Μέσα › Ομοιότητα και πρωτοτυπία, route /similarity, file similarity-v2.html.
The task: analyze every card on the tab. Say what question each one answers, whether it is readable, and whether it has value. Then propose keep / redo / remove / move for each card. «Ποιος γράφει τα ίδια με ποιον» (the 24×24 matrix) is unreadable and confusing.
Open questions: what each card should answer, whether the originality cards stay together, whether the clickbait and bylines cards moved here belong on this tab. Ask before planning.

## User request 2 (after the analysis)

"remove what you propose, then for the redo, I want first to make a deep search on data and on web for best styling and display practices, with intelligent charts"

Proposed removals: the matrix «Ποιος γράφει τα ίδια με ποιον» and «Διάμεση καθυστέρηση» (the lag stays as a column of the originality table).
Proposed redos: «Ίδιος όμιλος ή όχι» (ring), the clickbait scatter (labels, and a move), the matrix slot (options A–D), pairs table.
Branch: `claude/similarity-cleanup`.
