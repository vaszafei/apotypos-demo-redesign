import type { Story, StoryDay, StoryTrend } from '~/types/stories'

// The lines of Μέσα › Ιστορίες: how many stories the line chart draws, how many rise and fall in Τάσεις, and the articles a story needs in the period before to count.
export const LINE_STORIES = 8
export const TREND_STORIES = 5
export const TREND_MIN = 10

// The stories of each day, the largest first (Home.index of assets/home.js). A generic story is not a story, so it does not count.
export const storiesByDay = (stories: Story[], days: number): StoryDay[][] => {
  const byDay: StoryDay[][] = Array.from({ length: days }, () => [])
  for (const s of stories) {
    if (s.generic) continue
    for (let j = 0; j < s.days.length; j += 2) byDay[s.days[j]!]!.push({ s, n: s.days[j + 1]! })
  }
  byDay.forEach(list => list.sort((a, b) => b.n - a.n))
  return byDay
}

// The articles of each story in the days i0 to i1 (a Map keeps the order in which the stories first appear).
const sumOver = (byDay: StoryDay[][], i0: number, i1: number) => {
  const totals = new Map<Story, number>()
  for (let d = i0; d <= i1; d++) for (const { s, n } of byDay[d] ?? []) totals.set(s, (totals.get(s) ?? 0) + n)
  return totals
}

// Every story that ran in the period, the largest first (the list of Home.rangeInfo).
export const storiesOfPeriod = (byDay: StoryDay[][], i0: number, i1: number): StoryDay[] =>
  [...sumOver(byDay, i0, i1)].map(([s, n]) => ({ s, n })).sort((a, b) => b.n - a.n)

// The articles of every story in the period against the period of the same length right before it. A story needs TREND_MIN articles in the period before to count, so a story that is only starting does not
// show a change of thousands of per cent. null when there is no period before.
export const storyTrends = (byDay: StoryDay[][], i0: number, i1: number) => {
  const len = i1 - i0 + 1
  const p0 = i0 - len
  if (p0 < 0) return null
  const now = sumOver(byDay, i0, i1)
  const before = sumOver(byDay, p0, i0 - 1)
  const rows: StoryTrend[] = [...before].filter(([, n]) => n >= TREND_MIN).map(([s, n]) => ({ s, now: now.get(s) ?? 0, before: n, change: ((now.get(s) ?? 0) - n) / n }))
  const up = rows.filter(r => r.change > 0).sort((a, b) => b.change - a.change || b.now - a.now).slice(0, TREND_STORIES)
  const down = rows.filter(r => r.change < 0).sort((a, b) => a.change - b.change || b.before - a.before).slice(0, TREND_STORIES)
  const widest = Math.max(...up.concat(down).map(r => Math.abs(r.change)), 0)
  return { p0, len, up, down, widest }
}

// The first LINE_STORIES stories of the period as lines, over the days of the period only: the axis starts on its first day and ends on its last.
export const storyLines = (list: StoryDay[], i0: number, i1: number) => {
  const shown = list.slice(0, LINE_STORIES)
  const d0 = i0
  const lines = shown.map(({ s }) => {
    const values = new Array<number>(i1 - d0 + 1).fill(0)
    for (let j = 0; j < s.days.length; j += 2) if (s.days[j]! >= d0 && s.days[j]! <= i1) values[s.days[j]! - d0] = s.days[j + 1]!
    return { s, values }
  })
  return { d0, d1: i1, lines }
}
