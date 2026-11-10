import type { MmeSet, MmeSummary } from '~/types/mme'

// The arithmetic of assets/mme.js (summary) for the cards of Μέσα › Επισκόπηση and Στάση.
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const sumPairs = (p: number[], i0: number, i1: number) => {
  let s = 0
  for (let j = 0; j < p.length; j += 2) if (p[j]! >= i0 && p[j]! <= i1) s += p[j + 1]!
  return s
}

// All the sums of one period (the days i0 to i1). The shares of a topic use the news (the topics with soft: false) as the base.
export const mmeSummary = (set: MmeSet, i0: number, i1: number): MmeSummary => {
  const hard = set.issues.map(x => !x.soft)
  const outlets = set.outlets.map((o, k) => {
    const c = [0, 0, 0, 0, 0, 0, 0]
    const row = set.od[k]!
    for (let d = i0; d <= i1; d++) for (let j = 0; j < 7; j++) c[j]! += row[d * 7 + j]!
    return { ...o, k, n: c[0]!, news: c[1]!, issues: set.oi[k]!.map(p => sumPairs(p, i0, i1)), stance: [c[4]!, c[5]!, c[6]!] as [number, number, number] }
  })
  const issueN = set.issues.map((_, i) => sum(outlets.map(o => o.issues[i]!)))
  return {
    set, i0, i1, outlets, hard, issueN,
    active: outlets.filter(o => o.n > 0),
    newsN: sum(issueN.filter((_, i) => hard[i])),
    total: sum(outlets.map(o => o.n))
  }
}

// The articles of each day of the whole set: all of them, and those of the news.
export const mmeDaily = (set: MmeSet) => {
  const total = set.dates.map((_, d) => set.od.reduce((s, row) => s + row[d * 7]!, 0))
  const news = set.dates.map((_, d) => set.od.reduce((s, row) => s + row[d * 7 + 1]!, 0))
  return { total, news, other: total.map((v, d) => v - news[d]!) }
}
