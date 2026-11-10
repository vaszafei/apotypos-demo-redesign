// The way Home is left for a story or a theme (the pick in the large search): the text and the figures fade, the search field moves up into the top bar
// and, a little after it started, the route changes so that the map flies while the field is still on its way. Only the field and the fade are drawn here;
// the flight and the cards are the stage's and the view's own (PlegmaStage.vue, PlegmaStoryView.vue).
export const HOME_LEAVE_FADE = 240
export const HOME_LEAVE_FLY = 460

// `pill` is the field of the hero, `go` changes the route. With reduced motion, or with no field in the top bar to move to, the route changes at once.
export const leaveHome = async (pill: HTMLElement, go: () => unknown, reduced: boolean) => {
  const target = document.querySelector<HTMLElement>('.header-bar .global-search .search-button')
  const hero = document.querySelector('.home-hero')
  if (reduced || !target || !hero) { await go(); return }
  const html = document.documentElement
  const from = pill.getBoundingClientRect()
  const to = target.getBoundingClientRect()
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
  // The field of the top bar takes over from the one that arrived.
  delete html.dataset.searchFly
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => ghost.remove(), () => ghost.remove())
}
