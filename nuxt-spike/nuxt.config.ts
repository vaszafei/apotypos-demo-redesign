const sheet = (name: string) => ({ rel: 'stylesheet' as const, href: `/assets/${name}.css` })

export default defineNuxtConfig({
  compatibilityDate: '2026-10-22',
  // SPA like the static prototype, so the comparison is fair.
  ssr: false,
  devtools: { enabled: false },
  // No Tailwind and no Nuxt UI: the design is the prototype's own CSS (copied byte for byte into public/assets), and their reset would change it.
  modules: ['@pinia/nuxt'],
  css: [],
  app: {
    head: {
      htmlAttrs: { lang: 'el', 'data-theme': 'paper', 'data-icons': 'off', 'data-font': 'plex', 'data-header': 'v2' },
      title: 'Απότυπος',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ rel: 'icon', href: 'data:,' }, ...['tokens', 'app', 'dash', 'mme', 'date-range'].map(sheet)]
    },
    // The page transition is a view transition (plugins/view-transition.client.ts), with the CSS of the prototype.
    pageTransition: false
  },
  experimental: { viewTransition: true },
  nitro: { preset: 'static' }
})
