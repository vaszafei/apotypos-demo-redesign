import tailwindcss from '@tailwindcss/vite'

const sheet = (name: string) => ({ rel: 'stylesheet' as const, href: `/assets/${name}.css` })

export default defineNuxtConfig({
  compatibilityDate: '2026-10-22',
  // Prerendered (ssr: true) so the first frame is already drawn and the page slide into a Nuxt page works (KTD11, changed 2026-11-09).
  ssr: true,
  devtools: { enabled: false },
  // The design is the prototype's own CSS, copied from docs/redesign/prototypes/assets by scripts/sync-prototype.mjs. No Nuxt UI.
  modules: ['@pinia/nuxt', '@nuxtjs/i18n'],
  css: ['~/assets/css/tailwind.css', '~/assets/css/ssr.css', '~/assets/css/plegma.css'],
  // Tailwind 4 with no reset (preflight) and the tw: prefix, so no class of the prototype CSS changes (KTD6).
  vite: { plugins: [tailwindcss()] },
  // The text is the message files of the prototype, converted by scripts/build-messages.mjs to i18n/locales (KTD4). One URL for both languages; the locale
  // comes from ?lang= and localStorage['apotypos-locale'] like the static pages (plugins/locale.client.ts).
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'el',
    locales: [{ code: 'el', language: 'el-GR', name: 'Ελληνικά', file: 'el.json' }, { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' }],
    detectBrowserLanguage: false,
    vueI18n: './i18n.config.ts'
  },
  app: {
    head: {
      // data-theme, data-icons and data-font are set by stores/prefs.ts (plugins/prefs.client.ts), as the static shell does.
      htmlAttrs: { lang: 'el', 'data-header': 'v2' },
      title: 'Απότυπος',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      // The default font is fetched with the page: when it arrives late the masthead of Αρχική wraps in the fallback font and the hero jumps up one line (npm run check:load).
      link: [{ rel: 'icon', href: 'data:,' }, { rel: 'preload', as: 'font', type: 'font/woff2', href: '/assets/fonts/IBMPlexSans-greek-latin.woff2', crossorigin: 'anonymous' }, ...['tokens', 'app', 'dash', 'mme', 'home', 'date-range'].map(sheet)]
    },
    // The page transition is a view transition (plugins/view-transition.client.ts), with the CSS of the prototype.
    pageTransition: false
  },
  experimental: { viewTransition: true },
  // Netlify selects its own preset, which writes to dist. Keep .output/public.
  nitro: { preset: 'static', serverAssets: [{ baseName: 'fixtures', dir: '../public/data' }] }
})
