# Report: October data from the DB dump

Branch `claude/db-fixtures`. Plan: `docs/plans/2026-11-04-1404-feat-october-data-from-dump-plan.md`.

## What was done

The dump `manual-20261028T155347Z.dump` (ta_blepo, pg 18.6, 5.4 GB) was restored into a scratch container, and `make-db-fixtures.py` appends its October to `media.js`, `stories.js`, `storyDetail.js` and `home.js`. Aug–Sep is unchanged. The pages take their window from the fixtures.

## Commands that ran

- Restore: `pg_restore -d ta_blepo --no-owner --no-privileges -j 4 -L <list>` in `pgvector/pgvector:pg18`. The list skips the data of `article_embeddings`, `event_article_vectors_*` and `event_centers_*` (45 tables). Result: 1.3 GB database. 14 errors, all `CREATE POLICY` for the missing roles `ta_blepo_reader` and `ta_blepo_reviewer`; no data error.
- Generate: `PGPASSWORD=… python3 -I docs/redesign/prototypes/scripts/make-db-fixtures.py docs/redesign/prototypes --as-of 2026-10-28 --dump manual-20261028T155347Z.dump`
- Search index: `node docs/redesign/prototypes/scripts/make-search.mjs`
- Checks (`pnpm` has no version set in this shell, so the node commands ran directly): `node docs/redesign/prototypes/scripts/fixtures-check.mjs`, `check.mjs`, `parts-check.mjs`, `visual-check.mjs`.

## Measurements

| What | Result |
|---|---|
| Days in the fixtures | 61 → 88 (2026-08-01 to 2026-10-27) |
| Covered range of the database | 2026-10-14 to 2026-10-27; 1–13 Oct are in the dates with null cells (crawler warm-up) |
| Outlets with a domain in the dump | 26 of 36; the other 10 get null October cells |
| Articles of the mapped outlets in the covered range | 48,146 |
| Stories | 5,062 → 7,515 (2,453 new, from 5,574 chains; 3,121 chains had fewer than 3 articles) |
| Longest story, largest story | 14 days, 740 articles |
| Ratio October to Aug–Sep daily mean, 23 of 26 outlets | 0.57 to 2.05 |
| Ratio, the other 3 | Newsit 8.2, CNN Greece 11.8, Ethnos 23.7 (kept, the user's choice) |
| `media.js` | 180,604 → 248,563 bytes |
| `stories.js` | 824,062 → 1,419,757 bytes |
| `storyDetail.js` | 1,045,118 → 1,403,986 bytes |
| `home.js` | 19,161 → 28,769 bytes |
| `search.js` | 482,229 → 915,958 bytes (loads on the first open of the search) |

- Aug–Sep identical to `HEAD`: dates, `outletDaily`, `issueDaily`, `stories[].daily`, `storyDays`, outlets, issues, people in `media.js`; all 5,062 story rows and 5,038 detail rows; `home.js` outlets, `issueDaily` and issues. Compared by value in Python.
- Idempotent: the generator ran again on the output, and `media`, `stories`, `storyDetail`, `home` and `sources.json` were byte-identical.
- Presets from the data (checked in the browser, both languages): Aug–Oct gives all, three months, last 14 days (14–27 Oct); the same days extended to 15 Nov add a November preset and move last 14 days to 2–15 Nov; Aug–Sep gives the old four.
- Checks on the tree with the review fixes: `fixtures-check` ok, `check.mjs` all pass, `parts-check` all pass.
- `visual-check` (336 loads, 42 pages, 1920/1440/1100/390 at paper and night) ran on the tree before the review fixes: the same 6 distinct problems as clean `main` run the same way. They are `france-v2.html` and `pages.html` requests for `cdn-cgi/rum` and `reports/france-riots/compare.html`, and an intermittent negative `<rect>` width on `pages.html` (it appeared on `main` too, at 1100/paper). **It has not run on the fixed tree**: the run was stopped and the user runs it on the deploy preview.

## Code review

`ce-code-review` (local reviewers, adversarial lens in-process) gave "Ready with fixes": 6 findings confirmed and fixed (null-safe pages, topic windows end at the last day with topic data, null contract checks in `fixtures-check.mjs`, cache-bust `?v=` bumps, the two added pages in `visual-check.mjs`). The independent external-model reviewer was **not** run, because the repo was not sent to another provider.

Not applied (reviewer demoted them):
- Story ids are list positions, so a rerun on a newer dump renumbers October stories; run `make-search.mjs` after the generator.
- `covered_range` takes the last unbroken run of days with 75% outlet presence; one weak mid-range day in a later dump would null earlier days.
- `fmt.signed` has no null guard; the home hero `Wave()`, the topic chips and the `outlet-v2` day count still read null as 0 or skip it.
- Home totals mix 26 mapped outlets in October with 36 in Aug–Sep.
- Aug–Sep identity was verified by ad hoc Python, not a repeatable script.

## What was seen and what was only measured

- Looked at in a screenshot at 1440 px, paper: the home page, an October story, the Iefimerida outlet page, the group page of Όμιλος ΣΚΑΪ.
- Probed in the browser for console errors and NaN text at 1440 px: the stories list, the topic pages 1 and 12 (catch-all), the groups page, the similarity page, the Μέσα overview.
- The other widths and the night theme were checked only by the visual-check loads (no console error, no horizontal scroll), not looked at.

## What the October data does not have

- Topic, frame, stance, section, clickbait and people. October stories are in the catch-all topic. The story page says so in one card. The topic page counts labels only for stories that have them. The home page says there is no topic data for an October day.
- The Μέσα overview, the topics, the groups' stance and every page that reads `mme.js`, `groups.js` and the analytical files keep their data to 30 Sep. The shares on the outlet and group pages (news, clickbait, stance) are still those of Aug–Sep.
- 1–13 Oct: no outlet volume, no stories (the daily stories start on 13 Oct, and 13 Oct is before the covered range).

## Changes from the plan

- `home.js` is extended too (the pages share one axis of days; the topic page broke without it).
- An outlet with no domain in the dump is allowed, with null cells (10 of 36), instead of failing the run.
- A day is an Athens day (the story rule says so), not UTC; the covered range starts on 14 Oct.
- October stories have detail rows with null labels, because the Stories list shows only stories that have one.
- The checks are in a new `fixtures-check.mjs`, not in `check.mjs`.

## Open for the user

- Makedonia and Voria have only a look-alike domain in the dump (`emakedonia.gr`, `voria.news`); they are null until someone confirms the match.
- Hero chips ("popular today") on the home page come from the topics of the last day, which are null for 27 Oct, so the chips are gone. They could use the last day that has topics.
- The hero silhouette on the home page still dips to zero over 1–13 Oct. It only decorates.
- The scratch container `apotypos-scratch-pg` and volume `apotypos_scratch_pg` are still there. The generator needs them to run again.
