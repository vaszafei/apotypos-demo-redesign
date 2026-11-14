# Report: Home still a little stuck at the first open

## What the user said
After PR #164: "the situation improved, but it's still a little stuck when we open first time". No screenshot; "first time" read as a cold load (nothing cached). That reading is mine.

## Found (real build, headless Chrome, no GPU)
- `/_payload.json` of Home was 1.7 MB (468 KB gzipped). Cause: `HomeHero` fetched `stories.json` with `useLazyFetch` only for the story count («7.491»); the prerender put the whole file in the payload. Nuxt waits for the payload before it hydrates.
- Hydration was one 800 ms task at 4x CPU (`RunMicrotasks`, mostly `__asyncHydrate` and mounts).
- The headless frame rate is about 15 fps on every page, also `/media` and `/stories` (no stage). It is not a signal for Home.

## Change
- `HomeHero.vue`: `useAsyncData('fixture:stories-count', …, { transform })` keeps only the count in the payload. The prerendered HTML still says 7.491. Payload: 1.7 MB → 34 KB.
- `index.vue`: `<link rel=preload as=fetch>` for `stories`, `plegma`, `home`, so they start beside the scripts (the stage reads them).
- `HomeToday.vue` + `useFixture.ts` (`immediate` option): `storyDetail.json` (1.4 MB) starts after `stories.json` is in, so it does not share the connection with what the web needs.

## Measured (5 cold runs each, median; static server with gzip; main vs this branch)
| profile | web first drawn, main → branch | longest task, main → branch |
|---|---|---|
| fast network, CPU x2 | 1335 → 1250 ms | 297 → 186 ms |
| 10 Mbps / 40 ms, CPU x2 | 2001 → 2085 ms | 302 → 250 ms |
| 4 Mbps / 100 ms, CPU x4 | 4571 → 4381 ms | 768 → 387 ms |

The web appears about as early as before; the freeze during hydration is shorter (about 40 to 50 percent). `check:load` `/` `/media` `/stories` (x4): 0.000 / 0.010 / 0.000. `npm test` 174 pass. `npm run typecheck` clean. No console warnings on `/`.

## Not checked
- The user's own browser; whether this is the "stuck" they see. Safari, Firefox.
- `/media`, `/media/writing`, `/similarity`, `/stories` still carry payloads of 1.7 to 2.1 MB (same cause on other pages). Not touched.
- The remaining 190 ms task at x2 is hydration itself.
