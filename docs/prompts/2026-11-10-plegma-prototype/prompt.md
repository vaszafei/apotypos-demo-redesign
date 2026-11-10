# Prompt: Plegma flight and layout prototype (U1)

Source: `docs/plans/2026-11-10-1628-feat-plegma-world-map-plan.md`, unit U1. Throwaway prototype; run through ce-prototype, not ce-work.

## Question

How should the Plegma (one fixed map of all stories) fly from Home's framing to a story whose web sits at the top-left of an Orbit of floating cards, and to a same-theme neighbour? Which vertical placement rule makes the map read well, with the first day of a story across the map (KTD4)? How do four headline cards arrive?

## Also settle with the user

- Size of the map region (KTD14).
- The article count that maps to a full 32-dot web (KTD5).
- How many stories of a theme get arcs between them (KTD14).
- The framing of a theme with hundreds of stories (issue 4 has 667) and of a compared pair that lies months apart.

## Constraints

- Real data: `web/public/data/stories.json` and `storyDetail.json` (7,515 stories; 2,453 from 1 October have theme «Άλλα» and no stance data).
- The hero's drawing code (`docs/redesign/prototypes/assets/hero-field.js`) is the base; canvas 2D.
- Theme is colour and arcs; outlets never appear on the map; a story with no theme has no arcs.
- Measure frame time idle and during a flight at 1× and 4× CPU, against the static hero.
- The user judges with screenshots and frame strips in chat (they cannot open localhost ports).
- Prototype code stays out of `web/app/`. Report in `report.md` here.
