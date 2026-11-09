# Report: Πολιτική is Αναλύσεις › Εκλογές

## Done
- `assets/shell.js`: the item `politics` is removed from `NAV`; Αναλύσεις (`world`) gets a last tab `elections` (`/elections`) with 5 sub-tabs: `elections.reach` `/elections`, `elections.outlets`, `elections.owners`, `elections.topics`, `elections.bylines`. The routes and the file `elections-v2.html` did not change. The top bar now has 4 items: Αρχική, Μέσα, Πρόσωπα, Αναλύσεις.
- `assets/messages.js` (el and en): new keys `tab.world.elections*` and `question.world.elections.*`; removed `nav.politics`, `tab.politics.*`, `question.politics.*` (the old `tab.politics.speeches` and `tab.politics.persons` were not used).
- `elections-v2.html`: the title and the trail are Αναλύσεις › Εκλογές › the sub-tab. `assets/home.js`: the quick link «Εκλογές» (`tab.world.elections`).
- Docs: `GLOSSARY.md`, `docs/redesign/tab-structure.md` (an update at the end), comments in `speeches-v2.html`, `persons-v2.html`, `scripts/make-search.mjs`.
- The tab Εκλογές is the last tab of Αναλύσεις: my call, nobody chose the place.

## Consequence the user did not ask for
The pages of Αναλύσεις are locked for a visitor who is not signed in (`shell.js`, `SignInGate`). The five Εκλογές pages are locked now too. Checked: signed out shows the gate, signed in (`proto-user` = `lolovios`) shows the page.

## Checked
- Playwright, Chrome, 1600 px: Greek and English, `?tab=owners`, `?tab=bylines`: the top bar, the tabs, the sub-tabs and the current marks are right; no console errors. Home: 4 items and the quick link.
- `scripts/visual-check.mjs`: 280 loads, the same 5 problems as before on `france-v2.html` and `pages.html`; none new.
- `data/search.js` and `data/pages.js` were not regenerated: the routes did not change and the labels of the pages come from the sidebar tree at run time.

## Not checked
The phone drawer with the new sub-tabs, 1100 px by eye, Safari.

## Found, not fixed
The home quick card shows the raw key `tab.people.file` as the label of its fourth button (`assets/home.js`, `QUICK`). It was like that before this change.
