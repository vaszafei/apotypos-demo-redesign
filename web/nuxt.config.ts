export default defineNuxtConfig({
  compatibilityDate: '2026-10-22',
  ssr: false,
  devtools: { enabled: false },
  // Netlify selects its own preset, which writes to dist. Keep .output/public.
  nitro: { preset: 'static' }
})
