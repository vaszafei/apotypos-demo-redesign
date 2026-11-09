import ported from '~~/ported-pages.json'
import prototypes from '~/generated/prototypes.json'

const prototypeOf = prototypes as Record<string, string>

// A page that is ported has a Nuxt route; the others are static files that Netlify serves (see scripts/sync-prototype.mjs).
export const isPorted = (route: string) => ported.some(page => page.route === route)

const routeAnchor = (route: string) => `r-${encodeURI(route).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home'}`

// The URL of the static page of a route that is not ported (hrefOf in assets/shell.js).
export const staticHref = (route: string) => `/${prototypeOf[route] ?? `pages.html#${routeAnchor(route)}`}`

// The static page of a topic (ENTITY_PAGES.topic in assets/components.js). A topic page is not ported yet.
export const topicHref = (key: string | number) => `/topic-v2.html?i=${key}`
