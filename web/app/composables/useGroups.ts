import type { GroupsData, MediaDaily, NetGroup, NetOutlet } from '~/utils/groups'

// The data of Ιδιοκτησία and what is computed from it (the same arithmetic as groups-v2.html).
export const useGroups = async () => {
  // The i18n instance is taken before the await: after it the Nuxt context is gone on the server.
  const { t } = useI18n()
  const [groupsFixture, mediaFixture] = await Promise.all([
    useFixture<GroupsData>('groups', { required: ['groups', 'ungrouped', 'totalCollected', 'window'], isEmpty: b => b.groups.length === 0 }),
    useFixture<MediaDaily>('media', { required: ['dates', 'outlets', 'outletDaily'], isEmpty: b => b.outlets.length === 0 })
  ])
  const { data, status, refresh } = groupsFixture
  const empty = computed(() => status.value === 'empty')

  const groups = computed(() => (empty.value || !data.value ? [] : data.value.groups.filter(g => g.collected > 0)))
  const colorOf = computed(() => groupColors(data.value?.groups ?? []))
  const total = computed(() => (empty.value || !data.value ? 0 : data.value.totalCollected))
  const grouped = computed(() => groups.value.reduce((s, g) => s + g.collected, 0))
  const ungroupedTotal = computed(() => (empty.value || !data.value ? 0 : data.value.ungrouped.reduce((s, o) => s + o.collected, 0)))

  const outletOf = (o: GroupsData['ungrouped'][number]): NetOutlet => ({ name: o.name, slug: o.slug, value: o.collected, analysed: o.analysed, news: o.news, stance: o.stance })
  const byValue = (outlets: GroupsData['ungrouped']) => outlets.filter(o => o.collected > 0).map(outletOf).sort((a, b) => b.value - a.value)
  // The groups of the network and the share card, then the outlets with no group last.
  const treeGroups = computed<NetGroup[]>(() => {
    const d = data.value
    if (!d) return []
    const list: NetGroup[] = groups.value.map(g => ({ key: g.name, label: g.name, owner: g.owner, color: colorOf.value.get(g.name)!, slug: g.slug, lean: g.lean, outlets: byValue(g.outlets), value: 0 }))
    if (ungroupedTotal.value) list.push({ key: null, label: t('media2.groups.none'), owner: null, color: NO_GROUP, outlets: byValue(d.ungrouped), value: 0 })
    for (const g of list) g.value = g.outlets.reduce((s, o) => s + o.value, 0)
    return list
  })
  const top3 = computed(() => treeGroups.value.filter(g => g.key !== null).slice().sort((a, b) => b.value - a.value).slice(0, 3).reduce((a, g) => a + g.value, 0))

  // Lines: the articles of each day for each group, from the days of media.json (they run past the window of the groups file).
  const media = computed(() => (mediaFixture.status.value === 'ready' ? mediaFixture.data.value : null))
  const stacks = computed(() => {
    const m = media.value
    const d = data.value
    if (!m || !d || empty.value) return []
    const groupOf = new Map<string, string | null>([...groups.value.flatMap(g => g.outlets.map(o => [o.slug, g.name] as const)), ...d.ungrouped.map(o => [o.slug, null] as const)])
    return m.dates.map((_, i) => treeGroups.value.map(g => ({
      g,
      value: m.outlets.reduce((a, out, k) => (groupOf.has(out.slug) && groupOf.get(out.slug) === g.key ? a + (m.outletDaily[k]![i]![0] ?? 0) : a), 0)
    })))
  })
  const volumeTotal = computed(() => stacks.value.reduce((s, day) => s + day.reduce((a, x) => a + x.value, 0), 0))

  // The stance of each group; a group with fewer than 30 analysed articles is left out.
  const stanceRows = computed(() => groups.value.map((g) => {
    const s = stanceTotals(g.outlets)
    const n = s[0] + s[1] + s[2]
    return { g, crit: s[0] / n, neu: s[1] / n, sup: s[2] / n, n }
  }).filter(r => r.n >= 30))

  return { status, refresh, data, empty, groups, colorOf, total, grouped, treeGroups, top3, media, stacks, volumeTotal, stanceRows }
}
