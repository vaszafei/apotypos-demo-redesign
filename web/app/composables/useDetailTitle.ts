// The name of the entity on a detail page (the title() of the static pages): the last item of the trail bar shows it, the tab that lists the page if there is none yet.
export const useDetailTitle = () => useState<string | null>('detail-title', () => null)

// Called by the body of a detail page whose trail is its entity (a topic, an outlet, a group). The name is dropped when the page is left.
export const provideDetailTitle = (title: () => string | null) => {
  const state = useDetailTitle()
  watchEffect(() => { state.value = title() })
  onBeforeUnmount(() => { state.value = null })
}
