import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// Prototype only: the font, theme and icon choices of the shell (assets/shell.js). ?font=, ?theme= and ?icons= first, then the last choice, then the default.
// Each choice is written to localStorage ('proto-font', 'proto-theme', 'proto-icons') and to the data-* attribute of <html>, as setFont, setTheme and setIcons do.
export const FONTS = [['plex', 'IBM Plex Sans'], ['manrope', 'Manrope'], ['commissioner', 'Commissioner'], ['inter', 'Inter + Source Serif 4'], ['dejavu', 'DejaVu Sans (λογότυπο)'], ['ubuntu', 'Ubuntu'], ['noto', 'Noto Sans'], ['sourcesans', 'Source Sans 3'], ['geologica', 'Geologica'], ['sofia', 'Sofia Sans'], ['literata', 'Source Sans 3 + Literata']] as const
export const THEMES = ['paper', 'fog', 'terra', 'night', 'midnight'] as const
export const ICON_MODES = ['off', 'all', 'sidebar'] as const

export const pickPref = (asked: string | null, saved: string | null, allowed: readonly string[], fallback: string) => [asked, saved].find(v => v && allowed.includes(v)) ?? fallback

const choose = (name: string, allowed: readonly string[], fallback: string) => {
  let saved: string | null = null
  try { saved = localStorage.getItem(`proto-${name}`) } catch { /* storage is not available */ }
  return pickPref(new URLSearchParams(location.search).get(name), saved, allowed, fallback)
}

export const usePrefsStore = defineStore('prefs', () => {
  const font = ref(choose('font', FONTS.map(([k]) => k), 'plex'))
  const theme = ref(choose('theme', THEMES, 'paper'))
  const icons = ref(choose('icons', ICON_MODES, 'off'))
  const apply = (name: string, value: string) => {
    document.documentElement.dataset[name] = value
    try { localStorage.setItem(`proto-${name}`, value) } catch { /* storage is not available */ }
  }
  // immediate: a choice that came from the query string is stored too, as the static shell does.
  watch(font, v => apply('font', v), { immediate: true })
  watch(theme, v => apply('theme', v), { immediate: true })
  watch(icons, v => apply('icons', v), { immediate: true })
  return { font, theme, icons }
})
