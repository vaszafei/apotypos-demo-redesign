// The way Home is left for a story or a theme (the pick in the large search): the text, the figures and the field fade, and, once they have, the route changes so that the map flies.
// The search of the top bar is where it always is (left of «Μεθοδολογία»), so no field moves. Only the fade is drawn here; the flight and the cards are the stage's and the view's own
// (PlegmaStage.vue, PlegmaStoryView.vue). The fade is the CSS of `.home-hero.is-leaving` (assets/css/plegma.css).
export const HOME_LEAVE_FADE = 240

// `go` changes the route. With reduced motion, or with no hero in the page, the route changes at once.
export const leaveHome = async (go: () => unknown, reduced: boolean) => {
  const hero = document.querySelector('.home-hero')
  if (reduced || !hero) { await go(); return }
  hero.classList.add('is-leaving')
  await new Promise(resolve => window.setTimeout(resolve, HOME_LEAVE_FADE))
  await go()
}
