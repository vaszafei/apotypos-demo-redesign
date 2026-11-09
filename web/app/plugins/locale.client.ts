// The language like assets/components.js: ?lang= first, then localStorage['apotypos-locale'], Greek by default. The switch stores its choice; ?lang= does not.
// The page is prerendered in Greek, so a visitor who wants English gets it after the page is hydrated; html[data-lang-pending] (utils/visitorScript.ts)
// keeps the Greek text out of sight until then (assets/css/ssr.css).
const KEY = 'apotypos-locale'
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (value: string) => { try { localStorage.setItem(KEY, value) } catch { /* storage is not available */ } }

export default defineNuxtPlugin({
  name: 'apotypos-locale',
  dependsOn: ['i18n:plugin'],
  setup (nuxtApp) {
    const { $i18n } = nuxtApp
    const search = location.search
    nuxtApp.hook('app:mounted', async () => {
      const wanted = new URLSearchParams(search).get('lang') || read()
      try {
        if (wanted && wanted !== $i18n.locale.value && $i18n.locales.value.some(l => (typeof l === 'string' ? l : l.code) === wanted)) await $i18n.setLocale(wanted as 'el' | 'en')
      } finally {
        delete document.documentElement.dataset.langPending
      }
      watch($i18n.locale, write)
    })
  }
})
