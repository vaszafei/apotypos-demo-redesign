import type { MmeData, MmeLiteData } from '~/types/mme'
import type { GroupsData } from '~/utils/groups'

// The data of Μέσα › Επισκόπηση and Στάση and the period they share (the same arithmetic as media-v2.html): the Greek set of outlets, summed for the chosen days.
export const useMme = async () => {
  // The store before the await: after it the Nuxt context is gone on the server.
  const period = usePeriodStore()
  const [mme, groupsFixture] = await Promise.all([
    useFixture<MmeData, MmeLiteData>('mme', { required: ['sets'], isEmpty: b => Object.keys(b.sets).length === 0 }, { as: 'mme-lite', transform: mmeLite }),
    useFixture<GroupsData>('groups', { required: ['groups'] })
  ])
  const { data, status, refresh } = mme

  const set = computed(() => data.value?.sets.gr ?? null)
  const dates = computed(() => set.value?.dates ?? [])
  const view = computed(() => {
    const ds = dates.value
    const ok = period.from && period.to && ds.includes(period.from) && ds.includes(period.to)
    return { from: ok ? period.from! : ds[0] ?? '', to: ok ? period.to! : ds[ds.length - 1] ?? '' }
  })
  const range = computed(() => [dates.value.indexOf(view.value.from), dates.value.indexOf(view.value.to)] as const)
  const summary = computed(() => (set.value && dates.value.length ? mmeSummary(set.value, range.value[0], range.value[1]) : null))

  // The groups come from the ownership record. When it fails (data is null; an empty one still has its groups, as in App.load) the outlets have no color and no link to their group, as on the static page.
  const groups = computed(() => groupsFixture.data.value?.groups ?? [])
  const colorOf = computed(() => groupColors(groups.value))
  const slugOf = computed(() => new Map(groups.value.map(g => [g.name, g.slug])))

  return { status, refresh, data, set, dates, view, range, summary, colorOf, slugOf }
}
