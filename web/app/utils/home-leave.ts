// The way Home is left for a story or a theme (the pick in the large search): the text and the figures fade, the search field moves up to the middle of the top of the body,
// just under the top bar (not into the bar), and, a little after it started, the route changes so that the map flies while the field is still on its way. The field of the page
// (the body search of the layout, assets/css/plegma.css) is waiting at that place; the copy fades out over it. Only the field and the fade are drawn here; the flight and the cards
// are the stage's and the view's own (PlegmaStage.vue, PlegmaStoryView.vue).
export const HOME_LEAVE_FADE = 240
export const HOME_LEAVE_FLY = 520
// Where the field lands, as the body search is placed: under the top bar, this far from it, at most this wide, this high.
const LAND_GAP = 16
const LAND_WIDTH = 480
const LAND_HEIGHT = 38

// `pill` is the field of the hero, `go` changes the route. With reduced motion, or with no field in the top bar to move to, the route changes at once.
export const leaveHome = async (pill: HTMLElement, go: () => unknown, reduced: boolean) => {
  const bar = document.querySelector<HTMLElement>('.header-bar')
  const hero = document.querySelector('.home-hero')
  if (reduced || !bar || !hero) { await go(); return }
  const html = document.documentElement
  const from = pill.getBoundingClientRect()
  const width = Math.min(LAND_WIDTH, window.innerWidth - 32, from.width)
  const to = { left: (window.innerWidth - width) / 2, top: bar.getBoundingClientRect().bottom + LAND_GAP, width, height: LAND_HEIGHT }
  const ghost = pill.cloneNode(true) as HTMLElement
  ghost.removeAttribute('id')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.setAttribute('tabindex', '-1')
  ghost.classList.add('search-fly')
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` })
  document.body.append(ghost)
  html.dataset.searchFly = ''
  hero.classList.add('is-leaving')
  const fly = ghost.animate([
    { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` },
    { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` }
  ], { duration: HOME_LEAVE_FLY, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' })
  // The words of the field go first, so a squeezed line of text is never seen.
  ghost.querySelectorAll<HTMLElement>('.search-button-label, .global-search-key, .search-hero-go').forEach((el) => {
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HOME_LEAVE_FLY * 0.4, fill: 'forwards' })
  })
  window.setTimeout(() => { void go() }, HOME_LEAVE_FADE)
  await fly.finished.catch(() => null)
  // The field of the page is there when the route has changed: it takes over from the copy, which fades out over it.
  for (let waited = 0; waited < 800 && !document.querySelector('.body-search .search-button'); waited += 50) await new Promise(resolve => window.setTimeout(resolve, 50))
  delete html.dataset.searchFly
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }).finished.then(() => ghost.remove(), () => ghost.remove())
}
