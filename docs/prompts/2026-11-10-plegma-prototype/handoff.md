---
artifact_contract: "ce-handoff/v1"
created_at: "2026-11-10T20:00:00Z"
title: "Plegma world map: U1 prototype done, U2 onward next"
resume_focus: "Build U2 (world layout generator) then U3 and U4 of the Plegma plan on a new branch, using the U1 decisions"
branch: "claude/plegma-prototype"
---

# Handoff: Plegma world map, after U1

State: `claude/plegma-prototype` holds the plan (`docs/plans/2026-11-10-1628-feat-plegma-world-map-plan.md`), `prompt.md` and `report.md` of U1. Nothing is pushed, no PR. `main` is `0666383`. Untracked files from before this work (handoffs 7 to 12, `docs/prompts/2026-11-09-nav-icons/`) are not mine; leave them.

The user judged U1 from screenshots and chose: flight = pull back and dive, layout = A seeded spread, cards arrive after landing, map region smaller than the drawn 56% x 56%. Read `report.md` first: it lists what U2 to U4 must change against the plan's text (it governs where it differs):

- U2: the stories fixture has a 13-day gap (1 to 13 Oct) and two clipped blocks; a story whose first day is the first day of a block (day 0, and `dbCovered[0]`) is smeared back up to six days by its seed. Vertical rule is the seeded spread, no bands.
- U3/U4: dive flight; frame a big theme on its ~25 largest stories; a far compare shows a marker, not a second web (U10); draw with a cached layer for still dots so 4x CPU holds (Home idle was 33 ms vs 17 ms for the static hero).
- U7: cards arrive after landing, 120 ms apart, 380 ms each; map region about 50% x 50%, to confirm in the first screenshot.

Process: the user stopped the CE loop before ("no CE loop"); they wanted small commits, an early draft PR, a Netlify preview and their screenshots, merge only on "lets merge". The user cannot open localhost ports I give them: send screenshots. Next phase = U2, U3, U4 (one PR, `claude/plegma-stage`), then Home (U5, U6), views (U7, U8), flights and compare (U9, U10).

The prototype (`.context/compound-engineering/ce-prototype/2026-11-10-plegma-flight/`) is gitignored and machine-local.
