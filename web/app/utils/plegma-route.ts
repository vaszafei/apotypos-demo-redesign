// What a route puts in focus on the Plegma: a story (/story?id=), a theme (/topic?i=) or nothing (Home and the pages that only show the map).
export type PlegmaFocus = { kind: 'story', id: number } | { kind: 'theme', issue: number } | null

const whole = (value: unknown) => {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : null
}

export const plegmaFocusOf = (path: string, query: Record<string, unknown>): PlegmaFocus => {
  if (path === '/story') { const id = whole(query.id); return id === null ? null : { kind: 'story', id } }
  if (path === '/topic') { const issue = whole(query.i); return issue === null ? null : { kind: 'theme', issue } }
  return null
}

export const samePlegmaFocus = (a: PlegmaFocus, b: PlegmaFocus) =>
  a === b || (!!a && !!b && a.kind === b.kind && (a.kind === 'story' ? a.id === (b as { id: number }).id : a.issue === (b as { issue: number }).issue))
