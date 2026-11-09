import type { TopicsData, TopicRow, Series } from '~/types/topics'

const ROLL = 7
const sumRange = (a: (number | null)[], i0: number, i1: number) => {
  let s = 0
  for (let i = i0; i <= i1; i++) s += a[i] ?? 0
  return s
}

// The data of Θέματα and what is computed from it (the same arithmetic as topics-v2.html).
export const useTopics = async () => {
  const { data, status, refresh } = await useFixture<TopicsData>('home', { required: ['dates', 'issues', 'issueDaily'], isEmpty: b => b.dates.length === 0 })
  const period = usePeriodStore()

  // The topics have no count after the coded days (null), so the period, lines and donut end on the last day that has one.
  const dates = computed(() => {
    const d = data.value
    if (!d) return []
    const last = d.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0)
    return d.dates.slice(0, last + 1)
  })
  const view = computed(() => {
    const ds = dates.value
    const ok = period.from && period.to && ds.includes(period.from) && ds.includes(period.to)
    return { from: ok ? period.from! : ds[0] ?? '', to: ok ? period.to! : ds[ds.length - 1] ?? '' }
  })
  const range = computed(() => [dates.value.indexOf(view.value.from), dates.value.indexOf(view.value.to)] as const)

  const rows = computed<TopicRow[]>(() => {
    const d = data.value
    if (!d || !dates.value.length) return []
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

  // The 8 largest topics of the period (not the catch-all) have a color slot, the same in the lines and in the donut. The others are neutral.
  const offered = computed(() => rows.value.filter(r => !r.issue.catchAll).slice(0, 8))
  const colorOf = computed(() => new Map(offered.value.map((r, i) => [r.k, `var(--cat-${i + 1})`])))
  const series = computed<Series[]>(() => {
    const [i0, i1] = range.value
    return offered.value.map((r, i) => ({
      key: String(r.k),
      name: topicName(r.issue),
      color: `var(--cat-${i + 1})`,
      values: r.daily.map((_, j) => {
        const from = Math.max(0, j - ROLL + 1)
        return sumRange(r.daily, from, j) / (j - from + 1)
      }).slice(i0, i1 + 1)
    }))
  })

  // The 5 that rise most and the 5 that fall most; the largest fall is the last row.
  const movers = computed(() => {
    const m = rows.value.filter(r => r.change !== null && !r.issue.catchAll).sort((a, b) => b.change! - a.change!)
    return [...m.filter(r => r.change! > 0).slice(0, 5), ...m.filter(r => r.change! < 0).slice(-5)]
  })

  return { status, refresh, dates, view, range, rows, total, colorOf, series, movers }
}
