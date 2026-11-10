import type { MmeProfile, MmeSet, MmeSummary } from '~/types/mme'

// The arithmetic of assets/mme.js (summary) for the cards of Μέσα › Επισκόπηση and Στάση.
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
export const sumPairs = (p: number[], i0: number, i1: number) => {
  let s = 0
  for (let j = 0; j < p.length; j += 2) if (p[j]! >= i0 && p[j]! <= i1) s += p[j + 1]!
  return s
}

// Flat rows [day, a, b, c, ...] of width w: the sum of each value over the period.
export const sumRows = (p: number[], w: number, i0: number, i1: number) => {
  const s = new Array<number>(w - 1).fill(0)
  for (let j = 0; j < p.length; j += w) if (p[j]! >= i0 && p[j]! <= i1) for (let k = 1; k < w; k++) s[k - 1]! += p[j + k]!
  return s
}
// The critical share of a stance [critical, neutral, supportive], and the net tone of a tone row (supportive minus critical over all).
export const critShare = (st: number[]) => (sum(st) ? st[0]! / sum(st) : 0)
export const netOf = (tone: number[]) => { const n = sum(tone); return n ? (tone[2]! - tone[0]!) / n : 0 }

// All the sums of one period (the days i0 to i1). The shares of a topic use the news (the topics with soft: false) as the base.
export const mmeSummary = (set: MmeSet, i0: number, i1: number): MmeSummary => {
  const hard = set.issues.map(x => !x.soft)
  const outlets = set.outlets.map((o, k) => {
    const c = [0, 0, 0, 0, 0, 0, 0]
    const row = set.od[k]!
    for (let d = i0; d <= i1; d++) for (let j = 0; j < 7; j++) c[j]! += row[d * 7 + j]!
    return { ...o, k, n: c[0]!, news: c[1]!, cbKnown: c[2]!, cbYes: c[3]!, issues: set.oi[k]!.map(p => sumPairs(p, i0, i1)), stance: [c[4]!, c[5]!, c[6]!] as [number, number, number] }
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

// The whole window with what the page of an outlet reads (summary in assets/mme.js): the quotes and the tone of each outlet, and every story with its articles per outlet.
// The smaller stories (lite: articles per outlet only) join the list over the whole window.
export const mmeProfile = (set: MmeSet): MmeProfile => {
  const last = set.dates.length - 1
  const base = mmeSummary(set, 0, last)
  const outlets = base.outlets.map(o => ({
    ...o,
    quotes: set.q[o.k]!.map(p => sumPairs(p, 0, last)),
    tone: set.mt[o.k]!.map(p => sumRows(p, 4, 0, last))
  }))
  const count = outlets.length
  const stories = set.stories.map((s) => {
    const per = new Array<number>(count).fill(0)
    for (let j = 0; j < s.t.length; j += 3) per[s.t[j]!]! += s.t[j + 2]!
    return { el: s.el, en: s.en, issue: s.issue, generic: Boolean(s.generic), per }
  })
  set.lite.forEach((s) => {
    const per = new Array<number>(count).fill(0)
    for (let j = 0; j < s.o.length; j += 2) per[s.o[j]!] = s.o[j + 1]!
    stories.push({ el: s.el, en: s.en, issue: s.issue, generic: false, per })
  })
  return {
    ...base,
    outlets,
    active: outlets.filter(o => o.n > 0),
    stories: stories.map(s => ({ ...s, n: sum(s.per), reach: s.per.filter(v => v > 0).length })).filter(s => s.n > 0).sort((a, b) => b.n - a.n),
    personQuotes: set.people.map((_, p) => sum(outlets.map(o => o.quotes[p]!)))
  }
}
