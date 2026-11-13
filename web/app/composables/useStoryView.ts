import type { MaybeRefOrGetter } from 'vue'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupsData } from '~/utils/groups'
import type { BarRow } from '~/components/charts/BarList.vue'
import type { PlegmaArticle } from '~/utils/plegma-articles'
import type { MmeData } from '~/types/mme'

// The data of one story for its view (the cards of components/plegma/cards/ and the title): the fixtures, the story's rows, its days by group, the groups with
// their outlets, how it was written and the related stories. It is the script of the old StoryDetail.vue, moved here so that every card reads one model.
export type StoryDiffRow = BarRow & { diff: number, tipText: string }

export const useStoryView = (id: MaybeRefOrGetter<number>) => {
  const { t } = useI18n()
  const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
  const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base', 'people'], isEmpty: b => b.stories.length === 0 })
  const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups'] })
  // The sample of headlines of the snapshot (mme.json): a few articles of a story with their title and link. It is not needed to show the story, so it is not part of loading.
  const mme = useFixtureLazy<MmeData>('mme', { required: ['sets'], isEmpty: b => Object.keys(b.sets).length === 0 })
  const loading = computed(() => list.status.value === 'loading' || detail.status.value === 'loading')
  const problem = computed(() => [list.status.value, detail.status.value].find(s => s !== 'ready'))
  const retry = () => { list.refresh(); detail.refresh() }

  const STANCES = ['critical', 'neutral', 'supportive'] as const
  const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))
  const groupName = (g: string | null) => g || t('story.nogroup')
  const groupColor = (g: string | null) => (g && colorOfGroup.value.get(g)) || NO_GROUP
  const dayLabel = (i: number) => fmtDay(list.data.value!.dates[i]!)

  // null when the id has no story (the 404 page).
  const model = computed(() => {
    const d = list.data.value
    const dd = detail.data.value
    if (!d || !dd || problem.value) return null
    const story = d.stories.find(s => s.id === toValue(id))
    const det = dd.stories.find(s => s.id === toValue(id))
    if (!story || !det) return null
    const r = storyRows(d, dd, det)
    const reach = reachOf(dd, det)
    const people = peopleOf(dd, det)
    const labelled = Array.isArray(det.s)
    return { d, dd, story, det, issue: d.issues[story.issue]!, ...r, people, labelled, echo: reach >= ECHO_MIN ? reach : null }
  })

  const series = computed(() => {
    const m = model.value
    if (!m) return []
    return m.groups.map(g => ({ name: groupName(g.group), color: groupColor(g.group), values: g.values.slice(m.lo, m.hi + 1) }))
  })
  // The articles of the story, first day first: the fixtures count them for each outlet and day, so each one has its day, outlet and group (the map draws one node for each).
  const articles = computed<PlegmaArticle[]>(() => {
    const m = model.value
    if (!m) return []
    const rows: { day: number, outlet: number, n: number }[] = []
    for (let i = 0; i < m.det.t.length; i += 3) rows.push({ outlet: m.det.t[i]!, day: m.det.t[i + 1]!, n: m.det.t[i + 2]! })
    rows.sort((a, b) => a.day - b.day || a.outlet - b.outlet)
    const order = new Map(m.groups.map((g, i) => [g.group ?? null, i]))
    // The outlets in the order of the ring of the outlets: group by group (as the groups' ring), the largest outlet of a group first.
    const outletOrder = new Map(m.outlets.map(r => ({ name: m.dd.outlets[r.outlet]!.name, g: order.get(m.dd.outlets[r.outlet]!.group ?? null) ?? 0, n: r.n })).sort((a, b) => a.g - b.g || b.n - a.n).map((o, i) => [o.name, i]))
    // The sampled headlines of this story, for each outlet and day: the first articles of that outlet and day carry them.
    const dates = m.d.dates
    const titles = new Map<string, { title: string, url: string | null }[]>()
    const set = mme.data.value?.sets.gr
    set?.headlines.forEach((rows, k) => rows.forEach(([date, title, url, , , story]) => {
      if (story !== m.story.el) return
      const key = `${set.outlets[k]!.name}|${dates.indexOf(date)}`
      titles.set(key, [...(titles.get(key) ?? []), { title, url }])
    }))
    return rows.flatMap(({ day, outlet, n }) => {
      const o = m.dd.outlets[outlet]!
      const base: PlegmaArticle = { day, outlet: o.name, group: o.group, slot: slotOfColor(groupColor(o.group)), order: Math.max(0, order.get(o.group ?? null) ?? 0), outletOrder: outletOrder.get(o.name) ?? 0 }
      const known = titles.get(`${o.name}|${day}`)
      return Array.from({ length: n }, (_, i) => (known?.[i] ? { ...base, ...known[i]! } : base))
    })
  })
  const shown = computed(() => (model.value ? model.value.d.dates.slice(model.value.lo, model.value.hi + 1) : []))
  const dailyTip = (i: number) => {
    const total = series.value.reduce((a, x) => a + x.values[i]!, 0)
    const parts = series.value.filter(x => x.values[i]! > 0).reverse().map(x => `${x.name} ${fmtInt(x.values[i]!)}`).join(' · ')
    return `${t('story.daily.tip', { date: fmtDate(shown.value[i]!), n: fmtInt(total) })}${parts ? `: ${parts}` : ''}`
  }

  // The groups and their outlets in one card, as Άρθρα ανά όμιλο of Ιδιοκτησία.
  const tree = computed(() => {
    const m = model.value
    if (!m) return []
    const record = new Map((groupsData.data.value?.groups ?? []).map(g => [g.name, g]))
    return m.groups.map((g) => {
      const outs = m.outlets.filter(r => m.dd.outlets[r.outlet]!.group === g.group)
      return {
        key: g.group || null, label: groupName(g.group), color: groupColor(g.group), value: g.n, slug: record.get(g.group ?? '')?.slug,
        outlets: outs.map(r => ({ ...m.dd.outlets[r.outlet]!, value: r.n })), articles: outs
      }
    })
  })

  // The outlets of the story as the parts of a strip (OutletStack), the largest first, each in the color of its group.
  const outletParts = computed(() => {
    const m = model.value
    return m ? m.outlets.map((r) => { const o = m.dd.outlets[r.outlet]!; return { name: o.name, slug: o.slug, group: o.group, n: r.n, color: groupColor(o.group) } }) : []
  })

  // The groups of the story as the parts of a strip, the largest first.
  const groupParts = computed(() => (model.value ? tree.value.map(g => ({ name: g.label, group: g.key, n: g.value, color: g.color, to: g.slug ? groupPageHref(g.slug) : undefined })).sort((a, b) => b.n - a.n) : []))

  // The stance of the story against all articles (StanceCard): the total of the story is in the note under it.
  const stance = computed(() => {
    const m = model.value
    return m?.labelled ? { total: totalOf(m.det.s!.slice(1)) } : null
  })

  // How the story was written: for each measure, how far the story is from all articles. The rows share one scale, so the bars compare.
  const diffRow = (r: DiffRowData): StoryDiffRow => {
    const diff = r.value - r.usual
    return {
      key: r.label, label: r.label, text: fmtPct(r.value), value: 0, color: '', diff,
      tipText: t('story.how.tip', { label: r.label, value: fmtPct(r.value), usual: fmtPct(r.usual), diff: `${diff >= 0 ? '+' : '−'}${fmtPct(Math.abs(diff))}` })
    }
  }
  const how = computed(() => {
    const m = model.value
    if (!m?.labelled) return null
    const { det, dd } = m
    const rowsOf = (key: 'f' | 'c', labels: string[], prefix: string, count: number) =>
      diffRows(det[key]!.map((_, i) => ({ label: t(`story.${prefix}.${labels[i]}`), value: share(det[key]!, i), usual: share(dd.base[key], i) })), count)
    const stanceN = totalOf(det.s!.slice(1))
    const stanceRaw = STANCES.map((code, i) => ({ label: t(`stance.${code}`), value: share(det.s!.slice(1), i, stanceN), usual: share(dd.base.s.slice(1), i, totalOf(dd.base.s.slice(1))) }))
    const [scored, baited] = det.k!
    const clickRaw = scored ? [{ label: t('story.how.clickbait'), value: baited! / scored, usual: dd.base.k[1]! / dd.base.k[0]! }] : []
    const panels = [
      { title: t('story.how.frame'), rows: rowsOf('f', dd.frames, 'frame', 8), note: null as string | null },
      { title: t('story.how.section'), rows: rowsOf('c', dd.sections, 'section', 6), note: null },
      { title: '', rows: stanceN ? stanceRaw : [], note: null },
      { title: t('story.how.clickbait'), rows: clickRaw, note: scored ? t('story.how.clickbait.n', { n: fmtInt(baited!), total: fmtInt(scored) }) : t('story.how.clickbait.none') }
    ]
    // The section is not shown: the card is the frame and the clickbait, on one scale.
    const shownPanels = [panels[0]!, panels[3]!]
    const scale = Math.max(0.05, ...shownPanels.flatMap(p => p.rows.map(r => Math.abs(r.value - r.usual))))
    const column = (items: typeof panels) => items.map(p => ({ title: p.title, rows: p.rows.map(diffRow), note: p.note }))
    return { scale, columns: [column([panels[0]!]), column([panels[3]!])] }
  })

  const related = computed(() => {
    const m = model.value
    if (!m) return []
    const days = m.last + 1
    return relatedStories(m.d.stories.filter(s => !s.generic), m.story, s => dailyOf(s, days)).map(r => ({ ...r, articles: articlesOf(r.s), values: dailyOf(r.s, days) }))
  })

  return { loading, problem, retry, model, series, articles, shown, dailyTip, tree, outletParts, groupParts, stance, how, related, dayLabel }
}

export type StoryView = ReturnType<typeof useStoryView>
export type StoryModel = NonNullable<StoryView['model']['value']>
