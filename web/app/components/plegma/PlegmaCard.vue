<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// One floating card of the Orbit: a raised surface that takes the pointer only on itself, so the map and the gaps between cards pass it to the stage (KTD8).
// `at` is its slot (0 and 1 on the right, 2 and 3 below the map); `order` is when it arrives after the camera lands. It arrives built from the logo backwards: a "/" is drawn from the top to the bottom,
// the card shows cut by it into two parts a row apart (the same card twice, each clipped by the "/"), and the parts slide into one row (assets/css/plegma.css, ".is-cut"). `done` drops the second part and the "/".
defineProps<{ at: number, order: number }>()
const card = ref<HTMLElement>()
const cw = ref(400)
const ch = ref(300)
const done = ref(false)
useResizeObserver(card, () => { const el = card.value; if (el) { cw.value = el.offsetWidth; ch.value = el.offsetHeight } })
</script>

<template>
  <div ref="card" class="plegma-card is-cut" :class="[`at-${at}`, { 'cut-done': done }]" :style="{ '--i': order, '--cw': `${cw}px`, '--ch': `${ch}px` }">
    <div class="cut-sheet cut-a"><div class="cut-in"><div class="plegma-card-body"><slot /></div></div></div>
    <div v-if="!done" class="cut-sheet cut-b" aria-hidden="true" inert><div class="cut-in"><div class="plegma-card-body"><slot /></div></div></div>
    <span v-if="!done" class="cut-slash" aria-hidden="true" @animationend="done = true" />
  </div>
</template>
