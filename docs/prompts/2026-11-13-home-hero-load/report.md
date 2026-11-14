# Report: Home hero disappears and comes back on load

## What the user saw
The name «ΑΠΟΤΥΠΟΣ», then the tail next to it, then both gone for less than a second, then back.

## Cause
`web/app/plugins/motion.client.ts`, `enterPage()`: the page entrance animates every block of `#content` from `opacity: 0` (`el.animate(..., { fill: 'backwards' })`, 360 ms). It was written for the static prototype, where scripts drew the page. Since `ssr: true` the page is already on screen, with the masthead's own CSS animation running (name at 150 ms, tail at 1100 ms). When hydration is done (`page:finish`, about 1.1 s in headless at 4x CPU) the entrance starts on `section.home-hero` and `section.home-today`, so the whole hero (name, search, chips, stats) goes back to transparent and fades in again.

## How it was found (headless Chrome, motion on, no GPU)
- Screencast frames of `/`, dark pixels counted in the masthead band and the search box per frame: the search box is seen, then gone for 4-5 frames, then back (x4 CPU: frames 70-74; x1 CPU: 16-19).
- Not the cause: the masthead's own animation (same node, opacity only goes up), hydration replacing nodes (none removed), the stage (`.plegma-stage` hidden by CSS: still blank), `m-intro` (hides only the stat numbers), view transitions (none on a plain load).
- No JS (all `_nuxt/*.js` aborted): no blank. So script-driven.
- `document.getAnimations()` listed during load: at 1093 ms `Animation` (no CSS name, dur 360) on `section.home-hero` and `section.home-today`.
- Proof: with `Element.prototype.animate` made a no-op for `#content > section`, blank frames: none at x1 and x4.

## Fix
`motion.client.ts`: `onScreen` = `nuxtApp.payload.serverRendered === true`; the first intro skips `enterPage` when it is true, then sets it to false. A page the client draws itself (no prerender) still gets the entrance. Cards' first view (charts grow, bars fill) is not touched.

## Results (real build, `npm run generate`)
| check | before (main) | after |
|---|---|---|
| blank frames of the search box, x1 / x4 / x6 CPU | 4 / 5 / - | none / none / none |
| entrance animations on `#content` blocks at first load of `/` | `home-hero`, `home-today` | none |
| `check:load` `/` `/media` `/stories` (x4) | - | shift 0.000 / 0.010 / 0.000 (limit 0.05) |
| `npm test` | - | 174 pass, 0 fail |

## Not checked
- The user's own browser; Netlify preview not looked at yet.
- The same entrance also ran at the first load of every other prerendered page (`/media`, `/stories`, ...); the fix covers them, but only Home was measured frame by frame.
- A client-side move to `/groups` plays no entrance on `main` either (measured), so it is unchanged; why was not looked into.
- Safari/Firefox untested.
