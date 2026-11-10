import type { Story, StoriesData } from '~/types/stories'
import type { DetailRow, StoryDetailData } from '~/types/story-detail'

// The numbers of the story page (story-v2.html and assets/spread.js): the rows of the story, its days, its groups, its people and the stories like it.

// The window of the daily chart is at least this many days, and the card of the related stories lists this many.
export const MIN_DAYS = 14
export const RELATED = 6
// A story is an echo when this many ownership groups wrote it on one day (Spread.ECHO_MIN).
export const ECHO_MIN = 4

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// The articles of a story on each day of the window.
export const dailyOf = (s: Story, days: number) => {
  const v = new Array<number>(days).fill(0)
  for (let i = 0; i < s.days.length; i += 2) v[s.days[i]!] = s.days[i + 1]!
  return v
}
export const articlesOf = (s: Story) => s.days.reduce((total, v, i) => (i % 2 ? total + v : total), 0)

// Related stories. The topic is too general: the topic "Θάνατος Μαζωνάκη" holds 11 other deaths. A story is related when its title has rare words in common
// (the stem is the first 6 letters, so the endings of Greek words do not matter) or when it has articles on the same days. Common words have no weight.
const stem = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 6)
const wordsOf = (name: string): [string, string][] =>
  [...new Set((name.match(/[\p{L}]{4,}/gu) || []).map(w => [stem(w), w] as const).map(([s, w]) => `${s}|${w}`))].map(x => x.split('|') as [string, string])
export interface Related { s: Story, shared: string[], nameScore: number, cosine: number, score: number }
export const relatedStories = (stories: Story[], target: Story, daysOf: (s: Story) => number[]): Related[] => {
  const df = new Map<string, number>()
  const bag = new Map(stories.map(s => [s.id, new Map(wordsOf(s.el))]))
  bag.forEach(words => words.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1)))
  const rare = (k: string) => df.get(k)! <= 12
  const mine = bag.get(target.id)!
  const mineRare = [...mine.keys()].filter(rare)
  const idf = (k: string) => Math.log(stories.length / df.get(k)!)
  const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  const myDays = daysOf(target)
  const myNorm = norm(myDays)
  const weight = mineRare.reduce((s, k) => s + idf(k), 0) || 1
  return stories.filter(s => s.id !== target.id).map((s) => {
    const shared = mineRare.filter(k => bag.get(s.id)!.has(k))
    const nameScore = shared.reduce((total, k) => total + idf(k), 0) / weight
    const other = daysOf(s)
    const cosine = other.reduce((total, v, i) => total + v * myDays[i]!, 0) / (norm(other) * myNorm)
    return { s, shared: shared.map(k => mine.get(k)!), nameScore, cosine, score: 0.65 * nameScore + 0.35 * cosine }
  }).filter(r => r.nameScore > 0 || r.cosine >= 0.8).sort((a, b) => b.score - a.score).slice(0, RELATED)
}

// The most ownership groups that wrote the story on one day (reach of Spread.profiles). An outlet with no group does not count.
export const reachOf = (dd: StoryDetailData, det: DetailRow) => {
  const byDay = new Map<number, Set<string>>()
  for (let i = 0; i < det.t.length; i += 3) {
    const g = dd.outlets[det.t[i]!]!.group
    if (!g) continue
    const day = det.t[i + 1]!
    byDay.set(day, (byDay.get(day) ?? new Set()).add(g))
  }
  return Math.max(0, ...[...byDay.values()].map(set => set.size))
}

export interface OutletRow { outlet: number, n: number, first: number }
export interface GroupRow { group: string | null, n: number, values: number[] }

// What the page shows about one story: for each outlet the articles and the first day, for each group the line of days, the first and last day, the peak day.
export const storyRows = (list: StoriesData, dd: StoryDetailData, det: DetailRow) => {
  const last = list.dates.length - 1
  const byOutlet = new Map<number, OutletRow>()
  const byGroup = new Map<string | null, GroupRow>()
  const perDay = new Array<number>(last + 1).fill(0)
  let start = last
  let end = 0
  for (let i = 0; i < det.t.length; i += 3) {
    const [o, day, n] = [det.t[i]!, det.t[i + 1]!, det.t[i + 2]!]
    start = Math.min(start, day)
    end = Math.max(end, day)
    perDay[day]! += n
    const rec = byOutlet.get(o) ?? { outlet: o, n: 0, first: day }
    rec.n += n
    byOutlet.set(o, rec)
    const g = dd.outlets[o]!.group
    const line = byGroup.get(g) ?? { group: g, n: 0, values: new Array<number>(last + 1).fill(0) }
    line.n += n
    line.values[day]! += n
    byGroup.set(g, line)
  }
  const outlets = [...byOutlet.values()].sort((a, b) => b.n - a.n)
  const groups = [...byGroup.values()].sort((a, b) => b.n - a.n)
  const peak = perDay.indexOf(Math.max(...perDay))
  // The window of the chart is at least MIN_DAYS days, so a short story does not fill it with wide bars.
  let lo = start
  let hi = end
  while (hi - lo + 1 < MIN_DAYS && (lo > 0 || hi < last)) {
    if (lo > 0) lo--
    if (hi - lo + 1 < MIN_DAYS && hi < last) hi++
  }
  return { last, outlets, groups, perDay, start, end, peak, lo, hi, articles: sum(outlets.map(r => r.n)) }
}

// The people of a story, the most mentioned first.
export const peopleOf = (dd: StoryDetailData, det: DetailRow) => {
  const people: { person: StoryDetailData['people'][number], counts: number[] }[] = []
  for (let i = 0; i < det.p.length; i += 4) people.push({ person: dd.people[det.p[i]!]!, counts: det.p.slice(i + 1, i + 4) })
  return people.sort((a, b) => sum(b.counts) - sum(a.counts))
}

// A row of the difference view: the share of the story, the usual share in all articles, and the bar that goes right when the story has more.
export interface DiffRowData { label: string, value: number, usual: number }
export const share = (arr: number[], i: number, total = sum(arr)) => (total ? arr[i]! / total : 0)
// A row shows when the story has articles of that kind. The 2 kinds that are common in all articles and missing in the story show too: that is a finding.
export const diffRows = (rows: DiffRowData[], count: number) => {
  const present = rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, count)
  const missing = rows.filter(r => r.value === 0).sort((a, b) => b.usual - a.usual).slice(0, 2)
  return [...present, ...missing]
}
export const totalOf = sum
// The scale of the bars of one card: the largest difference, at least 0.05 (Entity.scaleOf). The rows of the card share it, so the bars compare.
export const diffScale = (rows: DiffRowData[]) => Math.max(0.05, ...rows.map(r => Math.abs(r.value - r.usual)))
