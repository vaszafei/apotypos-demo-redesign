// A key that English does not have shows the Greek text, as t() of assets/components.js does.
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'el',
  // The messages are the prototype's own text, with no HTML to escape.
  warnHtmlMessage: false
}))
