<script setup lang="ts">
// The white tooltip of UI.showTooltip (assets/components.js): above the pointer, under it when the top of the window is too near.
const store = useTooltipStore()
const box = ref<HTMLElement | null>(null)
const pos = reactive({ left: 0, top: 0 })
watch(() => [store.tip, store.x, store.y], async () => {
  if (!store.tip) return
  await nextTick()
  const b = box.value?.getBoundingClientRect()
  if (!b) return
  pos.left = Math.min(window.innerWidth - b.width - 8, Math.max(8, store.x - b.width / 2))
  pos.top = store.y - b.height - 12 >= 8 ? store.y - b.height - 12 : Math.min(window.innerHeight - b.height - 8, store.y + 18)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="store.tip" ref="box" class="tooltip" :class="{ 'is-rich': store.tip.rows?.length || store.tip.note }" role="status" :style="{ left: `${pos.left}px`, top: `${pos.top}px` }">
      <div class="tooltip-title">{{ store.tip.title }}</div>
      <div v-for="r in store.tip.rows" :key="r.label" class="tooltip-row">
        <span v-if="r.color" class="swatch" :style="{ background: r.color }" />
        <span class="tooltip-label">{{ r.label }}</span>
        <b class="tooltip-value">{{ r.value }}</b>
      </div>
      <div v-if="store.tip.note" class="tooltip-note">{{ store.tip.note }}</div>
    </div>
  </Teleport>
</template>
