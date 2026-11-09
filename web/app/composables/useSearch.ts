import type { Entry, SearchIndex } from '~/utils/search'

// The index (search.json, 915 KB) is shared by every search on the page and is requested only when the first search opens.
// These refs are set only in the browser (load runs on open), so nothing leaks between requests on the server.
const index = shallowRef<SearchIndex | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')

export const useSearch = () => {
  const { t, locale } = useI18n()

  const load = async () => {
    if (status.value !== 'idle') return
    status.value = 'loading'
    try {
      index.value = await $fetch<SearchIndex>('/data/search.json')
      status.value = 'ready'
    } catch {
      status.value = 'failed'
    }
  }

  // The pages and tabs are known without the index, so they are found while it loads.
  const pages = computed<Entry[]>(() => pageEntries(t, hrefOf))
  const entities = computed(() => (index.value ? indexEntries(index.value, locale.value, t) : null))

  const rememberPage = (route: string) => {
    const page = pages.value.find(p => p.route === route)
    if (page) remember('pages', { h: page.h, n: page.n, r: route }, p => p.h === page.h)
  }

  return { status, pages, entities, load, rememberPage }
}
