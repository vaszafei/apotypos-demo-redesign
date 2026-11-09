// The page transitions of the prototype (shell.js "Page transitions", CSS in assets/app.css) on the Vue router.
// The CSS is the same: a move to another section slides the page sideways, in the order of the navbar; a move to another tab of a section slides it up or down
// (sideways on a phone). A link to a detail page changes the page without a slide. Nuxt starts the view transition (experimental.viewTransition); this sets the direction.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let move: { from: string, to: string } | null = null
  router.beforeEach((to, from) => { move = { from: from.path, to: to.path } })

  const stepOf = (path: string) => {
    const section = NAV.findIndex(s => s.to === path || s.tabs.some(t => t.to === path))
    if (section < 0) return null
    const page = NAV[section]!.tabs.length ? NAV[section]!.tabs.findIndex(t => t.to === path) : 0
    return page < 0 ? null : { section, page }
  }
  const directionOf = (from: string, to: string) => {
    const a = stepOf(from)
    const b = stepOf(to)
    if (!a || !b || (a.section === b.section && a.page === b.page)) return null
    if (a.section !== b.section) return b.section > a.section ? 'right' : 'left'
    const column = window.matchMedia('(min-width: 1024px)').matches
    if (b.page > a.page) return column ? 'down' : 'right'
    return column ? 'up' : 'left'
  }

  nuxtApp.hook('page:view-transition:start', (transition: ViewTransition) => {
    const direction = move ? directionOf(move.from, move.to) : null
    if (!direction) {
      transition.ready.catch(() => { /* skipped on purpose */ })
      transition.skipTransition()
      return
    }
    const html = document.documentElement
    html.dataset.vt = direction
    transition.finished.finally(() => { delete html.dataset.vt })
  })
})
