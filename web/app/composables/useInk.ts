// The text color for the name inside a circle of a group color. The color of a token is only known in the browser (it depends on the theme), so
// the page is drawn with the dark ink first and the right one is set once it is mounted, and again when the theme changes.
export const useInk = () => {
  const prefs = usePrefsStore()
  const known = ref(false)
  const version = ref(0)
  const read = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  onMounted(() => { known.value = true })
  watch(() => prefs.theme, async () => { await nextTick(); version.value++ })
  // The ink on the fill of a group color tinted by k.
  return (color: string, k: number) => {
    void version.value
    const name = tokenName(color)
    if (!known.value || !name) return 'var(--text-on-light)'
    const base = read(name)
    if (!/^#[0-9a-f]{6}$/i.test(base)) return 'var(--text-on-light)'
    return inkOn(tintHex(base, k), read('--text-on-light'), read('--text-on-dark'))
  }
}
