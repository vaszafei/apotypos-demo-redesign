import { NAV } from '../composables/useNav.ts'

// The order of the pages for the page transitions (directionOf of assets/shell.js). A move to another section slides the page sideways,
// in the order of the navbar; a move to another tab of a section slides it up or down (sideways on a phone). A detail page has no place.
export const MOVE_KEY = 'm-move' // also read by the static shell and by page-move.js
export const MOVE_LINKS = '.nav-main a, .section-nav a, .section-tabs a, .sub-tabs a'

export type Direction = 'left' | 'right' | 'up' | 'down'
export interface Move { from: string, href?: string, nav?: boolean, top?: number, time?: number }

export const stepOf = (path: string) => {
  const section = NAV.findIndex(s => s.to === path || s.tabs.some(t => t.to === path))
  if (section < 0) return null
  const page = NAV[section]!.tabs.length ? NAV[section]!.tabs.findIndex(t => t.to === path) : 0
  return page < 0 ? null : { section, page }
}

export const directionOf = (from: string, to: string, column: boolean): Direction | null => {
  const a = stepOf(from)
  const b = stepOf(to)
  if (!a || !b || (a.section === b.section && a.page === b.page)) return null
  if (a.section !== b.section) return b.section > a.section ? 'right' : 'left'
  if (b.page > a.page) return column ? 'down' : 'right'
  return column ? 'up' : 'left'
}

export const readMove = (): Move | null => {
  try {
    const move = JSON.parse(sessionStorage.getItem(MOVE_KEY) ?? 'null') as Move | null
    return move && Date.now() - (move.time ?? 0) < 5000 ? move : null
  } catch { return null }
}
export const keepMove = (move: Move) => {
  try { sessionStorage.setItem(MOVE_KEY, JSON.stringify({ ...move, time: Date.now() })) } catch { /* storage is not available */ }
}
export const dropMove = () => {
  try { sessionStorage.removeItem(MOVE_KEY) } catch { /* storage is not available */ }
}
