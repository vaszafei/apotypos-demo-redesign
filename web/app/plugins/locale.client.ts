// The language like assets/components.js: ?lang= first, then localStorage['apotypos-locale'], Greek by default. The switch stores its choice; ?lang= does not.
const KEY = 'apotypos-locale'
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (value: string) => { try { localStorage.setItem(KEY, value) } catch { /* storage is not available */ } }

export default defineNuxtPlugin({
  name: 'apotypos-locale',
  dependsOn: ['i18n:plugin'],
  async setup (nuxtApp) {
    const { $i18n } = nuxtApp
    const wanted = new URLSearchParams(location.search).get('lang') || read()
    if (wanted && wanted !== $i18n.locale.value && $i18n.locales.value.some(l => (typeof l === 'string' ? l : l.code) === wanted)) await $i18n.setLocale(wanted as 'el' | 'en')
    watch($i18n.locale, write)
  }
})
