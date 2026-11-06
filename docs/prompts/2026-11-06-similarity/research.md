# Research: how to redo the similarity and originality cards (2026-11-06)

Two parts: what the data says (measured, script in the session scratchpad, run on `data/storyDetail.js` and `data/stories.js`, 7491 stories, 36 outlets, 1 Aug – 27 Oct 2026) and what the web says. The web part is thin; see the end.

## 1. What the data says

| Finding | Number | What it means for a chart |
|---|---|---|
| Why the matrix was unreadable | Correlation of the size of the column outlet with the mean value of its column: **0.98** for «Ποσοστό» (cover), 0.88 for Jaccard, **−0.81** for lift | The «Ποσοστό» matrix mostly shows how big the column outlet is. Lift over-corrects: it favors small outlets (−0.58 with the size of the pair). No single number is honest alone. |
| Jaccard against lift per pair (276 pairs of the 24 outlets) | Correlation **−0.04** | They measure different things. The top Jaccard pairs are the big six (Proto Thema–Iefimerida 44%, Parapolitika–Iefimerida 44%, Ta Nea–In.gr 43%). The top lift pairs are small outlets: Avgi–TVXS ×3,2, To Vima–TVXS ×2,8, Newsit–CNN Greece ×2,8. **Capital–Insider.gr is the only pair high on both** (43%, ×2,3). |
| Same group | 11 same-group pairs among the 24 outlets: mean Jaccard 28,8% against 25,5%. Their ranks are 4, 11, 12, 65, 105, 109, 149, 155, 178, 210, 228 of 276 | Group does not predict similarity. A strip of all pairs with the 11 same-group pairs marked says it better than a ring with 2 numbers. |
| Stories per outlet count | 37 stories have 1 outlet, 329 have 2, 1912 have 10 or more | Every story is a cluster of several outlets, so «stories nobody else wrote» **cannot be measured here**. Own stories come only from the originality API (5 outlets). |
| Who writes first, by day | 40% of the 7454 multi-outlet stories have all their outlets on the same first day. First **alone**: Parapolitika 5,2%, Insider.gr 5,0%, Naftemporiki 3,8% … Makedonia 1,0%. Later than the first day: Makedonia 58%, To Vima 58%, Avgi 55% | A per-outlet «πρώτος μόνος / μαζί / μετά» bar for 24 outlets answers «who writes first» where the originality table covers only 5. The day grain is coarse and the ties must be shown, not hidden. |
| Directed pairs | 273 of 276 pairs have 100 or more non-tied shared stories. Parapolitika is before Makedonia in 85% of 412 non-tied stories (222 tied); Insider.gr, Kathimerini, News247, Newsbomb before Makedonia 80–82% | A directed view exists, but it is one outlet (Makedonia) that follows the rest. |
| Stability | Correlation of the pair Jaccard between the first and the second half of the window: **0.28** | The middle ranks of the pair list are noisy (I did not investigate why). Show the top and the bottom, with the number of shared stories, not a full ranking as a result. |

## 2. Chart candidates the data supports (not decided; for the user's choice)

1. **Pair scatter**: x = shared stories or Jaccard, y = lift; only the top pairs named with the `StanceMap` label placer. Reads in three zones: big and close (Proto Thema–Iefimerida), small but real affinity (Avgi–TVXS), both (Capital–Insider.gr). It replaces the matrix.
2. **Ranked top pairs** with the number of shared stories next to the score: the simplest and the fastest to read.
3. **The panel as a dumbbell**: for each partner two dots, «Χ γράφει τα ίδια» and the same the other way. Today the second number is plain text («αντίστροφα 61,8%»). Two values per category is the dumbbell case.
4. **Strip of pair scores** by same group or not, with the 11 same-group pairs labelled. Replaces the ring.
5. **«Πρώτος μόνος / μαζί / μετά»** stacked bar per outlet (24 outlets), sorted. Replaces or sits beside the group card; keeps the ties visible.

## 3. What the web says (extended search, 4 queries)

No source gave a best-practice rule for pairwise similarity between outlets. What I found:

- A matrix works for an all-pairs overview only if the rows and columns are ordered by clustering; the order decides what the reader sees ([Bostock, Les Misérables co-occurrence](https://bost.ocks.org/mike/miserables/); [spectral ordering, arXiv 1710.02862](https://arxiv.org/pdf/1710.02862)).
- One small study (10 participants, preliminary) found ranked lists faster and more precise than graphs for lookup ([arXiv 2506.17032 context](https://arxiv.org/pdf/2506.17032)). Networks show relations that a list hides.
- Dumbbell charts are for exactly two values per category; dot plots for one value or three or more series; small multiples when there are many categories ([Visa design system, dumbbell plot](https://design.visa.com/data-visualization/charts/dumbbell-plot); [Nightingale, two points of change](https://nightingaledvs.com/beyond-the-bar-alternative-methods-for-visualizing-two-points-of-change/)).
- On copying in news: copying is often one-directional and a few outlets are the sources of many ([Who copied who?](https://www.researchgate.net/publication/349324718_Who_copied_who_Patterns_of_directed_plagiarism_in_online_news)); the first outlet in a dataset is treated as the original even when the true source is outside it ([IJoC 2019](https://ijoc.org/index.php/ijoc/article/download/9904/2777)). That caveat applies to our «πρώτος».
- Nothing found on lift or hub bias in co-occurrence matrices; that part comes from the data above, not from the web.
