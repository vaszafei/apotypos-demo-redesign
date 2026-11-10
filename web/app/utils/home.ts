import type { Story, StoryIssue } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'

// The lookups of Αρχική (Home.index, Home.rangeInfo and Home.outletsOf of assets/home.js): the stories of a day ranked by articles,
// and the outlets of a story. scripts/home.test.mjs runs the static code next to this one.

export interface HomeIndexInput { dates: string[], issues: StoryIssue[], stories: Story[] }
export interface HomeIndex {
  byDay: { s: Story, n: number }[][]
  rowsOf: Map<number, number[]>
  detail: StoryDetailData | null
  dates: string[]
  issues: StoryIssue[]
}
export interface HomeOutlet { name: string, slug: string, group: string | null, total: number, k: number, n: number }
export interface RangeInfo { d: string, date: string, story: Story, n: number, rank: number, topic: StoryIssue, outlets: HomeOutlet[], list: { s: Story, n: number }[] }

// A generic story ("Άλλα διεθνή") is a bucket, not a story, so it does not count.
export const homeIndex = ({ stories, detail }: { stories: HomeIndexInput, detail: StoryDetailData | null }): HomeIndex => {
  const byDay: HomeIndex['byDay'] = stories.dates.map(() => [])
  for (const s of stories.stories) {
    if (s.generic) continue
    for (let j = 0; j < s.days.length; j += 2) byDay[s.days[j]!]!.push({ s, n: s.days[j + 1]! })
  }
  byDay.forEach(list => list.sort((a, b) => b.n - a.n))
  const rowsOf = new Map<number, number[]>(detail ? detail.stories.map(s => [s.id, s.t] as [number, number[]]) : [])
  return { byDay, rowsOf, detail, dates: stories.dates, issues: stories.issues }
}

// The outlets that ran a story in the days i0 to i1, with their articles, the largest first.
export const homeOutletsOf = (ix: HomeIndex, s: Story, i0: number, i1: number): HomeOutlet[] => {
  const detail = ix.detail
  const from = detail ? detail.dates.indexOf(ix.dates[i0]!) : -1
  const to = detail ? detail.dates.indexOf(ix.dates[i1]!) : -1
  const perOutlet = new Map<number, number>()
  const rows = ix.rowsOf.get(s.id)
  if (rows && from >= 0 && to >= 0) {
    for (let j = 0; j < rows.length; j += 3) {
      const day = rows[j + 1]!
      if (day >= from && day <= to) perOutlet.set(rows[j]!, (perOutlet.get(rows[j]!) || 0) + rows[j + 2]!)
    }
  }
  return [...perOutlet].map(([k, c]) => ({ ...detail!.outlets[k]!, k, n: c })).sort((a, b) => b.n - a.n)
}

// The stories of a period (the days i0 to i1) with their articles summed over it, the largest first; `rank` picks the lead.
export const homeRange = (ix: HomeIndex, i0: number, i1: number, rank = 0): RangeInfo | null => {
  const totals = new Map<Story, number>()
  for (let d = i0; d <= i1; d++) for (const { s, n } of ix.byDay[d] ?? []) totals.set(s, (totals.get(s) || 0) + n)
  const list = [...totals].map(([s, n]) => ({ s, n })).sort((a, b) => b.n - a.n)
  const lead = list[rank]
  if (!lead) return null
  const { s, n } = lead
  return { d: `${i0}-${i1}`, date: ix.dates[i1]!, story: s, n, rank, topic: ix.issues[s.issue]!, outlets: homeOutletsOf(ix, s, i0, i1), list }
}

// The days of the latest week that Home frames: the last seven days of the stories' dates.
export const WEEK_DAYS = 7
// Nine webs on Home, four on a phone (the hero's MAXC and its phone count).
export const HOME_WEBS = 9
export const HOME_WEBS_PHONE = 4

// The best stories of the latest week: the most articles in the last seven days, generic stories left out, in the order of Home.rangeInfo.
export const bestOfWeek = (ix: HomeIndex, count = HOME_WEBS): Story[] => {
  const last = ix.dates.length - 1
  const info = homeRange(ix, Math.max(0, last - WEEK_DAYS + 1), last)
  return info ? info.list.slice(0, count).map(r => r.s) : []
}
