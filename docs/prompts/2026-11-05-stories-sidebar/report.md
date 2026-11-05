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
