export default defineNuxtConfig({
  compatibilityDate: '2026-10-22',
  // SPA like the static prototype, so the comparison is fair.
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  // The fonts are the two files of the prototype (assets/fonts); no downloads from Google.
  fonts: { providers: { google: false, googleicons: false, bunny: false, fontshare: false, fontsource: false, adobe: false } },
  colorMode: { preference: 'light', fallback: 'light' },
  app: {
    head: { htmlAttrs: { lang: 'el' }, title: 'Απότυπος', link: [{ rel: 'icon', href: 'data:,' }] },
    pageTransition: { name: 'page', mode: 'out-in' }
  },
  nitro: { preset: 'static' }
})
