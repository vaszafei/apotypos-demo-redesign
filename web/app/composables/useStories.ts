import type { StoriesData } from '~/types/stories'

// The data of Μέσα › Ιστορίες and the period it shows (stories-v2.html): the stories of each day, and the days of the chosen period. The first visit shows the last week of the window.
export const useStories = async () => {
  // The store before the await: after it the Nuxt context is gone on the server.
  const period = usePeriodStore()
  const rules = { required: ['dates', 'issues', 'stories'], isEmpty: (b: StoriesData) => b.stories.length === 0 }
  // The page is prerendered with the recent stories only. In the browser the whole file follows (the web of the page fetches the same one) and takes their place. It is called before the await: after it the Nuxt context is gone.
  const full = import.meta.client ? useFixtureLazy<StoriesData>('stories', rules) : null
  const recent = await useFixture<StoriesData>('stories', rules, { as: 'stories-recent', transform: storiesRecent })
  const data = computed(() => full?.data.value ?? recent.data.value)
  const { status, refresh } = recent

  const dates = computed(() => data.value?.dates ?? [])
  const view = computed(() => {
    const ds = dates.value
    const ok = period.from && period.to && ds.includes(period.from) && ds.includes(period.to)
    const last = ds[ds.length - 1] ?? ''
    const week = ds[Math.max(0, ds.length - 7)] ?? ''
    return { from: ok ? period.from! : week, to: ok ? period.to! : last }
  })
  const range = computed(() => [dates.value.indexOf(view.value.from), dates.value.indexOf(view.value.to)] as const)
  const byDay = computed(() => (data.value ? storiesByDay(data.value.stories, data.value.dates.length) : []))
  const list = computed(() => (data.value ? storiesOfPeriod(byDay.value, range.value[0], range.value[1]) : []))

  return { data, status, refresh, dates, view, range, byDay, list }
}
