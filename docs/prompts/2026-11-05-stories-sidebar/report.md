# Report: Ιστορίες in the Μέσα sidebar

Branch `claude/stories-into-media`.

## What changed
- `assets/shell.js`: the item `spread` is gone from `NAV`. Μέσα has a new tab `stories` (`/stories`) between Θέματα and Πώς γράφουν, with 4 sub-tabs: Επισκόπηση (`/stories`), Ανά μέσο (`/stories/outlets`), Υποθέσεις (`/cases`), Μοτίβα διάδοσης (`/campaigns`). The detail `/story` is now a detail of Μέσα and its back button goes to `/stories`.
- `assets/messages.js`: `nav.spread` and `tab.spread.echoes` removed. `tab.spread.*` became `tab.media.stories.*`, `question.spread.*` became `question.media.stories.*`, new `tab.media.stories` (Ιστορίες / Stories). Greek and English.
- `stories-v2.html`, `cases-v2.html`, `campaigns-v2.html`, `story-v2.html`: title and breadcrumb use Μέσα, as the other Μέσα pages do.
- `?v=` bumped on all 28 pages: `shell.js` 62, `messages.js` 41.

## Measured
- `node docs/redesign/prototypes/scripts/check.mjs`: All checks pass.
- `visual-check.mjs --only` stor (4 pages), cases, campaigns: 0 findings at 4 widths, paper and night. `--only pages`: the known `compare.html` and `cdn-cgi/rum` 404s only.
- Playwright at 1440 (script in the scratchpad): on `/stories`, `?tab=outlets`, `/cases`, `/campaigns` the top bar is Αρχική, Μέσα, Πρόσωπα, Πολιτική, Αναλύσεις; the sidebar is Επισκόπηση, Ιδιοκτησία, Θέματα, Ιστορίες (with its 4 sub-tabs, the current one marked), Πώς γράφουν, Ομοιότητα και πρωτοτυπία. No console errors, no horizontal scroll.
- Story page: the trail is Μέσα (link `stories-v2.html`) › Ιστορίες.

## Seen
- Screenshot of `/stories` at 1440 (paper).

## Not looked at
- The sidebar at 1100 and 390 (drawer), night, and the story page as a screenshot: only measured by the visual check.
- The table «Όλες οι ιστορίες» is cut at the right edge at 1440 (table 625 px in a 611 px box). It is the same on `main`, so I did not touch it.

## My calls
- The trail of the story page is Μέσα › Ιστορίες (the other detail pages show the entity name; the story name is not available when the title is built).
- Old links keep working: the routes are unchanged.

## Round 2

### What changed
- Ιστορίες › Επισκόπηση (`stories-v2.html`): the table «Όλες οι ιστορίες» and the chart «Νέες ιστορίες ανά ημέρα» are removed. The page has the date picker of Θέματα (`UI.DateRangePicker`, presets of `Mme.presets`) in the top bar and the stories card of Αρχική (`Home.DayCard`) for the period. Ανά μέσο is unchanged.
- `assets/home.js`: new `Home.rangeInfo` (the same as `dayInfo` for days i0 to i1: articles of each story and of its outlets summed over the period). `DayCard` takes optional `title`, `hint`, `dateText`, `empty`, so Αρχική is unchanged. The list now draws 100 stories at a time and adds the next 100 near the end of the scroll (7,491 stories for the whole period drew 7,491 rows and took about 4 s to load).
- Μοτίβα διάδοσης is removed: the sub-tab, the route `/campaigns`, `campaigns-v2.html`, its `camp.*` messages, its search kind (`scripts/make-search.mjs`, `data/search.js` regenerated: only the 5 campaigns rows differ).
- Υποθέσεις (`/cases`, `cases-v2.html`) is now Αναλύσεις › Ρουβίκωνας (last tab of Αναλύσεις). Its question key is `question.world.rouvikonas`.
- Dead messages of the two removed cards deleted in both languages (`stories.daily.*`, `stories.type.*`, `stories.col.period|groups`, `stories.count`, `echoes.reach.aria`, `topics2.stories.note`). New: `stories.period.info`, `stories.period.empty`.
- `?v=`: `shell.js` 63, `messages.js` 42, `messages-spread.js` 19, `messages-v2.js` 58, `home.js` 36 (Αρχική and Ιστορίες).

### Measured
- `check.mjs` and `fixtures-check.mjs` pass.
- Full `visual-check.mjs` (40 pages, 4 widths, paper and night): only `cdn-cgi/rum` 404 on `france-v2.html` and `pages.html`, and the missing `reports/france-riots/compare.html` on `pages.html` (all known).
- Playwright at 1440: sidebar of Μέσα is Επισκόπηση, Ιδιοκτησία, Θέματα, Ιστορίες (Επισκόπηση, Ανά μέσο), Πώς γράφουν, Ομοιότητα και πρωτοτυπία; sidebar of Αναλύσεις ends with Ρουβίκωνας. The card shows 100 stories first, 200 after a scroll to the end. A pick of the 3rd story shows its articles (1.183) and keeps the 200 rows. The presets of the picker with «Εφαρμογή»: Τελευταία εβδομάδα (21–27 Οκτ, 455 articles in 26 outlets), Αύγουστος 2026 (574 in 22), Όλη η περίοδος (3.219 in 30). No console errors.

### Seen
- Screenshots of `/stories` at 1440 paper and night and at 390 paper; `/cases` at 1440 (paper).

### My calls (not the user's)
- The card follows the period: it lists the stories that ran in it with the articles summed over the period. The card of Αρχική is for one day; the user's words did not say what a period should do.
- The card title is «Όλες οι ιστορίες» (the title of the removed table card), the date at its top right is the period, and its info says it is a period.
- The card is c-5, as on Αρχική; the right of the row is empty.
- Αναλύσεις pages are locked for a visitor who is not signed in, so Ρουβίκωνας shows the sign-in gate until the visitor signs in (looked at, `/cases` at 1440).

### Left alone
- `data/campaigns.js`, the campaigns function of `make-fixtures.py` and the pages table rows (`data/pages.js`, `make-pages-table.py`) still name `/campaigns`; nothing loads them now.
- `spread.js` and `data/groups.js` are no longer loaded by `stories-v2.html` (they are still used by other pages).

## Round 3

### What changed
- Ιστορίες › Επισκόπηση is three cards: «Ιστορία» (the story, its topic and its outlets) `c-6` on the first row; «Όλες οι ιστορίες» (the list) `c-4` and «Ιστορία στον χρόνο» (a line chart of the picked story) `c-6` on the second row. A pick in the list draws the story and the line again; the list keeps its place.
- `assets/home.js`: `Home.DayCard` takes `part` (`'story'` or `'list'`) and `span`, and `dateText: false` for no date. With no part it is the one card of Αρχική, as before.
- `assets/home.css`: `.home-list` starts the list on the first column (`1 / span 4`, `1 / span 6` under 1280 px, full width under 720 px) so it is on the second row at every width.
- `stories-v2.html`: `StoryLine`, one line with the articles of the story for each day of the period (linear axis from 0, monotone curve, the first-view animation of the other lines, the white tooltip with a row).
- Messages `stories.story.info`, `stories.time.title`, `stories.time.info`; the info of the list says «στις κάρτες». `?v=`: `messages-spread.js` 20, `home.js` 38, `home.css` 47.

### Measured
- `check.mjs` passes; `visual-check.mjs --only stor` (4 pages) and `--only index`: no findings, 4 widths, paper and night.
- Playwright (cards, x y width×height): at 1440 the story card is 554 wide at the top, the list 364 and the chart 554 on the row under it; at 1920 604, 397, 604; at 1100 398, 398, 398; at 390 the three are 358 wide in one column. No horizontal scroll, no console errors. A pick of the 3rd story changes the story card, keeps 100 rows and marks the row. Αρχική still has 88 bars and the same card (same count as on the commit before).

### Seen
- Screenshots of `/stories` at 1920 and 1440 (with the tooltip on the line). 1100 and 390 only measured.

### My calls (not the user's)
- The row 2 is 4 + 6 columns as written, so the 2 columns on the right of it are empty (and the right half of row 1).
- Titles: «Ιστορία», «Όλες οι ιστορίες», «Ιστορία στον χρόνο». The period is at the top right of the story card; the list card has no date (the title wrapped to two lines with it).
- The line shows the articles of the story on each day (no rolling average) over the picked period.

## Round 4

### What changed
- Ιστορίες › Επισκόπηση is one row of two columns. Left `c-7` (`card-col`): the story card, and under it «Ιστορία στον χρόνο». Right `c-5`: «Όλες οι ιστορίες», which takes the height of the left column and scrolls inside (`.home-list .home-stories` has `flex: 1 1 0; height: 0` from 1280 px up, so the list does not set the height of the row).
- Under 1280 px the list goes under the left column at full width with its old 330 px scroll box (`.story-split > .c-5` spans 12).
- The three `.home-list` rules of round 3 (the second-row start) are replaced by these. `?v=`: `home.css` 49.

### Measured
- Playwright cards (x y width×height): at 1440 the story and the line are 649 wide, the list is 459 wide and 646 high, the same as the left column (646). At 1920: 707 / 501 / 646. At 1280: 564 / 398 / 646. At 1100 and 390 the list is under the others at full width.
- 100 rows first, 200 after a scroll to the end; a pick of the 4th story changes the story and keeps the card height; «Τελευταία εβδομάδα» draws the new period (the left column grows to 701 because the title has three lines, and the list follows). No console errors.
- `check.mjs` passes; `visual-check.mjs --only stor` and `--only index`: no findings.

### Seen
- Screenshot of `/stories` at 1440. 1920, 1280, 1100 and 390 only measured.

### My calls
- The right column is `c-5` (7 + 5); the user gave only the 7.
