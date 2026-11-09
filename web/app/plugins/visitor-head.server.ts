import ported from '~~/ported-pages.json'

// The inline script that makes the prerendered page the visitor's own before the first paint (utils/visitorScript.ts).
export default defineNuxtPlugin((nuxtApp) => {
  const codes = nuxtApp.$i18n.locales.value.map(l => (typeof l === 'string' ? l : l.code))
  const nav = NAV.map(s => ({ to: s.to, tabs: s.tabs.map(t => t.to) }))
  useHead({ script: [{ innerHTML: visitorScript(codes, nav, ported), tagPosition: 'head' }] })
})
