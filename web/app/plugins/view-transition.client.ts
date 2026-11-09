import { useEventListener } from '@vueuse/core'

// The page transitions of the prototype (shell.js "Page transitions", CSS in assets/app.css) on the Vue router and between documents.
// A move to another section slides the page sideways, in the order of the navbar; a move to another tab of a section slides it up or down
// (sideways on a phone). A link to a detail page changes the page without a slide.
// Two kinds of move: between two Nuxt pages Nuxt starts the view transition (experimental.viewTransition) and this sets the direction;
// between a Nuxt page and a static page the browser does (@view-transition in app.css) and the shells hand the move over in sessionStorage.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const html = document.documentElement
  const isColumn = () => window.matchMedia('(min-width: 1024px)').matches
  // The top of the page as the visitor saw it: the new page shows the old picture there, not at its own top.
  const pageTop = () => document.querySelector('.page-main')?.getBoundingClientRect().top ?? 0
  // Not the router's route: at the first frame of a new document the router has not resolved it yet.
  const here = () => location.pathname.replace(/\/$/, '') || '/'
  const skip = (transition: ViewTransition) => {
    transition.ready.catch(() => { /* skipped on purpose */ })
    transition.skipTransition()
  }

  // Between two Nuxt pages.
  let move: { from: string, to: string } | null = null
  router.beforeEach((to, from) => { move = { from: from.path, to: to.path } })
  nuxtApp.hook('page:view-transition:start', (transition: ViewTransition) => {
    dropMove()
    const direction = move ? directionOf(move.from, move.to, isColumn()) : null
    if (!direction) return skip(transition)
    // The old page is still in the document now. The new page is drawn at the top, so the old picture starts (old top - new top) from it.
    const oldTop = pageTop()
    html.dataset.vt = direction
    transition.updateCallbackDone.then(() => html.style.setProperty('--vt-old-y', `${oldTop - (pageTop() + window.scrollY)}px`)).catch(() => { /* skipped */ })
    transition.finished.finally(() => { delete html.dataset.vt; html.style.removeProperty('--vt-old-y') })
  })

  // Between documents: the page that is left keeps where it was and which link was clicked; the new page reads it before its first frame.
  useEventListener(document, 'click', (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(MOVE_LINKS)
    if (link && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) keepMove({ from: here(), href: link.href, nav: true })
  }, { capture: true })
  useEventListener(window, 'pageswap', () => {
    const kept = readMove()
    keepMove({ ...(kept?.nav ? kept : { from: here() }), top: pageTop() })
  })
  // The arrival (pagereveal) is handled by the script in the <head> (utils/arrival.ts): the browser reveals the page before this plugin has run.
})
