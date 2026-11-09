import type { TopicsData, TopicRow, Series } from '~/types/topics'

const ROLL = 7
const sumRange = (a: (number | null)[], i0: number, i1: number) => {
  let s = 0
  for (let i = i0; i <= i1; i++) s += a[i] ?? 0
  return s
}

export const useTopics = async () => {
  const { data, status, error, refresh } = await useFetch<TopicsData>('/data/topics.json', { key: 'topics' })
  const period = usePeriodStore()

  // The data has no count after the coded days (null), so every view ends on the last day that has one.
  const dates = computed(() => {
    const d = data.value
    if (!d) return []
    const last = d.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0)
    return d.dates.slice(0, last + 1)
  })
  const range = computed(() => {
    const ds = dates.value
    const a = period.from && ds.includes(period.from) ? ds.indexOf(period.from) : 0
    const b = period.to && ds.includes(period.to) ? ds.indexOf(period.to) : ds.length - 1
    return [a, b] as const
  })

  const rows = computed<TopicRow[]>(() => {
    const d = data.value
    if (!d) return []
    const last = dates.value.length - 1
    const [i0, i1] = range.value
    return d.issues.map((issue, k) => {
      const daily = d.issueDaily[k]!.slice(0, last + 1)
      const now = last >= 27 ? sumRange(daily, last - 13, last) : 0
      const before = last >= 27 ? sumRange(daily, last - 27, last - 14) : 0
      return { k, issue, daily, count: sumRange(daily, i0, i1), change: before >= 200 ? (now - before) / before : null }
    }).filter(r => r.count > 0).sort((a, b) => b.count - a.count)
  })
  const total = computed(() => rows.value.reduce((s, r) => s + r.count, 0))

  // The 8 largest topics (not the catch-all) have a color slot, the same in the lines and in the donut.
  const offered = computed(() => rows.value.filter(r => !r.issue.catchAll).slice(0, 8))
  const colorOf = computed(() => new Map(offered.value.map((r, i) => [r.k, `var(--cat-${i + 1})`])))

  const series = computed<Series[]>(() => {
    const [i0, i1] = range.value
    return offered.value.map((r, i) => ({
      key: String(r.k),
      name: r.issue.el,
      color: `var(--cat-${i + 1})`,
      values: r.daily.map((_, j) => {
        const from = Math.max(0, j - ROLL + 1)
        return sumRange(r.daily, from, j) / (j - from + 1)
      }).slice(i0, i1 + 1)
    }))
  })

  const movers = computed(() => {
    const m = rows.value.filter(r => r.change !== null && !r.issue.catchAll).sort((a, b) => b.change! - a.change!)
    return [...m.filter(r => r.change! > 0).slice(0, 5), ...m.filter(r => r.change! < 0).slice(-5)]
  })

  return { status, error, refresh, dates, range, rows, total, colorOf, series, movers }
}
