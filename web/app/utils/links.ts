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
export const searchTarget = (e: { h: string, route?: string }): { to: string } | { href: string } => {
  const route = e.route ?? ported.find(page => page.html === e.h)?.route
  return route && isPorted(route) ? { to: route } : { href: `/${e.h}` }
}

// The static page of a topic (ENTITY_PAGES.topic in assets/components.js). A topic page is not ported yet.
export const topicHref = (key: string | number) => `/topic-v2.html?i=${key}`
