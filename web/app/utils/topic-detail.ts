import type { Story, StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { TopicsData } from '~/types/topics'

// The numbers of the topic page (topic-v2.html): the daily line of one topic, its stories, its outlets and how it is written.

// An outlet needs this many articles in stories to count; a topic needs this many articles in the 14 days before to have a change.
export const MIN_ROWS = 200
// Two topics are alike when their daily lines have at least this correlation.
export const MIN_LINK = 0.3
export const OUTLETS = 6
export const SIMILAR = 5

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const sumRange = (a: (number | null)[], i0: number, i1: number) => a.slice(i0, i1 + 1).reduce<number>((s, v) => s + (v ?? 0), 0)

// The two daily lines move together when the correlation is high.
export const correlation = (a: number[], b: number[]) => {
  const n = a.length
  const ma = sum(a) / n
  const mb = sum(b) / n
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < n; i++) { ab += (a[i]! - ma) * (b[i]! - mb); aa += (a[i]! - ma) ** 2; bb += (b[i]! - mb) ** 2 }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0
}

// The topics have no count after the coded days (null): the windows, the sparkline and the match of lines end on the last day that has one.
export const lastCoded = (home: TopicsData) => home.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0)

// The daily line of a topic, its total, its rank and share among the topics, the change of the last 14 days against the 14 before (as the table of topics), the peak day.
// A topic with fewer than MIN_ROWS articles in the 14 before has no change.
export const topicStats = (home: TopicsData, index: number) => {
  const last = lastCoded(home)
  const daily = home.issueDaily[index]!
  const total = sum(daily.map(v => v ?? 0))
  const totals = home.issueDaily.map(row => sum(row.map(v => v ?? 0)))
  const now = sumRange(daily, last - 13, last)
  const before = sumRange(daily, last - 27, last - 14)
  let peak = 0
  daily.forEach((v, i) => { if ((v ?? 0) > (daily[peak] ?? 0)) peak = i })
  return {
    last, daily, total, peak,
    rank: totals.filter(v => v > total).length + 1,
    share: total / sum(totals),
    change: before >= MIN_ROWS ? (now - before) / before : null
  }
}

// The stories of a topic with their articles and the line of days, the largest first. A generic story is a catch-all, so it is not a story.
export interface TopicStory extends Story { articles: number, values: number[] }
export const storiesOfTopic = (list: StoriesData, index: number): TopicStory[] => {
  const days = list.dates.length
  return list.stories.filter(s => s.issue === index && !s.generic).map((s) => {
    const values = new Array<number>(days).fill(0)
    let articles = 0
    for (let i = 0; i < s.days.length; i += 2) { values[s.days[i]!] = s.days[i + 1]!; articles += s.days[i + 1]! }
    return { ...s, articles, values }
  }).sort((a, b) => b.articles - a.articles)
}

// The articles in stories, for the topic and for all topics: by outlet, and the frames, the sections, the stance and the clickbait of the topic.
export const topicArticles = (list: StoriesData, dd: StoryDetailData, index: number) => {
  const inTopic = new Set(list.stories.filter(s => s.issue === index).map(s => s.id))
  const outletTopic = new Array<number>(dd.outlets.length).fill(0)
  const outletAll = new Array<number>(dd.outlets.length).fill(0)
  const det = { f: new Array<number>(8).fill(0), c: new Array<number>(10).fill(0), s: new Array<number>(4).fill(0), k: [0, 0] }
  let rowsTopic = 0
  let rowsAll = 0
  dd.stories.forEach((s) => {
    const mine = inTopic.has(s.id)
    for (let i = 0; i < s.t.length; i += 3) {
      outletAll[s.t[i]!]! += s.t[i + 2]!
      rowsAll += s.t[i + 2]!
      if (mine) { outletTopic[s.t[i]!]! += s.t[i + 2]!; rowsTopic += s.t[i + 2]! }
    }
    if (mine && s.f) {
      s.f.forEach((v, k) => { det.f[k]! += v })
      s.c!.forEach((v, k) => { det.c[k]! += v })
      s.s!.forEach((v, k) => { det.s[k]! += v })
      det.k[0]! += s.k![0]!
      det.k[1]! += s.k![1]!
    }
  })
  return { outletTopic, outletAll, det, rowsTopic, rowsAll }
}

// The share of the articles of an outlet that are in this topic against the share of the topic in all outlets; the outlets with the most and the least of it.
export interface OutletDiff { o: StoryDetailData['outlets'][number], key: string, label: string, value: number, usual: number, n: number }
export const outletDiffs = (dd: StoryDetailData, a: ReturnType<typeof topicArticles>) => {
  const usual = a.rowsAll ? a.rowsTopic / a.rowsAll : 0
  const rows: OutletDiff[] = dd.outlets.map((o, k) => ({ o, key: o.slug, label: o.name, value: a.outletAll[k]! ? a.outletTopic[k]! / a.outletAll[k]! : 0, usual, n: a.outletAll[k]! })).filter(r => r.n >= MIN_ROWS)
  return {
    rows,
    more: rows.slice().sort((x, y) => (y.value - y.usual) - (x.value - x.usual)).slice(0, OUTLETS),
    less: rows.slice().sort((x, y) => (x.value - x.usual) - (y.value - y.usual)).slice(0, OUTLETS)
  }
}

// The topics with a daily line like this one. The catch-all topic is not a match.
export const similarTopics = (home: TopicsData, index: number) => {
  const last = lastCoded(home)
  const mine = home.issueDaily[index]!.slice(0, last + 1) as number[]
  return home.issues
    .map((issue, k) => ({ issue, k, r: k === index || issue.catchAll ? -1 : correlation(mine, home.issueDaily[k]!.slice(0, last + 1) as number[]) }))
    .filter(r => r.r >= MIN_LINK).sort((a, b) => b.r - a.r).slice(0, SIMILAR)
}
