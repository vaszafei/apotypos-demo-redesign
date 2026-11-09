# Report: prerender the Nuxt pages (`ssr: true`)

Branch `claude/nuxt-ssr`, stacked on `claude/nuxt-motion` (PR #135 was still an open draft). Plan KTD11 is changed: the build is prerendered.

## What `ssr: true` broke, and the fix

| What | Found by | Fix |
|---|---|---|
| `choose()` in `stores/prefs.ts` read `location` while the server built the page: 500 on `/trends` | `nuxt generate` | stores start with the prerendered defaults; `hydrate()` reads the visitor on `app:mounted` |
| `useTopics` called `usePeriodStore()` after an `await`: no Nuxt context on the server | `nuxt generate` | the store is taken before the await |
| The fixtures (`public/data/*.json`) answered 404 while prerendering, so `/trends` was built in its error state (30 KB, `data-state="error"`) | the HTML of `.output/public/trends/index.html` | `server/routes/data/[file].get.ts` reads them from `nitro.serverAssets`; the page is now 88 KB and `_payload.json` 50 KB (home.json 28 KB + overton.json 13 KB) |
| `Teleport to="#page-actions"` (the date picker) is not written by Nuxt: missing from the first frame and "Hydration children mismatch" | Vue warning in `nuxt dev` | `plugins/page-actions.server.ts` + `server/plugins/page-actions.ts` write it into the prerendered head |
| Theme, font, icons, sign-in and language are the visitor's, not the build's | reading the code | inline head script (`utils/visitorScript.ts`) sets `data-theme/font/icons/signed-in/lang-pending` and `m-intro` before the first paint; `assets/css/ssr.css` hides the signed-out parts and, for an English visitor, the Greek text until the language is switched |
| `?theme=terra&lang=en` ended as paper/Greek: the language switch navigates and drops the query before the prefs hook read it | `states.mjs`, then a `history.replaceState` trace | the query string is captured at plugin setup |
| The arrival slide: Chrome aborted it ("ViewTransition opt-in disabled") whenever the prerendered page was revealed early, and the app's `pagereveal` listener was added after the reveal | `arrive.mjs`, `bisect.mjs` | see below |

## The arrival slide

- Reveal time decides it. `bisect.mjs`: static media scrolled 1400 px, click Θέματα, N runs each, how many slid:
  - the prerendered page as built: 3 of 10 (slid at 159-214 ms, aborted at 43-76 ms)
  - with `while (performance.now() < 100)` in the head: 9 of 10
  - with 150: 16 of 16; with 200: 16 of 16
  - `blocking="render"` module scripts (async and not), and `rel=expect` released by a timer: 3 of 8, 1 of 8, 1 of 8. They do not hold the first frame.
  - the static page: 6 of 6 (its scripts draw it at 150-214 ms).
- So a move that is pending (same test as `assets/page-move.js`) keeps the parser busy until 150 ms after the navigation began (`MOVE_HOLD` in `utils/visitorScript.ts`). A page opened directly does not wait. This is a measured workaround on localhost; on a real network the response is later anyway. **Not measured on Netlify, Safari or Firefox.**
- The `pagereveal` listener is text in the head (`utils/arrival.ts`), not a plugin: the browser reveals the page before the entry module runs (first try: `data-vt` stayed unset on arrival). It is text and not a function sent with `toString()` because the build replaces `document` and `window` with `(void 0)` in server code.
- Real app, 16 runs: 16 of 16 slid.
- Looked at, with CDP `Animation.setPlaybackRate` 0.08 (`frames.mjs`): static media scrolled 1400 to Θέματα (frames at 350 and 900 ms), Back to media, Forward to Θέματα. Both pages are visible mid-slide, the old one moving up and fading, the new one coming from below, the date picker in the new head, the sidebar "/" on Θέματα. Logged: `data-vt=down old-y=-336px` on arrival, `up` on Back, `down` on Forward. I did not look at a phone width, at a section move into a Nuxt page (no static link leads to one yet) or at several runs of each frame.

## Checks (commands and results)

- `npm test`: 52 of 52 (new: `scripts/visitor-script.test.mjs` runs the head script against a stand-in browser: defaults, query/stored/unknown values, signed-in, English pending, `m-intro`, the move hold, and the arrival cases; `session-store.test.mjs` now expects a signed-out store until `hydrate()`).
- `npm run typecheck`: clean.
- `nuxt dev`, `/trends` and `/trends?theme=night&lang=en`: no Vue warnings.
- `states.mjs` on the built site, anonymous / night+inter+icons+signed in+English / `?theme=terra&lang=en` / bad stored values, at 1440 and 390: no console error or warning; the first frame has the right theme, font, icons, signed-in mark and the content drawn; after hydration the store and the page agree; stored values are written as before.
- `npm run check:pixel -- /trends`, three runs: 1440 is 0 on all four screens every time. 390 is the same two-valued race as before (0, or 2 073 px at rows 93-104 on the day theme and 2 137 px on night), unchanged by this work.
- Motion on the built site: lines draw in (`m-play`, stroke offset 1 px to 0), `m-intro` is gone by 80 ms, with reduced motion there are no `m-play` classes; each period preset replays the lines card; no console errors.

## Not done / open

- English: a visitor who wants English sees an empty shell until the language is switched (about one frame after hydration) and the first HTML is Greek. `/en/...` URLs would remove that but change KTD4 and every link; not done, the user has not been asked.
- The 150 ms hold is a busy wait. Open question: keep it, or tolerate a slide that fails in some runs.
- The 390 tab-bar race (`centerTabs` in the static shell) is still unresolved.
- `/200.html` (the SPA fallback of `_redirects`) is still generated; unknown paths load it and the client router decides. Not checked on Netlify.
- A move from one Nuxt page to another (same document) was not touched and not re-tested: only one page is ported.
- Sign-in gate: no ported page is gated yet, so only the rules in `ssr.css` exist (`html[data-signed-in] .gate` hidden); not exercised.
- Merged local branches `claude/nuxt-spike`, `-app`, `-pixel-diff`, `-tailwind`, `-fixtures`, `-i18n`, `-shell-session` are not deleted.
