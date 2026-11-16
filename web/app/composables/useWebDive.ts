import { useMediaQuery } from '@vueuse/core'
import { diveFromDay } from '~/utils/plegma/plegma-dive'

// What a screen with the web of a day or a period (components/plegma/PlegmaDayWeb.vue) and a list of its stories (components/home/DayStoryList.vue) shares: the story pointed at in the list (`hoverStory`),
// and the dive into the page of a story or a theme picked on the web or in the list (utils/plegma/plegma-dive.ts); `leaving` is true from the pick on, for the screen to fade out its cards.
export interface DayWebHandle { spotOf: (target: { story?: number, theme?: number }) => { x: number, y: number }, canvas: HTMLCanvasElement | undefined }
export const useWebDive = (litIssue: Ref<number | null>) => {
  const plegma = usePlegmaStore()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const web = ref<DayWebHandle>()
  const leaving = ref(false)
  const hoverStory = ref<number | null>(null)
  const open = async (target: { story?: number, theme?: number }) => {
    const w = web.value
    if (leaving.value || !w?.canvas) return
    leaving.value = true
    hoverStory.value = null
    litIssue.value = null
    const to = target.story !== undefined ? storyHref(target.story) : topicHref(String(target.theme))
    await diveFromDay(w.canvas, w.spotOf(target), { go: () => navigateTo(to), region: () => plegma.region, reduced: reduced.value })
  }
  return { web, leaving, hoverStory, open }
}
