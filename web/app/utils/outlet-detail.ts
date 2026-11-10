import type { MmeProfile, MmeProfileOutlet, MmeSet } from '~/types/mme'
import type { StoriesData, Story } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupRecord, GroupsData, MediaDaily } from '~/utils/groups'
import { critShare, netOf, sumPairs, sumRows } from './mme.ts'
import { outletPairs } from './profiles.ts'

// The numbers of the page of one outlet (outlet-v2.html and the cards of assets/mme.js 339 to 517): its stories, how it writes, the outlets like it, and the profile cards of ΜΜΕ & πρόσωπα.

export const OUTLET_STORIES = 16
export const OUTLET_SIMILAR = 12
export const OUTLET_MIN_SHARED = 10
export const OUTLET_COVERAGE = 5
export const OUTLET_ATTACKS = 6
export const OUTLET_EMPHASIS = 5
export const OUTLET_STANCE_LIMIT = 20
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// ———— The stories of the outlet ————

// A story of the outlet: its articles, the days, the first day of the outlet, the first day of the story over all outlets, and how many outlets wrote it.
export interface OutletStory { story: Story | undefined, n: number, days: number[], first: number, storyStart: number, reach: number }
export const outletStories = (list: StoriesData, dd: StoryDetailData, kd: number, last: number) => {
  const storyOf = new Map(list.stories.map(s => [s.id, s]))
  const mine: OutletStory[] = []
  const topicAll = new Array<number>(list.issues.length).fill(0)
  const topicMine = new Array<number>(list.issues.length).fill(0)
  const topicDays = new Map<number, number[]>()
  dd.stories.forEach((s) => {
    const story = storyOf.get(s.id)
    const days = new Array<number>(last + 1).fill(0)
    let n = 0
    let first = last
    let storyStart = last
    const covering = new Set<number>()
    for (let i = 0; i < s.t.length; i += 3) {
      const [o, day, rows] = [s.t[i]!, s.t[i + 1]!, s.t[i + 2]!]
      storyStart = Math.min(storyStart, day)
      covering.add(o)
      if (story) topicAll[story.issue]! += rows
      if (o !== kd) continue
      n += rows
      days[day]! += rows
      first = Math.min(first, day)
      if (story) {
        topicMine[story.issue]! += rows
        if (!topicDays.has(story.issue)) topicDays.set(story.issue, new Array<number>(last + 1).fill(0))
        topicDays.get(story.issue)![day]! += rows
      }
    }
    if (n) mine.push({ story, n, days, first, storyStart, reach: covering.size })
  })
  mine.sort((a, b) => b.n - a.n)
  // The latest stories: the ones the outlet started to cover most recently (the bigger story first on a day).
  const latest = mine.filter(r => r.story).sort((a, b) => b.first - a.first || b.reach - a.reach || b.n - a.n).slice(0, OUTLET_STORIES)
  const firsts = mine.filter(r => r.first === r.storyStart).length
  // The share of each topic in the stories of the outlet, and in all outlets. The topic of the catch-all rows does not count.
  const keep = (_: number, i: number) => !list.issues[i]!.catchAll
  const mineTotal = sum(topicMine.filter(keep))
  const allTotal = sum(topicAll.filter(keep))
  const topicShares = mineTotal
    ? list.issues.map((issue, i) => ({ issue, i })).filter(({ issue, i }) => !issue.catchAll && topicAll[i]).map(({ issue, i }) => ({ issue, label: '', value: topicMine[i]! / mineTotal, usual: topicAll[i]! / allTotal }))
    : []
  return { mine, latest, firsts, topicDays, topicShares, mineTotal }
}

// ———— How the outlet writes ————

// The news share, the clickbait share and the stance of the outlet, each against all outlets. Stance and clickbait come from the groups file.
export const outletWrites = (g: GroupsData, media: MediaDaily, k: number, slug: string) => {
  const files = [...g.groups.flatMap(x => x.outlets), ...(g.ungrouped ?? [])]
  const file = files.find(o => o.slug === slug)
  const allOf = (key: 'news' | 'analysed' | 'cbYes' | 'cbKnown') => sum(files.map(o => o[key]))
  const analysed = sum(media.outletDaily[k]!.map(c => c[0] ?? 0))
  const news = analysed && file ? { value: file.news / file.analysed, usual: allOf('news') / allOf('analysed') } : null
  const click = file && file.cbKnown ? { value: file.cbYes / file.cbKnown, usual: allOf('cbYes') / allOf('cbKnown') } : null
  const stanceMine = file ? file.stance : [0, 0, 0]
  const stanceAll = [0, 1, 2].map(i => sum(files.map(o => o.stance[i]!)))
  return { file, news, click, stanceMine, stanceAll, stanceN: sum(stanceMine) }
}

// ———— The outlets like it ————

export interface RelatedOutlet { slug: string, name: string, group: string | null, same: boolean, shared: number, score: number | null }
// The other outlets of the group and the outlets that write the same stories. The similarity is the shared stories over the stories of either outlet.
// A pair needs 10 shared stories, so a peer of the group with fewer has no score.
export const relatedOutlets = (dd: StoryDetailData, kd: number, slug: string, group: string | null, record: GroupRecord | null) => {
  const pairOf = new Map(outletPairs(dd).list.filter(p => p.a === kd || p.b === kd).map(p => [p.a === kd ? p.b : p.a, p]))
  const strong = [...pairOf].filter(([, p]) => p.shared >= OUTLET_MIN_SHARED).sort((a, b) => b[1].score - a[1].score).slice(0, OUTLET_SIMILAR).map(([i]) => i)
  const peers = record ? record.outlets.filter(o => o.slug !== slug).map(o => dd.outlets.findIndex(x => x.slug === o.slug)) : []
  const related: RelatedOutlet[] = [...new Set([...strong, ...peers])].map((i) => {
    const o = dd.outlets[i]!
    const p = pairOf.get(i)
    return { slug: o.slug, name: o.name, group: o.group, same: Boolean(group) && o.group === group, shared: p ? p.shared : 0, score: p && p.shared >= OUTLET_MIN_SHARED ? p.score : null }
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.shared - a.shared)
  return { related, slices: related.filter(r => r.score !== null).slice(0, OUTLET_SIMILAR), unscored: related.filter(r => r.score === null) }
}

// ———— The profile cards of ΜΜΕ & πρόσωπα (the Greek set, the whole window) ————

// The rank of a value among the outlets with at least 100 articles in the measure: 1 is the largest.
export const rankOf = (P: MmeProfile, k: number, value: (o: MmeProfileOutlet) => number, base: (o: MmeProfileOutlet) => number) => {
  const list = P.active.filter(o => base(o) >= 100)
  if (!list.some(o => o.k === k)) return null
  const mine = value(P.outlets[k]!)
  return { rank: 1 + list.filter(o => value(o) > mine).length, n: list.length }
}

// The news share and the clickbait share of the outlet with their ranks (outletFacts).
export const outletFacts = (P: MmeProfile, k: number) => {
  const o = P.outlets[k]!
  return {
    news: { share: o.news / (o.n || 1), rank: rankOf(P, k, x => x.news / x.n, x => x.n) },
    clickbait: { share: o.cbKnown ? o.cbYes / o.cbKnown : null, known: o.cbKnown, rank: rankOf(P, k, x => x.cbYes / x.cbKnown, x => x.cbKnown) }
  }
}

// The weeks of a set, Monday to Sunday. The first and the last week can be short.
export const weeksOf = (dates: string[]) => {
  const weeks: { i0: number, i1: number }[] = []
  dates.forEach((d, i) => {
    const monday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1
    if (!weeks.length || monday) weeks.push({ i0: i, i1: i })
    else weeks[weeks.length - 1]!.i1 = i
  })
  return weeks
}

export const AGENDA_LINES = 7
// The share of each topic in the news of the outlet, week by week: one line for each of the 7 largest topics of the outlet. A week with no news has no value.
export const weeklyAgenda = (set: MmeSet, k: number) => {
  const weeks = weeksOf(set.dates).map(w => ({ ...w, issues: set.oi[k]!.map((p, i) => (set.issues[i]!.soft ? 0 : sumPairs(p, w.i0, w.i1))) })).map(w => ({ ...w, n: sum(w.issues) }))
  const totals = set.issues.map((_, i) => sum(weeks.map(w => w.issues[i]!)))
  const top = totals.map((n, i) => ({ n, i })).filter(r => r.n > 0).sort((a, b) => b.n - a.n).slice(0, AGENDA_LINES).map(r => r.i)
  return { weeks, series: top.map(issue => ({ issue, values: weeks.map(w => (w.n ? w.issues[issue]! / w.n : null)) })) }
}

// The stories the outlet pushes (twice the average share of the others) and the big stories it did not run: two lists of 5.
export const coverageOf = (P: MmeProfile, k: number) => {
  const o = P.outlets[k]!
  const others = P.active.filter(x => x.k !== k)
  const news = (s: MmeProfile['stories'][number]) => !s.generic && s.issue >= 0 && P.hard[s.issue]
  const push = P.stories.filter(s => news(s) && s.per[k]! >= 5).map((s) => {
    const avg = sum(others.map(x => s.per[x.k]! / x.n)) / (others.length || 1)
    return { s, ratio: avg ? s.per[k]! / o.n / avg : Infinity }
  }).filter(r => r.ratio >= 2).sort((a, b) => b.ratio - a.ratio).slice(0, OUTLET_COVERAGE)
  const skip = P.stories.filter(s => news(s) && !s.per[k] && s.reach >= P.active.length / 2).map((s) => {
    const covering = P.active.filter(x => s.per[x.k])
    return { s, expected: (sum(covering.map(x => s.per[x.k]! / x.n)) / covering.length) * o.n }
  }).sort((a, b) => b.expected - a.expected).slice(0, OUTLET_COVERAGE)
  return { push, skip }
}

// Critical articles to the left and supportive to the right, for each topic, against all the outlets. limit: the topics with the most articles, then by critical share.
export const stanceByTopic = (P: MmeProfile, k: number, limit?: number) => {
  const set = P.set
  return set.issues.map((issue, i) => {
    const mine = sumRows(set.os[k]![i]!, 4, P.i0, P.i1)
    const all = [0, 1, 2].map(j => sum(P.outlets.map(o => sumRows(set.os[o.k]![i]!, 4, P.i0, P.i1)[j]!)))
    return { issue, mine, n: sum(mine), allCrit: critShare(all), allSup: sum(all) ? all[2]! / sum(all) : 0 }
  }).filter(r => !r.issue.soft && r.n >= 5).sort((a, b) => (limit ? b.n - a.n : 0)).slice(0, limit || Infinity).sort((a, b) => critShare(b.mine) - critShare(a.mine))
}

// What the outlet stresses more or less than all outlets: topics, frames and sections in one list, by how many times its share is the share of all outlets.
// topics are the shares of the topics in its stories; P is null for an outlet that is not in ΜΜΕ & πρόσωπα (no frames, no sections).
export interface EmphasisRow { kind: 'topic' | 'frame' | 'section', label: string, value: number, usual: number }
export const emphasisOf = (P: MmeProfile | null, k: number, topics: { label: string, value: number, usual: number }[], labels: { frame: (code: string) => string, section: (code: string) => string }) => {
  const rows: EmphasisRow[] = topics.map(r => ({ kind: 'topic', ...r }))
  if (P) {
    const set = P.set
    const frames = set.frames.map((_, f) => sumPairs(set.of[k]![f]!, P.i0, P.i1))
    const framesAll = set.frames.map((_, f) => sum(P.outlets.map(o => sumPairs(set.of[o.k]![f]!, P.i0, P.i1))))
    set.frames.forEach((code, f) => rows.push({ kind: 'frame', label: labels.frame(code), value: frames[f]! / (sum(frames) || 1), usual: framesAll[f]! / (sum(framesAll) || 1) }))
    const sections = set.osec[k]!
    const sectionsAll = set.sections.map((_, j) => sum(P.outlets.map(o => set.osec[o.k]![j]!)))
    set.sections.forEach((code, j) => rows.push({ kind: 'section', label: labels.section(code), value: sections[j]! / (sum(sections) || 1), usual: sectionsAll[j]! / (sum(sectionsAll) || 1) }))
  }
  const rated = rows.filter(r => r.usual >= 0.02).map(r => ({ ...r, ratio: r.value / r.usual }))
  const more = rated.filter(r => r.ratio > 1).sort((a, b) => b.ratio - a.ratio).slice(0, OUTLET_EMPHASIS)
  const less = rated.filter(r => r.ratio < 1).sort((a, b) => a.ratio - b.ratio).slice(0, OUTLET_EMPHASIS)
  return { more, less, top: Math.max(...[...more, ...less].map(r => Math.abs(r.ratio - 1)), 0.01) }
}

// Whom the outlet quotes, its parties against all outlets, and who attacks whom (the 6 pairs with the most statements).
export const voicesOf = (P: MmeProfile, k: number) => {
  const set = P.set
  const o = P.outlets[k]!
  const people = set.people.map((p, j) => ({ p, n: o.quotes[j]! })).filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const partyOf = (quotes: number[]) => {
    const m = new Map<string, number>()
    set.people.forEach((p, j) => { if (p.party) m.set(p.party, (m.get(p.party) ?? 0) + quotes[j]!) })
    return m
  }
  const mine = partyOf(o.quotes)
  const all = partyOf(P.personQuotes)
  const nm = sum([...mine.values()]) || 1
  const na = sum([...all.values()]) || 1
  const parties = [...all.keys()].map(p => ({ p, v: (mine.get(p) ?? 0) / nm, usual: all.get(p)! / na })).sort((a, b) => b.v - a.v)
  return { people, parties, partiesN: sum([...mine.values()]), attacks: (set.attacks[k] ?? []).slice(0, OUTLET_ATTACKS) }
}

// The tone of the outlet about each person, and the tone of the other outlets.
export const portrayalOf = (P: MmeProfile, k: number) => {
  const o = P.outlets[k]!
  const rows = P.set.people.map((p, j) => {
    const here = o.tone[j]!
    const other = [0, 1, 2].map(x => sum(P.outlets.filter(y => y.k !== k).map(y => y.tone[j]![x]!)))
    return { p, n: sum(here), here: netOf(here), other: netOf(other) }
  }).filter(r => r.n >= 5).sort((a, b) => b.n - a.n)
  return { rows, scale: Math.max(0.3, ...rows.map(r => Math.max(Math.abs(r.here), Math.abs(r.other)))) }
}

// The newest headlines of the outlet, newest first.
export const headlinesOf = (set: MmeSet, k: number) => (set.headlines[k] ?? []).slice().sort((a, b) => String(b[0]).localeCompare(String(a[0])))
