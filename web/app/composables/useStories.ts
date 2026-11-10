import type { StoriesData } from '~/types/stories'

// The data of Μέσα › Ιστορίες and the period it shows (stories-v2.html): the stories of each day, and the days of the chosen period. The first visit shows the last day of the window, as Αρχική does.
export const useStories = async () => {
  // The store before the await: after it the Nuxt context is gone on the server.
  const period = usePeriodStore()
  const { data, status, refresh } = await useFixture<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })

  const dates = computed(() => data.value?.dates ?? [])
  const view = computed(() => {
    const ds = dates.value
    const ok = period.from && period.to && ds.includes(period.from) && ds.includes(period.to)
    const last = ds[ds.length - 1] ?? ''
    return { from: ok ? period.from! : last, to: ok ? period.to! : last }
  })
  const range = computed(() => [dates.value.indexOf(view.value.from), dates.value.indexOf(view.value.to)] as const)
  const byDay = computed(() => (data.value ? storiesByDay(data.value.stories, data.value.dates.length) : []))
  const list = computed(() => (data.value ? storiesOfPeriod(byDay.value, range.value[0], range.value[1]) : []))

  return { data, status, refresh, dates, view, range, byDay, list }
}
