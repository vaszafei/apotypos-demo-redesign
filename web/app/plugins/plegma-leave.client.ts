import { plegmaFocusOf, samePlegmaFocus } from '~/utils/plegma/plegma-route'
import { LEAVE_HOLD_MS } from '~/utils/plegma/plegma-leave'

// The way a theme is left (a click on a story, an outlet, another theme or a tab): the page and the ring leave first (stores/plegma.ts `leaving`), then the route changes. The Back and Forward
// buttons, a change of the same theme (a tab of the ring) and reduced motion change the route at once. The theme is the first view to leave this way.
export default defineNuxtPlugin(() => {
  const router = useRouter()
  const plegma = usePlegmaStore()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  let popped = false
  window.addEventListener('popstate', () => { popped = true }, true)
  router.beforeEach(async (to, from) => {
    const back = popped
    popped = false
    if (back || reduce.matches || !plegma.active || !plegma.landed) return
    const here = plegmaFocusOf(from.path, from.query)
    if (here?.kind !== 'theme' || samePlegmaFocus(here, plegmaFocusOf(to.path, to.query))) return
    plegma.setLeaving(true)
    await new Promise(done => window.setTimeout(done, LEAVE_HOLD_MS))
  })
  router.afterEach((_to, _from, failure) => {
    popped = false
    if (failure) plegma.setLeaving(false)
  })
})
