import { inkOn } from '~/utils/ink'

// netColor of assets/mme.js: the balance of a person as a color between the middle of the diverging scale and the critical or the supportive color. The step eases in, so small values stay pale.
// The color of a token is only known in the browser (it depends on the theme): on the server the middle color is the answer, and the page is drawn again when the theme changes.
export const useNetColor = () => {
  const prefs = usePrefsStore()
  return (net: number): { background: string, color: string } => {
    void prefs.theme
    if (!import.meta.client) return { background: 'var(--div-mid)', color: 'var(--text-on-light)' }
    const read = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
    const k = Math.min(1, Math.abs(net) / 0.5) ** 1.3 * 0.85
    const end = rgb(read(net < 0 ? '--stance-critical' : '--stance-supportive'))
    const mid = rgb(read('--div-mid'))
    const hex = `#${mid.map((v, i) => Math.round(v + (end[i]! - v) * k).toString(16).padStart(2, '0')).join('')}`
    return { background: hex, color: inkOn(hex, read('--text-on-light'), read('--text-on-dark')) }
  }
}
