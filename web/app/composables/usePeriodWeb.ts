import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import { homeIndex, homeOutletsOf } from '~/utils/home'
import { groupColors, NO_GROUP, slotOfColor } from '~/utils/groups'
import type { GroupsData } from '~/utils/groups'
import { dayDots } from '~/utils/plegma-day'
import type { PlegmaDayTheme } from '~/utils/plegma-day'
import type { DayOutlet } from '~/components/PlegmaDayWeb.vue'

// The web of a period on the pages of Μέσα (components/PlegmaDayWeb.vue, the web of Home's day, over the days `from` to `to`): the largest stories of the period, each with a dot
// for its articles in the colors of the groups that ran them, grouped by theme; and the outlets of the period for the ring of the stories. Drawn in the browser: the data of the
// stories is some MB that the prerendered page should not carry.
export const PERIOD_WEB_STORIES = 18
export const PERIOD_WEB_THEMES = 8

export const usePeriodWeb = (from: Ref<string>, to: Ref<string>, slotOfIssue: Ref<Map<number, number>>) => {
  const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
  const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 })
  const groups = useFixtureLazy<GroupsData>('groups', { required: ['groups'], isEmpty: b => b.groups.length === 0 })

  const ix = computed(() => (list.data.value ? homeIndex({ stories: list.data.value, detail: detail.data.value }) : null))
  const colorOf = computed(() => groupColors(groups.data.value?.groups ?? []))
  const groupSlot = (g: string | null) => slotOfColor((g && colorOf.value.get(g)) || NO_GROUP)
  // The days of the period in the dates of the stories (they run on after the coded topics end); null when the period is not in them.
  const span = computed(() => {
    const ds = ix.value?.dates ?? []
    const i0 = ds.indexOf(from.value)
    const i1 = ds.indexOf(to.value)
    return i0 >= 0 && i1 >= i0 ? [i0, i1] as const : null
  })
  // The stories of the period with their articles summed, the largest first (a generic story is a bucket, not a story: homeIndex leaves it out).
  const rows = computed(() => {
    const x = ix.value
    const s = span.value
    if (!x || !s) return []
    const totals = new Map<number, { s: (typeof x.byDay)[number][number]['s'], n: number }>()
    for (let d = s[0]; d <= s[1]; d++) {
      for (const r of x.byDay[d] ?? []) {
        const have = totals.get(r.s.id)
        if (have) have.n += r.n
        else totals.set(r.s.id, { s: r.s, n: r.n })
      }
    }
    return [...totals.values()].sort((a, b) => b.n - a.n)
  })

  const storyOf = (r: (typeof rows.value)[number]) => {
    const outlets = homeOutletsOf(ix.value!, r.s, span.value![0], span.value![1])
    const bySlot = new Map<number, number>()
    for (const o of outlets) bySlot.set(groupSlot(o.group), (bySlot.get(groupSlot(o.group)) ?? 0) + o.n)
    const counts = [...bySlot].map(([slot, n]) => ({ slot, n })).sort((a, b) => b.n - a.n)
    return { id: r.s.id, name: storyName(r.s), n: r.n, media: outlets.length || r.s.outlets, dots: dayDots(r.n, counts) }
  }

  // The largest stories of the period grouped by theme, the largest themes first; the stories of a theme that are not shown are counted for its faint dots.
  // `only` keeps the themes of the given issues (all, when it is null).
  const themesOf = (count = PERIOD_WEB_STORIES, maxThemes = PERIOD_WEB_THEMES) => {
    const x = ix.value
    if (!x || !rows.value.length) return [] as PlegmaDayTheme[]
    const total = new Map<number, number>()
    const rest = new Map<number, number>()
    rows.value.forEach((r, k) => {
      total.set(r.s.issue, (total.get(r.s.issue) ?? 0) + r.n)
      if (k >= count) rest.set(r.s.issue, (rest.get(r.s.issue) ?? 0) + 1)
    })
    const byIssue = new Map<number, PlegmaDayTheme>()
    for (const r of rows.value.slice(0, count)) {
      let theme = byIssue.get(r.s.issue)
      if (!theme) {
        theme = { issue: r.s.issue, name: topicName(x.issues[r.s.issue]!), slot: slotOfIssue.value.get(r.s.issue) ?? 0, n: total.get(r.s.issue) ?? 0, stories: [], rest: rest.get(r.s.issue) ?? 0 }
        byIssue.set(r.s.issue, theme)
      }
      theme.stories.push(storyOf(r))
    }
    return [...byIssue.values()].sort((a, b) => b.n - a.n).slice(0, maxThemes)
  }

  // The given themes (the colored ones of the page), each with its `per` largest stories of the period, in the order given; their other stories are counted for the faint dots.
  const themesFor = (issues: number[], per = 3) => {
    const x = ix.value
    if (!x || !rows.value.length) return [] as PlegmaDayTheme[]
    return issues.map((issue) => {
      const mine = rows.value.filter(r => r.s.issue === issue)
      return { issue, name: topicName(x.issues[issue]!), slot: slotOfIssue.value.get(issue) ?? 0, n: mine.reduce((a, r) => a + r.n, 0), stories: mine.slice(0, per).map(storyOf), rest: Math.max(0, mine.length - per) }
    }).filter(t => t.stories.length)
  }

  // The outlets of the period, the largest first, each in the color of its group: the arcs of the ring of the stories.
  const outlets = computed<DayOutlet[]>(() => {
    const x = ix.value
    const s = span.value
    if (!x?.detail || !s) return []
    const perOutlet = new Map<string, DayOutlet>()
    for (const r of rows.value) {
      for (const o of homeOutletsOf(x, r.s, s[0], s[1])) {
        const have = perOutlet.get(o.name)
        if (have) have.n += o.n
        else perOutlet.set(o.name, { name: o.name, slot: groupSlot(o.group), n: o.n, group: o.group ?? null })
      }
    }
    return [...perOutlet.values()].sort((a, b) => b.n - a.n)
  })

  // The same arcs by group: the articles of the outlets of each group, the largest first (the outlets with no group are one arc).
  const { t } = useI18n()
  const groupRing = computed<DayOutlet[]>(() => {
    const perGroup = new Map<string, DayOutlet>()
    for (const o of outlets.value) {
      const name = o.group ?? t('story.nogroup')
      const have = perGroup.get(name)
      if (have) have.n += o.n
      else perGroup.set(name, { name, slot: o.slot, n: o.n })
    }
    return [...perGroup.values()].sort((a, b) => b.n - a.n)
  })

  const ready = computed(() => !!ix.value && !!detail.data.value && !!groups.data.value)
  return { ready, rows, themesOf, themesFor, outlets, groupRing }
}
