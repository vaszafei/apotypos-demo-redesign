// The theme, icons and font: ?theme=, ?icons=, ?font= or the last choice (stores/prefs.ts). The inline script of utils/visitorScript.ts has set
// them on <html> before the first paint; the store learns them once the prerendered page is hydrated (app:suspense:resolve, see plugins/session.client.ts), so the two agree and nothing mismatches.
export default defineNuxtPlugin((nuxtApp) => {
  const prefs = usePrefsStore()
  // The query string as it was loaded: the language switch of plugins/locale.client.ts navigates (and drops it) before this hook runs.
  const search = location.search
  nuxtApp.hook('app:suspense:resolve', () => prefs.hydrate(search))
})
