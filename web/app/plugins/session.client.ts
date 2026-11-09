import { useEventListener } from '@vueuse/core'

// The visitor is read after the prerendered page is hydrated (stores/session.ts). A sign-in or sign-out in another tab or on a static page
// shows here at once (localStorage['proto-user']).
export default defineNuxtPlugin((nuxtApp) => {
  const session = useSessionStore()
  nuxtApp.hook('app:mounted', () => session.hydrate())
  useEventListener(window, 'storage', (e: StorageEvent) => { if (e.key === USER_KEY || e.key === null) session.refresh() })
})
