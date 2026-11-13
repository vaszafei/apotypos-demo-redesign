// What a route puts in focus on the Plegma: a story (/story?id=), a theme (/topic?i=), an outlet (/outlet?slug=) or nothing (Home and the pages that only show the map).
export type PlegmaFocus = { kind: 'story', id: number } | { kind: 'theme', issue: number } | { kind: 'outlet', slug: string } | null

// The outlet the page shows when the address has no slug (Rosa.gr).
export const DEFAULT_OUTLET = '17661f5754'

const whole = (value: unknown) => {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : null
}

// The host may serve a page with a trailing slash (/story/?id=): Netlify redirects /story to it. The same route, so the same focus.
export const plegmaFocusOf = (rawPath: string, query: Record<string, unknown>): PlegmaFocus => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath
  if (path === '/story') { const id = whole(query.id); return id === null ? null : { kind: 'story', id } }
  if (path === '/topic') { const issue = whole(query.i); return issue === null ? null : { kind: 'theme', issue } }
  if (path === '/outlet') { const raw = Array.isArray(query.slug) ? query.slug[0] : query.slug; return { kind: 'outlet', slug: typeof raw === 'string' && raw ? raw : DEFAULT_OUTLET } }
  return null
}

export const samePlegmaFocus = (a: PlegmaFocus, b: PlegmaFocus) => {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'story') return a.id === (b as { id: number }).id
  if (a.kind === 'outlet') return a.slug === (b as { slug: string }).slug
  return a.issue === (b as { issue: number }).issue
}

// A route that is a view of the Plegma (a story or a theme), with its query: the pick of the large search of Home that the page leaves for with a flight.
export const PLEGMA_VIEW = /^\/(story|topic)\/?(\?|$)/
