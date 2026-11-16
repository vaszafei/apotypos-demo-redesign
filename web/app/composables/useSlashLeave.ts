// The "/" of the current tab is drawn from the top when a tab becomes the current one, and erased from the top when it stops being it (assets/css/plegma.css, nav-slash-in / nav-slash-out).
// The tab that was just left has no aria-current any more, so the layout marks it `is-leaving` for as long as the erase takes: this returns its key, then null.
export const SLASH_OUT_MS = 300

export const useSlashLeave = (current: () => string | null | undefined) => {
  const leaving = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(current, (_now, before) => {
    clearTimeout(timer)
    leaving.value = before ?? null
    timer = setTimeout(() => { leaving.value = null }, SLASH_OUT_MS)
  })
  onBeforeUnmount(() => clearTimeout(timer))
  return leaving
}
