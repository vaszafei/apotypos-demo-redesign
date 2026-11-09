# Report: Nuxt app migration

Running report. Each unit adds a section with what was measured and what was only looked at.

## U1: app in `web/` (PR #129)

Measured (local build, Chrome, signed out, reduced motion, my own script, not the U2 one):

- `npm run generate` 8 s, typecheck passes, `.output/public` 9.8 MB; the static `index.html` and `404.html` are not overwritten by the Nuxt build.
- `/trends` against `topics-v2.html`: 517 of 1 836 000 pixels at 1440, 2 327 of 821 340 at 390. The bands are the same as in the trial build (`nuxt-spike`, built before the move), so U1 changed nothing visually.
- `pagereveal` and `pageswap` report a `viewTransition` from `/trends` to `groups-v2.html` and back.

Not measured: the look of the slide between the two worlds; the Netlify redirect with a query string; the Nuxt error page for an unknown URL (the user checked the preview and said it was all good, without detail).

## U2: pixel diff and Nuxt checks

New: `npm run check:pixel -- <route>` (`web/scripts/pixel-diff.mjs`) and `npm test` (4 tests of the comparison). `check:visual` and `check:parts` take `--root <dir>` or `--base <url>`; with either, the ported pages load at their Nuxt route.

Measured:

- `check:pixel -- /trends`, signed in as `lolovios`, animations put at their end state before each screenshot (the limit is 0.05%):

| Screen | Different pixels | Note |
|---|---|---|
| 1440 full page | 4 782 of 1 836 000 (0.260%) | 4 265 in the header (rows 10-45), the rest in the donut and the line labels |
| 390 full page | 254 of 821 340 (0.031%) | within the limit |
| 1440 date picker open | 5 818 (0.317%) | header 4 265, the rest as above |
| 1440 hover on the first chart | 4 734 of 1 296 000 (0.365%) | header 4 265, the rest as above |
| 1440 night theme | 8 217 (0.448%) | header 4 191; 3 869 in rows 212-522 not explained yet |
| 390 night theme | 4 884 (0.595%) | rows 93-104 (the tab bar) and the donut; not explained yet |

- Explained: the header band is the signed-in state of the static header (the account, no sign-in buttons); the Nuxt shell has no session until U6. The donut edges and the line labels differ only because the trial's `DashCard` always has `m-play`: with that class removed for one run, the 1440 full page, the picker and the hover differ only in the header band (4 265 px). U6 ports `motion.js` and removes the fixed class.
- Not explained yet: the night theme bands (the theme is set by the `data-theme` attribute after load on both sides), and the 390 full page without `m-play` (2 073 px; 254 with it). Both are for U6, where the theme and the tab bar move into the shell.
- The earlier number for the trial (162 pixels at 1440) does not reproduce: the same build gives 517 with my first script signed out, and the picker and hover numbers of the trial were clips. The plan's "within noise" is not met; the cause is that the trial's method is not recorded.
- `npm run check`: 1 failure, `assets/mme.css: .chart .q-label has font-size 11px, below 12px`. The assets are identical to `origin/main`, so it fails on `main` too. Not touched.
- `check:fixtures` passes; `check:parts` passes 43 checks on the static pages and on the Nuxt build (`--root .output/public`); `check:visual --only topics` has no findings in both.

Looked at: crops of the label, the donut and the bar end (Nuxt above, static below) before and after the animation fix.

## U3: Tailwind 4 without reset (branch `claude/nuxt-tailwind`)

New: `tailwindcss` and `@tailwindcss/vite` in `web/`, `web/app/assets/css/tailwind.css` (the layer order, `theme.css` and `utilities.css`, both `prefix(tw)`, no preflight), registered in `nuxt.config.ts` (`css` and the Vite plugin). No token is mapped.

Measured:

- Built CSS without a `tw:` class anywhere: `entry.*.css` is 106 bytes (the licence line and the layer order). No reset rule, no utility. With a probe file containing `tw:p-4 tw:bg-red-500 tw:flex` it adds only `:root{--tw-color-red-500, --tw-spacing}` and those three classes; the probe was removed before commit. The variables are prefixed, so no prototype token is touched.
- In Chrome on the built `/trends`: an element with `tw:p-4 tw:bg-red-500 tw:flex` gets `padding 16px`, `oklch(0.637 0.237 25.331)` and `display:flex`; one with `p-4 flex` gets `0px` and `block` (the prototype owns the unprefixed names).
- `check:pixel -- /trends`, before and after: the four 1440 screens are identical, band by band. The two 390 screens are not stable, before or after (below).
- `npm run typecheck` exit 0, `npm test` 4 pass, `check:parts --root .output/public` all pass.

**The 390 numbers flip between two values on the same build.** 390 full page is 254 or 2 327 px; 390 night is 2 747 or 4 884 px. The difference is one band, rows 93-104 (the tab bar), 2 073 / 2 137 px. The same unchanged build gave 254 twice and 2 327 four times in six runs; the first runs of this session (before any change) gave 254 and 2 747.

Cause, measured: the tab bar's `scrollLeft` after load. In 12 fresh loads at 390, the Nuxt page was 77 every time; the static `topics-v2.html` was 77 seven times and 56 five times. The static page runs `centerTabs` (`assets/shell.js:1039`) sometimes before the font has loaded, and the tab ends up 21 px off. So it is a race in the static reference page, not something Nuxt or Tailwind changed. This also explains two open items from U2: the U2 report's 4 884 for 390 night (the other mode), and the 2 073 px band at 390 that looked like a U6 problem.

Consequence for the checks: a 390 result in `check:pixel` is one of two values until the static race is dealt with. Not changed here; it is a decision for a later unit (U6 or a fix in `shell.js`).

One more thing that did not change: Nuxt's own `error-404.*.css` and `error-500.*.css` still use UnoCSS-style classes, scoped by `data-v`; they were in the build before U3.

## U4: fixtures converter and `useFixture` (branch `claude/nuxt-fixtures`)

New: `web/scripts/build-fixtures.mjs` (runs every `docs/redesign/prototypes/data/*.js` in a `node:vm` context with a bare `window`, writes `public/data/<key>.json`; two files setting the same key is an error), run by `sync-prototype.mjs`. `web/app/utils/fixtureStatus.ts` (the rule of `App.load`: `loading`, `ready`, `empty`, `error`; `?state=empty|error|bad` force a state) and `web/app/composables/useFixture.ts` (fetches `/data/<key>.json`, gives `{ data, status, refresh }`). `useTopics` and the shifts card of `/trends` use it (keys `home` and `overton`). `web/fixtures/` is deleted.

Measured:

- `npm run generate`: 29 fixtures converted; `public/data/` has 61 files (29 `.js`, 29 `.json`, and the 3 `.json` that were already there), 13 MB. Every data script has its JSON file (a test checks this against the real folder).
- The trial's hand-made files are what the converter gives: `shifts.json` equals `overton` exactly; `topics.json` equals the `dates`, `issues` and `issueDaily` of `home` (the `home` fixture has five more keys, the page does not read them).
- `npm test`: 18 pass (the 4 pixel tests, 6 for the converter, 9 for `fixtureStatus`). `npm run typecheck` clean.
- In Chrome on `/trends`: no query gives 4 cards; `?state=empty` shows "Δεν υπάρχουν άρθρα σε αυτή την περίοδο." (the text of `topics2.empty`) and one card; `?state=error` and `?state=bad` show the error state with the retry button. No console error in any. The page requests only `home.json` and `overton.json`, not `search.json` (915 KB).
- `check:pixel -- /trends`: identical to the numbers before U3 on every screen, except the 390 full page, which is the known two-valued result (2 327 this run; see U3). `check:parts --root .output/public` all pass, `check:fixtures` pass, `check:visual --only topics --root .output/public` no findings.

Differences from the plan, my calls:

- The plan says vitest and `app/composables/useFixture.test.ts`. I used the existing `node --test` runner instead: Node 22.22 strips the types of a `.ts` file, so the pure rule (`fixtureStatus`) is a util that the test imports as it is. A test file inside `app/composables/` would also be picked up by Nuxt's auto-import. The composable itself (`useFetch` + route) is covered by the browser check above, not by a unit test.
- `?state=notfound` of the prototype is not supported (the plan's four statuses have no `notFound`); no ported page needs it yet.
- The shifts card still shows nothing when its fixture is not ready; the static page shows an empty or error card there. Not changed.

## U5: messages converter and `@nuxtjs/i18n` (branch `claude/nuxt-i18n`)

New: `web/scripts/build-messages.mjs` (runs the eight `assets/messages*.js` in a `node:vm` context with a bare `window`; writes `web/i18n/locales/el.json` and `en.json`, gitignored, run by `sync-prototype.mjs`). The merge order comes from the `<script>` lines of the 25 pages: a topological order of the files, and two pages that load two files in opposite orders are an error. Every message is checked and then compiled with the vue-i18n compiler (`@intlify/message-compiler`, a devDependency). `@nuxtjs/i18n` 10.6.0: `strategy: 'no_prefix'`, default and fallback `el`, no browser detection; `web/app/plugins/locale.client.ts` reads `?lang=` and then `localStorage['apotypos-locale']`; the switch in the header stores its choice, `?lang=` does not (as `components.js`). `/trends` and its components (`DashCard`, `TopicDonut`, `DateRange`) have no hard-coded Greek; dates follow the language (`el-GR` or `en-GB`), numbers stay Greek, topic names follow the language (`topicName`).

Measured:

- 2 096 Greek and 2 066 English messages (30 Greek keys have no English text and fall back to Greek). Gzipped: 44 788 bytes (el) and 34 550 (en), 79 KB together, under the plan's 150 KB, so no split by group. The module already splits by locale: `/trends` in Greek loads one messages chunk (253 864 bytes, 48 KB gzipped); with `?lang=en` it loads that one and the English chunk (187 304 bytes, 38 KB gzipped).
- The merge is one global merge, not one per page. Six keys differ between pages: `home.daily.title`, `home.topics.title`, `home.topics.note` (el and en) are in `messages.js` and again in `messages-home.js`. A page that does not load `messages-home.js` would show the override. No page other than the home page and `stories-v2.html` reads those keys (both load `messages-home.js`).
- `cov.short.fee` is `$160k` in `messages-world.js`. `$` is syntax in vue-i18n, and the plan says the converter fails on it. It fails, except for a key in `escapedKeys` (this one), which gets the literal form `{'$'}160k`. Every other message with `|`, `@`, `$` or a brace that is not `{name}` fails with the language and key.
- `npm test`: 30 pass (12 new in `build-messages.test.mjs`: override order, page order and opposite orders, six bad messages each failing with the key, the escaped key, the whole prototype converts, `{n}` text of four keys equals the prototype `t()` in both languages, a key English lacks gives the Greek text). `npm run typecheck` clean.
- In Chrome on the built `/trends` (1440): Greek, `?lang=en`, and the ΕΛ/EN switch change the card titles, the findings, the donut centre, the tooltip, the info text, the picker presets, the buttons and the weekday letters; `<html lang>` follows; the page height is 1 275 px in both languages and after switching back; `localStorage` is `en` after clicking EN and `/trends` opens in English on the next load; `?state=error` shows "The data did not load." with "Try again"; no console error or warning.
- `check:pixel -- /trends` equals the 1440 numbers of U2 on all four screens (4 782, 5 818, 4 734, 8 217); the two 390 screens gave 254 and 4 884, two of the known two values. `check:parts --root .output/public` all pass.

Differences from the plan and from the trial, my calls:

- The error state of `/trends` now says "Τα δεδομένα δεν φόρτωσαν." (`state.failed`, the text of `UI.ErrorState`); the trial had "Δεν φορτώθηκαν τα δεδομένα.".
- The nav, the footer, the theme and font names and the sign-in buttons of `layouts/default.vue`, `useNav.ts` and `links.ts` are still Greek in the code. They are the shell (U6); only the ΕΛ/EN switch now works. In English the shell stays Greek, as the screenshot shows.
- The storage is `localStorage['apotypos-locale']` through the plugin, not the module's cookie, so the static pages and the Nuxt pages share one setting.

## U6, first pull request: session, auth drawer and switches (branch `claude/nuxt-shell-session`)

New: `stores/session.ts` (the three fixed accounts of `ACCOUNTS`, `localStorage['proto-user']`, `signIn`/`signOut`/`refresh`), `stores/prefs.ts` (font, theme, icons: `?font=`, `?theme=`, `?icons=`, then the last choice in `proto-font|theme|icons`, written to `<html data-*>`), `composables/useAuthDrawer.ts`, and the components `AuthDrawer` (login and the three-step sign-up, ported from `openAuth`), `AuthField`, `SignInGate`, `AuthLinks`, `UserMenu`, `LangSwitch`, `ShellSwitches`. Plugins `prefs.client.ts` (applies the choices before the first paint) and `session.client.ts` (a `storage` event from another tab refreshes the user). `layouts/default.vue` now has no hard-coded Greek: the sections, tabs and footer links are keys (`nav.*`, `tab.<section>.<tab>`), so the shell is English with the EN switch. The drawer of a phone has the language, theme, icon and font switches and the sign-in buttons, closes on Esc, and is inert while closed; the page is inert while it is open. Αναλύσεις (section `world`) shows `SignInGate` instead of the page when nobody is signed in. `data-theme`, `data-icons` and `data-font` are no longer in `nuxt.config.ts` (the head would overwrite the store's value after mount).

Measured, in Chrome on the built app (a throwaway `/speeches` page for the gate, not committed):

- Sign in with a wrong password: the error shows, the field is cleared, the focus is on it. The right password closes the drawer and shows the user menu; `proto-user` is `lolovios`; a reload keeps it; "Αποσύνδεση" clears it.
- Drawer: opens with the focus on the user field; the page behind is inert; 12 Tab and 12 Shift+Tab stay inside; Esc closes it and the focus goes back to the button; on sign-up Esc with typed data asks first and a second Esc returns to the form.
- Sign-up: step 1 shows 3 errors and focuses the first; a bad email and a short password stay on step 1; the eye shows the password; steps 2 and 3 validate (job, reasons, source, "other" text, terms); Back works; the done view closes without signing anyone in.
- Gate: a signed-out visitor on Αναλύσεις sees the gate and not the page; logging in from it opens the page without leaving; a reload keeps it; a user stored by a static page (`proto-user`) opens it.
- Switches: `?theme=night&font=inter&icons=all` set and store the three; the footer controls change them; they survive a reload without the query; an unknown value is ignored. On a phone the drawer holds the switches and the EN switch makes the buttons "Log in" and the nav "Home | Media | People | Analysis".
- No console error or warning in the whole run. `npm test` 37 pass (7 new for the store and the switch rule), `npm run typecheck` clean, `check:parts` all pass.

`check:pixel -- /trends` against the numbers of U2:

| screen | U2 | now |
|---|---|---|
| 1440 full page | 4 782 | 517 |
| 1440 date picker | 5 818 | 1 553 |
| 1440 hover | 4 734 | 469 |
| 1440 night | 8 217 | 530 |

- The 4 265 px header band (rows 10-45) is gone: the check signs the static page in as `lolovios`, and the Nuxt shell now reads the same key and draws the same user menu.
- The night band (rows 212-522, 3 869 px), open since U2, is explained and was a defect of the check, not of Nuxt: `check:pixel` set `data-theme` after the page had loaded, so the static page kept the hex colors its JS had read in the paper theme (`Dash.color`, categories 6 and 7 have their own values in night) while Nuxt, which uses `var(--cat-n)`, followed the theme. Measured: with `?theme=night` in the URL the strokes of both pages are the same hex values. The check now stores `proto-theme` before the load. After that, the night screen at 1440 is 530 px, the same as paper.
- The 390 screens gave 2 327 and 2 381 this run: the known tab-bar race of the static page (band rows 93-104), still not handled.
- What is left at 1440 (517 px) is the donut edges and line labels from the fixed `m-play` class of `DashCard`; that is the second pull request (motion).

Differences from the plan, my calls:

- `?header=v1` (the old header) is not ported; the Nuxt shell is v2 only.
- The user menu's "Προφίλ" links to `/profile` through `NavLink`, so it opens the static page of the table of pages until a profile page is ported.
- `LangSwitch` and `AuthLinks`/`UserMenu` are separate components (the plan lists `ShellSwitches` for the switches); the language switch is in the header and in the drawer, the three others in the footer and the drawer.
