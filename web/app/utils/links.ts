import ported from '~~/ported-pages.json'
import prototypes from '~/generated/prototypes.json'

const prototypeOf = prototypes as Record<string, string>

// A page that is ported has a Nuxt route; the others are static files that Netlify serves (see scripts/sync-prototype.mjs).
export const isPorted = (route: string) => ported.some(page => page.route === route)

const routeAnchor = (route: string) => `r-${encodeURI(route).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home'}`

// The file of the static page of a route (hrefOf in assets/shell.js).
export const hrefOf = (route: string) => prototypeOf[route] ?? `pages.html#${routeAnchor(route)}`

// The URL of the static page of a route that is not ported.
export const staticHref = (route: string) => `/${hrefOf(route)}`

// Where a search result goes: the Nuxt route when its page is ported, the static page when it is not (KTD3).
// A page of the site has its route; an entity (an outlet, a story) has the file of its static page.
// An entity of a ported page keeps its query (story-v2.html?id=5 is /story?id=5).
export const searchTarget = (e: { h: string, route?: string }): { to: string } | { href: string } => {
  const route = e.route ?? ported.find(page => page.html === e.h)?.route
  if (route && isPorted(route)) return { to: route }
  const [file, query] = e.h.split('?')
  const page = query ? ported.find(p => p.html === file && !('query' in p)) : undefined
  return page ? { to: `${page.route}?${query}` } : { href: `/${e.h}` }
}

// A link to a page of the site as a path with its query: the Nuxt route when the page is ported (a router link), null for a static page.
export const portedPath = (href: string) => (isPorted(href.split('?')[0]!) ? href : null)

// The static page of a topic (ENTITY_PAGES.topic in assets/components.js). A topic page is not ported yet.
export const topicHref = (key: string | number) => `/topic-v2.html?i=${key}`

// The page of a story (ENTITY_PAGES.story): the Nuxt route /story, which keeps the ?id= of the static page.
export const storyHref = (id: string | number) => `/story?id=${id}`

// The static pages of an outlet and a group (ENTITY_PAGES in assets/components.js). An outlet key is a 10 digit hex slug; the pages are not ported yet.
export const outletHref = (slug: string) => (/^[0-9a-f]{10}$/.test(slug) ? `/outlet-v2.html?slug=${slug}` : '/404.html')
export const groupPageHref = (slug: string) => `/group-v2.html?g=${encodeURIComponent(slug)}`
