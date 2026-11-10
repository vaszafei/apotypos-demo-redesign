// What a route puts in focus on the Plegma: a story (/story?id=), a theme (/topic?i=) or nothing (Home and the pages that only show the map).
export type PlegmaFocus = { kind: 'story', id: number } | { kind: 'theme', issue: number } | null

const whole = (value: unknown) => {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : null
}

// The host may serve a page with a trailing slash (/story/?id=): Netlify redirects /story to it. The same route, so the same focus.
export const plegmaFocusOf = (rawPath: string, query: Record<string, unknown>): PlegmaFocus => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath
  if (path === '/story') { const id = whole(query.id); return id === null ? null : { kind: 'story', id } }
  if (path === '/topic') { const issue = whole(query.i); return issue === null ? null : { kind: 'theme', issue } }
  return null
}

export const samePlegmaFocus = (a: PlegmaFocus, b: PlegmaFocus) =>
  a === b || (!!a && !!b && a.kind === b.kind && (a.kind === 'story' ? a.id === (b as { id: number }).id : a.issue === (b as { issue: number }).issue))

// A route that is a view of the Plegma (a story or a theme), with its query: the pick of the large search of Home that the page leaves for with a flight.
export const PLEGMA_VIEW = /^\/(story|topic)\/?(\?|$)/
