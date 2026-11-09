import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// Prototype only: the font, theme and icon choices of the shell (assets/shell.js). ?font=, ?theme= and ?icons= first, then the last choice, then the default.
// Each choice is written to localStorage ('proto-font', 'proto-theme', 'proto-icons') and to the data-* attribute of <html>, as setFont, setTheme and setIcons do.
export const FONTS = [['plex', 'IBM Plex Sans'], ['manrope', 'Manrope'], ['commissioner', 'Commissioner'], ['inter', 'Inter + Source Serif 4'], ['dejavu', 'DejaVu Sans (λογότυπο)'], ['ubuntu', 'Ubuntu'], ['noto', 'Noto Sans'], ['sourcesans', 'Source Sans 3'], ['geologica', 'Geologica'], ['sofia', 'Sofia Sans'], ['literata', 'Source Sans 3 + Literata']] as const
export const THEMES = ['paper', 'fog', 'terra', 'night', 'midnight'] as const
export const ICON_MODES = ['off', 'all', 'sidebar'] as const

export const pickPref = (asked: string | null, saved: string | null, allowed: readonly string[], fallback: string) => [asked, saved].find(v => v && allowed.includes(v)) ?? fallback

export const PREF_DEFAULTS = { font: 'plex', theme: 'paper', icons: 'off' } as const
export const PREF_CHOICES: Record<keyof typeof PREF_DEFAULTS, readonly string[]> = { font: FONTS.map(([k]) => k), theme: THEMES, icons: ICON_MODES }

const choose = (name: keyof typeof PREF_DEFAULTS, search: string) => {
  let saved: string | null = null
  try { saved = localStorage.getItem(`proto-${name}`) } catch { /* storage is not available */ }
  return pickPref(new URLSearchParams(search).get(name), saved, PREF_CHOICES[name], PREF_DEFAULTS[name])
}

// The page is prerendered with the defaults, so the store starts with them and hydrate() (plugins/prefs.client.ts) reads the visitor's choice
// after the page is hydrated. Before that the inline script of utils/visitorScript.ts has already set the data-* attributes.
export const usePrefsStore = defineStore('prefs', () => {
  const font = ref<string>(PREF_DEFAULTS.font)
  const theme = ref<string>(PREF_DEFAULTS.theme)
  const icons = ref<string>(PREF_DEFAULTS.icons)
  const apply = (name: keyof typeof PREF_DEFAULTS, value: string) => {
    document.documentElement.dataset[name] = value
    try { localStorage.setItem(`proto-${name}`, value) } catch { /* storage is not available */ }
  }
  watch(font, v => apply('font', v))
  watch(theme, v => apply('theme', v))
  watch(icons, v => apply('icons', v))
  // A choice that came from the query string is stored too, as the static shell does.
  const hydrate = (search = location.search) => {
    font.value = choose('font', search)
    theme.value = choose('theme', search)
    icons.value = choose('icons', search)
    apply('font', font.value)
    apply('theme', theme.value)
    apply('icons', icons.value)
  }
  return { font, theme, icons, hydrate }
})
