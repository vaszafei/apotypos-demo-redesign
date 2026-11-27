# October topics spike (#214): report

2026-11-27. Read-only on the data, no change to the app. Script: `spike.py` (runs from a scratch venv with numpy, scikit-learn 1.7, umap-learn 0.5, psycopg2-binary).

## Answer

**Yes, October can have topics, but not straight from the platform's defaults, and not without names.** Plain cosine KMeans with k=36 on the bge-m3 vectors gives 27 topics that can be named (22 clean, 5 mostly) and 9 that are mixed, in 15 seconds on the CPU. The platform's own settings (UMAP, k=80 merged to 30) do worse on two weeks of data: one topic holds 21% of the articles and mixes unrelated things.

Aug–Sep is not coming back (user, 2026-11-27). The issue's question "can October show topics next to Aug–Sep" now means "are October topics good enough to un-hide the topic screens" (world Plegma, theme pages, Home topic chips).

## What was run

| | |
|---|---|
| Data | dump `manual-20261028T155347Z.dump`, table `article_embeddings` (bge-m3, int8 OpenVINO build, halfvec 1024), chunk 0 of each article |
| Load | `pg_restore -a --disable-triggers -t article_embeddings` into `apotypos-scratch-pg`, index dropped first: **2 min 3 s**, 726,786 chunks of 292,994 articles, **2.2 GB** |
| Scope | the app's 26 outlets with a domain (`outlet-domains.json`), 14–27 Oct (Athens day), `moved_to_id is null`: 48,146 articles, 48,099 with an embedding (99.9%) |
| Machine | 12 CPU cores, 15 GB RAM, no GPU |

| Run | Method | Time | Peak RAM | Result |
|---|---|---|---|---|
| `30` | platform defaults: UMAP 10-d cosine, MiniBatchKMeans k=80 on all 48k, Ward merge to 30, 3σ outliers | 1 min 45 s (UMAP 90 s) | 1.3 GB | topic 0 = 21.1% grab-bag (EU summit, myDiesel, courier payments, France riots); topic 3 = 7.6% mix (FBI, Brad Pitt, a 75,000-year-old murder); the 5 smallest are single events (43–144 articles); 0 outliers |
| `k36-raw` | cosine KMeans k=36 on the 1024-d vectors, no UMAP, no merge | 15 s (KMeans 5 s) | under 1.3 GB | shares 1.0%–5.7%, all topics in 20–26 outlets, 2 outliers |

36 was chosen to match the number of topics the app was designed around. A GPU is not needed: the slowest step was UMAP, and the better run skips it. Labels are the only step that would use an LLM.

## The 36 topics (run `k36-raw`)

The names are mine, from 7 random titles per topic plus keywords (`samples-k36.md` has 10 per topic: 3 nearest the centre, 7 at random). "Mixed" means the random titles do not share one subject. This is a reading, not a measured score.

| # | % | My name | Read |
|---|---|---|---|
| 0 | 5.7 | Κόμματα και δημοσκοπήσεις | clean |
| 1 | 5.0 | Τεχνολογία, AI, υγεία | mixed |
| 2 | 4.7 | Πρόσωπα, celebrities, Τραμπ | mixed |
| 3 | 4.2 | Αστυνομικά (Ελλάδα και εξωτερικό) | clean |
| 4 | 3.9 | Ταραχές στη Γαλλία | clean |
| 5 | 3.7 | Μητσοτάκης, διπλωματία, εκδηλώσεις | mixed |
| 6 | 3.6 | Πόλεμος Ουκρανίας | clean |
| 7 | 3.5 | Τηλεόραση και πολιτισμός | clean |
| 8 | 3.5 | Επιχειρήσεις, επενδύσεις (εταιρικά) | mixed |
| 9 | 3.3 | Μέση Ανατολή, Ισραήλ, Ιράν | mostly |
| 10 | 3.2 | Τροχαία και ατυχήματα | mostly |
| 11 | 3.2 | Σύνοδος ΕΕ, ενέργεια, ακρίβεια | mostly |
| 12 | 3.1 | Εργασία, αγροτικά, ΔΥΠΑ | mixed |
| 13 | 3.1 | Pizza Fan, «Χωριάτικο», φοροδιαφυγή | clean |
| 14 | 3.1 | Ποδόσφαιρο: προθέρμανση, μεταδόσεις | clean |
| 15 | 3.0 | Καταναλωτικά: πληρωμές, πετρέλαιο, ΚΟΚ | mixed |
| 16 | 2.9 | Σκάνδαλο μπάσκετ | clean |
| 17 | 2.9 | Θάνατοι (Βαλάση κ.ά.) | clean |
| 18 | 2.8 | Ποδόσφαιρο: αποτελέσματα | clean |
| 19 | 2.6 | Δικαστήρια, Τέμπη, Μονή Σινά, Δούκας | mixed |
| 20 | 2.5 | Τραγωδίες στο εξωτερικό | clean |
| 21 | 2.5 | Τουρκολιβυκό μνημόνιο | clean |
| 22 | 2.5 | Αγορές και μακροοικονομία | clean |
| 23 | 2.4 | Σεισμοί, φυσικά φαινόμενα, διασώσεις | mixed |
| 24 | 2.4 | Καλώδιο Ελλάδας–Κύπρου, NAVTEX | mostly |
| 25 | 2.0 | Χρηστικά: εορτολόγιο, συντάξεις, αλλαγή ώρας | clean |
| 26 | 1.9 | Κυκλοφορία στην Αττική | clean |
| 27 | 1.8 | Έκρηξη στον Κολωνό, επιθέσεις | mostly |
| 28 | 1.7 | Θάνατος Μαζωνάκη | clean |
| 29 | 1.6 | Διαδηλώσεις στην Αλβανία | clean |
| 30 | 1.6 | Καιρός | clean |
| 31 | 1.5 | Φοιτητικές κινητοποιήσεις | clean |
| 32 | 1.4 | Εκλογές στο εξωτερικό (Βραζιλία, Σερβία) | clean |
| 33 | 1.2 | Υπόθεση Γκίλφοϊλ | clean |
| 34 | 1.2 | Ενέργεια και τιμές καυσίμων | clean |
| 35 | 1.0 | Εταιρικά και αγορές (ΓΕΚ ΤΕΡΝΑ, IPO) | mixed |

Clean 22, mostly 5, mixed 9.

## Compared with the old topic list (as a yardstick only)

- The Aug–Sep topics were **not** made by this method. `media_lens.py` (deltypo) had an LLM propose 28–40 concrete issues from sampled titles and then tag every article with one of them. So October clusters and the old list come from two different methods.
- The grain is close: the old list ran from 12% (Αθλητικά) down to 0.1%. The October clusters run from 5.7% to 1.0%, with sport split into three (two football, one basketball scandal) and lifestyle spread over topics 1, 2 and 7.
- Some October topics match the old ones by name: Πόλεμος Ουκρανίας, Θάνατος Μαζωνάκη, Καιρός, Κόμματα, Αστυνομικά, Τροχαία, Ελληνοτουρκικά (Τουρκολιβυκό).

## Problems found

- Titles carry HTML codes (`&#8211;` for a dash): run `30` used "8211" as a keyword. The script now unescapes them.
- Topics change with the seed and with k. Stability was not measured.
- The platform's outlier cut (3σ) removed 0 and 2 articles, so every article gets a topic, even off-topic ones.

## Next step options (not chosen)

1. **Hand-named clusters.** Keep k=36, split or merge the 9 mixed topics, and the user approves the names. No API cost. The names stay fixed for the demo.
2. **The old method again** (`media_lens.py`: LLM taxonomy, then a tag per article). Same method as the old list, and it would also give stance and frames for October. It needs an OpenRouter key with credit (estimated $2–3 plus half a day to adapt; none on this machine).
3. **Clusters plus LLM names.** Run 1, with an LLM naming each cluster from its titles (36 calls).

## Option 1 chosen: hand-named topics (2026-11-27)

- Stability, measured with `stab.py` on the same 48,099 vectors, 3 seeds each (adjusted Rand index between runs, 1 = identical): MiniBatchKMeans (the run above) 0.41–0.49, about 11 s a run; full KMeans (3 inits, 100 iterations) 0.65–0.70, about 50 s a run. Changing only the row order changed the MiniBatch topics, so the names are fixed to one frozen run: full KMeans, seed 1, rows ordered by article id.
- The 8 mixed topics of that run were split in 3 each (`sub.py`) and each part sent to a clean topic or kept as a small concrete one (`names.py` holds the mapping).
- Result: **40 topics**, 0.4%–5.5%, every article has one. Four are still broad catch-alls: Επιχειρήσεις και επενδύσεις, Θεσμοί δικαιοσύνη και διοίκηση, Διεθνή πρόσωπα, Ανά τον κόσμο.
- Names are mine and wait for the user's approval.

## Built into the fixtures (2026-11-27)

- `docs/redesign/prototypes/scripts/october-topics.json` (364 KB, `export.py`): the 40 topics with English names, `soft` flags and the ids of their articles.
- `make-db-fixtures.py` adds them after the 36 Aug–Sep topics of media, home and stories (`dbIssueFrom` = 36), with articles per day and per outlet (`media.issueOutlet`). Each of the 2,453 October stories takes the topic of most of its articles: 0 left on the catch-all. 48,099 of 48,146 articles have a topic (47 have no embedding). Two runs give byte-identical files; outside the topic fields home, media and stories are unchanged, storyDetail is byte-identical.
- `web/scripts/trim-window.mjs` keeps only the topics with articles in 14–27 Oct (the 40), renumbers every topic index (stories, media, home, search rows and topic entries) and counts the group topics again from `media.issueOutlet` (`groups.topicsAll` sums to 48,099).
- Checks: trim tests 7 of 7; all web tests 226 pass, 5 fail, the same 5 that fail on main (move, plegma-articles sector, visitor-script); `check:fixtures` ok after its topic rule was changed; `nuxi typecheck` exit 0.
- `make-search.mjs` fails on main (it reads `data/statements.js`, deleted in 4406b7c), so search.js was not rebuilt; the trim gives each search row the topic of its story.

Seen on screen, dev server, 1440 and 390, old data against new data (two runs of each data set; same-data runs differ by 0 px except one late card reveal):

| Page | Change |
|---|---|
| Home | «Δημοφιλή σήμερα» chips with 4 topics appear under the search; the hero moves down; at 390 the page is 197 px taller |
| /stories | the period web draws the stories as topic-coded, so its dots and lines differ |
| Story pages | Σχετικές ιστορίες now prefer stories of the same topic |
| Every page with the Plegma behind it | the faint background dots differ (400–1,100 px) |
| Group, groups, outlet cards | no change in the cards |
