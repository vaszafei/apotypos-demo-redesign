// The pages that are Nuxt pages (web/ported-pages.json) and the static page each one replaced.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ported = () => JSON.parse(readFileSync(fileURLToPath(new URL('../../ported-pages.json', import.meta.url)), 'utf8'))

const urlOfPage = (page) => `${page.html}${page.query ? `?${page.query}` : ''}`

// The static page of a Nuxt route, as a path with its query, or null when the route is not ported.
export const staticUrlOf = (route) => {
  const page = ported().find((entry) => entry.route === route)
  return page ? urlOfPage(page) : null
}

// The Nuxt route of a static page URL (a path with its query), or the URL itself when the page is not ported.
export const nuxtUrlOf = (url) => {
  const page = ported().find((entry) => urlOfPage(entry) === url)
  return page ? page.route.replace(/^\//, '') : url
}
