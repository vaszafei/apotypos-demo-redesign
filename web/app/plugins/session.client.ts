import { useEventListener } from '@vueuse/core'

// The visitor is read once the prerendered page is hydrated (stores/session.ts). That is app:suspense:resolve, not app:mounted: a page with an
// async setup is still being hydrated when app:mounted fires, and a visitor read then makes the first render differ from the HTML.
// A sign-in or sign-out in another tab or on a static page shows here at once (localStorage['proto-user']).
export default defineNuxtPlugin((nuxtApp) => {
  const session = useSessionStore()
  nuxtApp.hook('app:suspense:resolve', () => session.hydrate())
  useEventListener(window, 'storage', (e: StorageEvent) => { if (e.key === USER_KEY || e.key === null) session.refresh() })
})
