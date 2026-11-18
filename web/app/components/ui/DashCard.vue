<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// Dash.card + Dash.cardHead: a card with its title, the tools slot (a legend) and the info popover.
// Inside a screen of the Plegma (MediaPlegma.vue) the card arrives as the cards of the stories do (PlegmaCard.vue, assets/css/plegma.css ".is-cut"): when it comes into view, a "/" is drawn, the card shows
// cut by it into two parts a row apart (the card twice, the second only until it is done), and the parts slide into one row. Elsewhere it is a plain card.
defineProps<{ title: string, info?: string, card?: string }>()
const { t } = useI18n()
const arrival = inject<{ next: () => number } | null>('plegmaArrival', null)
const cut = arrival !== null
const order = arrival?.next() ?? 0
const root = ref<HTMLElement>()
const cw = ref(400)
const ch = ref(300)
const go = ref(false)
const done = ref(false)
const mounted = ref(false)
const parts = computed(() => (mounted.value && !done.value ? ['a', 'b'] : ['a']))
if (cut) {
  useResizeObserver(root, () => { const el = root.value; if (el) { cw.value = el.offsetWidth; ch.value = el.offsetHeight } })
  onMounted(() => {
    mounted.value = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { go.value = true; done.value = true; return }
    const watcher = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { go.value = true; watcher.disconnect() } }, { rootMargin: '0px 0px -10% 0px' })
    if (root.value) watcher.observe(root.value)
    onBeforeUnmount(() => watcher.disconnect())
  })
}
</script>

<template>
  <section v-if="!cut" class="dcard" :data-card="card">
    <div class="dcard-head">
      <h2 class="dcard-title">{{ title }}</h2>
      <div v-if="$slots.tools || info" class="dcard-tools">
        <slot name="tools" />
        <span v-if="info" class="info">
          <button type="button" class="info-btn" :aria-label="t('dash.info')" aria-expanded="false"><AppIcon name="information-circle" /></button>
          <span class="info-pop" role="note">{{ info }}</span>
        </span>
      </div>
    </div>
    <slot />
  </section>
  <section v-else ref="root" class="dcard is-cut" :class="{ 'cut-go': go, 'cut-done': done }" :data-card="card" :style="{ '--i': order, '--cw': `${cw}px`, '--ch': `${ch}px` }">
    <div v-for="part in parts" :key="part" class="cut-sheet" :class="`cut-${part}`" :aria-hidden="part === 'b' ? 'true' : undefined" :inert="part === 'b'">
      <div class="cut-in">
        <div class="dcard-head">
          <h2 class="dcard-title">{{ title }}</h2>
          <div v-if="$slots.tools || info" class="dcard-tools">
            <slot name="tools" />
            <span v-if="info" class="info">
              <button type="button" class="info-btn" :aria-label="t('dash.info')" aria-expanded="false"><AppIcon name="information-circle" /></button>
              <span class="info-pop" role="note">{{ info }}</span>
            </span>
          </div>
        </div>
        <slot />
      </div>
    </div>
    <span v-if="mounted && !done" class="cut-slash" aria-hidden="true" @animationend="done = true" />
  </section>
</template>
