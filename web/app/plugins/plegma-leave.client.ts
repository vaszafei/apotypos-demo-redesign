import { plegmaFocusOf, samePlegmaFocus } from '~/utils/plegma/plegma-route'
import { LEAVE_FADE_MS, LEAVE_HOLD_MS } from '~/utils/plegma/plegma-leave'
import { startOutletTravel } from '~/utils/plegma/outlet-travel'

// The way a theme, a group, a story or an outlet is left (a click on a story, an outlet, another theme or a tab): the page and the ring leave first (stores/plegma.ts `leaving`), then the route changes. The Back and Forward
// buttons, a change of the same theme (a tab of the ring) and reduced motion change the route at once. A theme leaves with its ring (LEAVE_HOLD_MS); a screen of Μέσα (a page with the map as its
// backdrop) leaves for a story, a theme or an outlet with its content faded (the CSS of `.shell.is-leaving`), except Ιστορίες, which dives from its web (composables/useWebDive.ts).
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
    const next = plegmaFocusOf(to.path, to.query)
    // An outlet to another outlet of its group goes along the line between them (utils/plegma/outlet-travel.ts): the move starts now and the cards fade before the route changes.
    if (here?.kind === 'outlet' && next?.kind === 'outlet' && !samePlegmaFocus(here, next) && startOutletTravel(next.slug)) {
      plegma.setLeaving(true)
      await new Promise(done => window.setTimeout(done, LEAVE_FADE_MS))
      return
    }
    // A story to another story keeps the world in view: the camera travels along the arcs between them (components/plegma/PlegmaStage.vue), so the view does not leave first.
    const hold = !(here?.kind === 'story' && next?.kind === 'story') && (here?.kind === 'theme' || here?.kind === 'group' || here?.kind === 'story' || here?.kind === 'outlet') && !samePlegmaFocus(here, next)
      ? LEAVE_HOLD_MS
      : from.meta.backdrop === true && from.path.replace(/\/+$/, '') !== '/stories' && next ? LEAVE_FADE_MS + 40 : 0
    if (!hold) return
    plegma.setLeaving(true)
    await new Promise(done => window.setTimeout(done, hold))
  })
  router.afterEach((_to, _from, failure) => {
    popped = false
    if (failure) plegma.setLeaving(false)
  })
})
