<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

// A tab of a section with tabs (Μέσα): scrolling on past the end of the page goes to the next tab, and past the top to the tab before, as an app with tabs does.
// The pull is the scroll that the page cannot take any more; the tab it goes to fills in the sidebar, and the row of the next tab at the end of the page draws its rule. When it is full the tab opens (the tab move slides it up or down).
// A pull starts only with a new gesture: the momentum of the scroll that reached the edge (or that opened this tab) does not count.
const { t } = useI18n()
const route = useRoute()
const { section, detail } = useNav()
const PULL = 320
const QUIET_MS = 220
const RELAX_MS = 380

const index = computed(() => (detail.value ? -1 : section.value.tabs.findIndex(tab => tab.to === route.path)))
const next = computed(() => (index.value >= 0 ? section.value.tabs[index.value + 1] ?? null : null))
const prev = computed(() => (index.value > 0 ? section.value.tabs[index.value - 1]! : null))

const pull = ref(0)
const way = ref<'down' | 'up' | null>(null)
let lastWheel = 0
let fresh = false
let relax = 0
let going = false

const edge = () => {
  const el = document.scrollingElement ?? document.documentElement
  return { top: el.scrollTop <= 1, end: el.scrollTop + window.innerHeight >= el.scrollHeight - 2 }
}
const reset = () => { pull.value = 0; way.value = null }
const go = (to: string, up: boolean) => {
  going = true
  reset()
  Promise.resolve(navigateTo(to)).then(async () => {
    if (!up) return
    // The tab before opens at its end, where the pull came from: once its cards have their height.
    await nextTick()
    for (let k = 0; k < 12; k++) {
      await new Promise(r => setTimeout(r, 60))
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' as ScrollBehavior })
    }
  }).finally(() => { going = false; fresh = false })
}
const add = (dy: number) => {
  const e = edge()
  const down = dy > 0
  const target = down ? next.value : prev.value
  if (!target || (down ? !e.end : !e.top)) { reset(); return }
  if (way.value && way.value !== (down ? 'down' : 'up')) reset()
  way.value = down ? 'down' : 'up'
  pull.value = Math.min(1, pull.value + Math.abs(dy) / PULL)
  window.clearTimeout(relax)
  relax = window.setTimeout(reset, RELAX_MS)
  if (pull.value >= 1 && !going) go(target.to, !down)
}
useEventListener(window, 'wheel', (e: WheelEvent) => {
  if (index.value < 0 || going || e.ctrlKey) return
  const now = performance.now()
  if (now - lastWheel > QUIET_MS) fresh = true
  lastWheel = now
  if (!fresh) return
  const e2 = edge()
  // A wheel that the page still scrolls is not a pull, and the gesture is spent: the momentum that reaches the edge does not go on into a pull.
  if ((e.deltaY > 0 && !e2.end) || (e.deltaY < 0 && !e2.top)) { fresh = false; reset(); return }
  add(e.deltaY * (e.deltaMode === 1 ? 32 : 1))
}, { passive: true })
let touchY: number | null = null
useEventListener(window, 'touchstart', (e: TouchEvent) => { touchY = index.value >= 0 && !going ? e.touches[0]!.clientY : null }, { passive: true })
useEventListener(window, 'touchmove', (e: TouchEvent) => {
  if (touchY === null) return
  const y = e.touches[0]!.clientY
  add((touchY - y) * 1.4)
  touchY = y
}, { passive: true })
useEventListener(window, 'touchend', () => { touchY = null; if (pull.value < 1) reset() }, { passive: true })
watch(() => route.path, () => { reset(); fresh = false })
// The tab of the sidebar that the pull goes to fills with it (layouts/default.vue reads this).
const shared = useState<{ to: string | null, pull: number }>('tab-pull', () => ({ to: null, pull: 0 }))
watch([pull, way], () => { shared.value = { to: way.value === 'down' ? next.value?.to ?? null : way.value === 'up' ? prev.value?.to ?? null : null, pull: pull.value } })
onBeforeUnmount(() => { shared.value = { to: null, pull: 0 } })
</script>

<template>
  <div v-if="next" class="tab-next" :class="{ 'is-pulling': way === 'down' }" :style="{ '--pull': way === 'down' ? pull : 0 }">
    <NavLink :to="next.to" class="tab-next-link"><span class="dcard-title">{{ t(`tab.${section.key}.${next.key}`) }}</span><AppIcon name="chevron-down" class="icon icon-sm" /></NavLink>
    <span class="tab-next-rule" aria-hidden="true" />
  </div>
</template>
