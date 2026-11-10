# Report: Nuxt app, U9 outlet page

Branch `claude/nuxt-outlet`. The outlet page (`outlet-v2.html`, four tabs) is a Nuxt page at `/outlet?slug=`. This is the last Μέσα page: every Μέσα tab and the story, topic, group and outlet pages are now Nuxt pages. Prompt: `prompt.md` (same folder). Source handoff: `docs/prompts/2026-11-09-nuxt-app/handoff-12.md`.

## What was built

- Pure code (`web/app/utils/`): `outlet-detail.ts` (stories of the outlet, how it writes, related outlets, and the Mme cards `outletFacts`, `weeklyAgenda`, `coverageOf`, `stanceByTopic`, `emphasisOf`, `voicesOf`, `portrayalOf`, `headlinesOf`), `mme.ts` (`mmeProfile`, `sumPairs`, `sumRows`, `critShare`, `netOf`), `profiles.ts` (`outletPairs` = `Spread.pairs`). Type of the whole Greek set in `types/mme.ts`.
- Components: `OutletDetail` (the body: head with tabs, title card, daily card, the four tabs), `OutletRelated` + `RoseChart`, `OutletWeekly` + `WeekLines` (Politics.LineChart without end labels), `OutletCoverage`, `OutletStanceByTopic` + `PairBars`, `OutletEmphasis`, `OutletVoices`, `OutletPortrayal`, `DashStat` (Dash.Stat). Page `pages/outlet.vue` (`detail: '/media'`, `ClientOnly`, keyed by the slug).
- Shared pieces changed: `BarList` has `columns`, `cls` and a row `marker` (it calls itself for each column); `DailyCard` has `topics: false` (no switch). `outletHref` is `/outlet?slug=`; `safeUrl` is new; `GroupsNetwork` uses `outletHref`; `GroupTiles` uses `EntityLink`, so a tile is a client navigation. `ported-pages.json` has `/outlet`.
- Names of constants are prefixed (`OUTLET_*`) because Nuxt auto-imports every export of `utils/` (see handoff 12, gotchas).

## Verification (commands and measurements)

- `npm test`: 106 of 106 (11 new in `scripts/outlet-detail.test.mjs`). The static `mme.js` and `spread.js` run in `node:vm` with stubs that record what the cards draw; the Nuxt code gives the same pairs, profile, facts and ranks, weekly lines and tips, pushed and skipped stories, stance bars, emphasis rows, voices, parties, attacks, portrayal and headlines for 5 outlets. I changed three thresholds one by one (5 stories, 5 articles, 0.02 usual) and the tests failed each time, so they do check.
- `nuxt typecheck` clean; `npm run generate` builds.
- Pixel diff (`npm run check:pixel`), Nuxt against static, 6 screens each:
  - Proto Thema (a Greek-set outlet): overview 0, topics 0, stories 0, people 15 px of 1.9 million (0.001%).
  - Rosa.gr (not in the Greek set): overview 0, topics 0, stories 0, people 14 px (0.001%). No `slug`: 0.
  - The 14 to 24 px of the people tab are one glyph of a name in the portrayal list (x 975 to 980); not found why (text node split in the static `[name, ' ', span]`).
  - Unknown slug `zzzz`: 498 px (0.038%) before the last fix, in the trail's last item (the static page shows the section name there); fixed with the same title, not run again as a pixel diff.
  - After the shared pieces changed: `/groups`, `/media`, `/story?id=100`, `/topic?i=3`, `/group?g=skai` all 0 on all screens.
- Tooltips: every hover target (`.dbar`, `.hbar`, `.spark`, `.stacked`, rose slices, line charts) of 5 outlets x 4 tabs (Proto Thema, Rosa.gr, 10ccbbf6b4, 57ad7f4ef5): 14 / 11 / 0 / up to 74 targets, same count and same text as the static page.
- Client navigation (built site): a tile on `/media`, an outlet link on `/story`, on `/topic`, a related outlet and its group on the outlet page, and the search (`Kathimerini` + Enter) all go to `/outlet?slug=` with no document load; the trail and the document title show the outlet name; the tabs change the URL with no document load; English shows the English tabs. No console warnings or errors.
- Dev server (`nuxt dev`), 11 visitor cases (signed out, signed in, night, icons, English, 390, a non-Greek-set outlet, 404, `?state=empty`, `?state=error`): no Vue warning. The one at 390, a hydration `inert` mismatch of the sidebar, is the same on `/group` and `/media` at 390, so it is not from this page.

## Found, not changed

- On a desktop (1024 px and wider) the outlet's tab bar is **not visible**, in the static page and in Nuxt: `app.css` hides every `.page-tabs .section-tabs` there because the tabs of a section are in the sidebar, but the four tabs of an outlet have no sidebar entry. At 1023 px and narrower they show (checked at 390 and 800). So on a desktop only a `?tab=` URL reaches Θέματα, Ιστορίες and Στάση και πρόσωπα. I kept it as it is (pixel parity); it needs a decision of the user.
- The page head of the outlet is its own `header.page-head`, and the layout's head stays hidden in the DOM, so there are two `.page-tabs`. `centerTabs` in the layout reads the first (hidden) one; the static page does not center the current tab either (`scrollLeft` 0 on both at 390, checked).
- Tabs reload no data but a tab change scrolls to the top (the static page reloads).

## Not checked

Netlify preview (the `outlet-v2.html?slug=` 301 keeping its query: only `_redirects` has the rule), Safari, Firefox, widths other than 1440, 800 and 390, the page change time, touch and keyboard on the bars and the rose, the 150 ms hold off localhost.

## Left for the user (unanswered from before)

English first frame, the 150 ms hold off localhost, the 390 tab-bar race of the static page, deleting the merged local `claude/nuxt-*` branches, the plan text (Αναλύσεις U11 to U13 stay static; U17 cannot run as written).
