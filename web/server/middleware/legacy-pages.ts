// The static pages link to a ported page by its old file (groups-v2.html). In production public/_redirects sends it to the Nuxt route; the dev server does not read that file, so there the link is a 404.
// This does the same redirects in dev, from the same list (ported-pages.json). A rule with a query comes first, as in _redirects.
import ported from '../../ported-pages.json'

type Page = { html: string, route: string, query?: string }
const pages = (ported as Page[]).slice().sort((a, b) => Number(!!b.query) - Number(!!a.query))

export default defineEventHandler((event) => {
  if (!import.meta.dev) return
  const url = getRequestURL(event)
  const html = url.pathname.slice(1)
  if (!html.endsWith('.html')) return
  const page = pages.find((p) => {
    if (p.html !== html) return false
    if (!p.query) return true
    const [key, value] = p.query.split('=')
    return url.searchParams.get(key!) === value
  })
  if (!page) return
  const rest = new URLSearchParams(url.searchParams)
  if (page.query) rest.delete(page.query.split('=')[0]!)
  const search = rest.toString()
  return sendRedirect(event, `${page.route}${search ? `?${search}` : ''}`, 301)
})
