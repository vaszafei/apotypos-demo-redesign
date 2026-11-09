# Report: Nuxt spike (Θέματα)

Branch `claude/nuxt-spike`, folder `nuxt-spike/`, draft PR #128. Nothing in `web/`, the prototypes or Netlify was changed.

## Version 2: the same design

The first version used Nuxt UI + Tailwind and did not look like the prototype (the user saw it and asked for exactly the same design). Version 2:

- The design is the prototype's own CSS, copied byte for byte into `nuxt-spike/public/assets/` (`tokens`, `app`, `dash`, `mme`, `date-range`, fonts, logo). The same `<html>` attributes (`data-theme`, `data-icons`, `data-font`, `data-header="v2"`).
- The markup of the shell, the cards and the charts is the same, written as Vue components with the same class names: `layouts/default.vue` (drawer, header bar, section nav, page head, footer with the theme, icon and font switches), `DashCard`, `TopicDonut`, `LinesChart` (same layout arithmetic as `Dash.LinesChart`, same `smoothPath`), `BarList`, `DateRange` (the prototype's picker, ported), `ChartTooltip` (the white tooltip), `AppIcon`.
- **Tailwind and Nuxt UI are removed** (`npm uninstall`). Their reset and component styles change the look, and no part of this design needs them. This is a change from what the user first asked for ("nuxt ui ... tailwind"); say so before any decision.
- Page transition: the prototype's view transitions (CSS in `app.css`) on the Vue router: `experimental.viewTransition` + `plugins/view-transition.client.ts` sets `data-vt` (direction from the order of the navbar and the sidebar, as `shell.js` does).
- Stack: Nuxt 4.6, Vue 3 `<script setup lang="ts">`, Pinia (`period`, `tooltip`), `@vueuse/core`. Data as JSON in `public/data/`, loaded with `useFetch`. `ssr: false` like the static page.

## Measured (Chrome, local static servers)

Pixel comparison of the Nuxt page against `topics-v2.html` (signed out), pixels that differ by more than 24 of 255 in a channel difference:

| Screen | Same size | Different pixels |
|---|---|---|
| 1440 full page, paper | yes | 162 of 1 836 000 |
| 1440 date picker open | yes | 103 of 892 800 |
| 1440 hover on the lines (tooltip, rule, dots) | yes | 0 of 404 800 |
| 1440 night theme, full page | yes | 1 761 of 1 836 000 (not looked at) |
| 390 full page | yes | about 2 200 of 821 340: the tab bar is scrolled 1 to 2 px differently (seen in a crop) |

Picking 10–20 Aug in the picker and applying gave the same label and the same donut total (28.821) in both. No console errors, no horizontal overflow at 1440 and 390.

| | Nuxt | Static |
|---|---|---|
| First load at 1440, bytes (servers do not compress) | 559 KB, 28 requests | 630 KB, 21 requests |
| JS gzip | 108 KB (`_nuxt/*.js`) + 16 KB topics + shifts JSON | 121 KB (11 scripts and 2 data files, gzipped one by one) |
| Time to network idle + a fixed 1.2 s wait | 2.35 s | 1.99 s (Nuxt boots the SPA, then fetches the data) |
| Own code of the port | 803 lines of Vue/TS (shell, 8 components, 2 pages, 2 stores, plugin, composables) | the page 196 lines + shared `dash.js`, `components.js`, `shell.js`, `date-range.js` (not counted) |
| `nuxt typecheck` | passes | n/a |

Page change Θέματα → Ιδιοκτησία (click until the new card title is in the page), median of 7:

| CPU | Nuxt | Static |
|---|---|---|
| normal | 250 ms | 238 ms |
| 4× slower | 717 ms (452–1304) | 1898 ms (1475–1990) |

**Caveat:** the Nuxt Ιδιοκτησία is a stub with no chart; the static one is the real page. So this shows the shell stays mounted and the cost grows less on a slow CPU, but it is not a like-for-like test. The view transition fired (`data-vt` = `up` for a tab move, as in the prototype).

## Not done / not checked

- The slide of the old page keeps no `--vt-old-y` (a scrolled page starts its slide from its top, not from where it was seen). The prototype sets it.
- The `m-move` first-frame hold of `page-move.js`, the search, the sign-in, English, the other themes by eye (night was only diffed), Safari, the phone drawer by eye, keyboard use of the picker.
- Routes that are not ported (`/fingerprints`, `/media`, …) show the Nuxt 404 and a view-transition error in the console.
- A real second page with a chart (Ιδιοκτησία) for a fair page-change test.
- `rm` of the old files from version 1 was refused by the safety check; `app/assets/css/*.css` are now empty placeholders, and the unused version-1 components were overwritten. Delete the two CSS files by hand if wanted.

## Reading

- The design can be the same, to the pixel, so the redesign is not a reason against Nuxt.
- First load is a little smaller in bytes, a little slower to idle (SPA boot). `ssr: true` with prerender would show the page before the JS and is the next thing to try.
- The page change is not slower; the real win needs the fair test.
- The main gain is the code: components with typed props instead of copies (the three donuts), no `?v=` bumps, one router, one store for the period. The cost is a port of every page (about 26) and of the shared chart code.
- Tailwind / Nuxt UI would only make sense for new parts, not for the existing design.
