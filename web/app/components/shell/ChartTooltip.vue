<script setup lang="ts">
// The white tooltip of UI.showTooltip (assets/components.js): above the pointer, under it when the top of the window is too near.
// Anchored to a node (stores/tooltip.ts `at`), it stands on the node's right, its title at the node's height (on its left when the window has no room), and is held: the pointer can go into it.
// Pinned, it can be pointed at and its button pressed; Esc, a press outside it or a route change lets it go.
const store = useTooltipStore()
const route = useRoute()
const box = ref<HTMLElement | null>(null)
const pos = reactive({ left: 0, top: 0 })
const GAP = 6
watch(() => [store.tip, store.x, store.y, store.at], async () => {
  if (!store.tip) return
  await nextTick()
  const b = box.value?.getBoundingClientRect()
  if (!b) return
  const at = store.at
  if (at) {
    const right = at.x + at.r + GAP
    pos.left = right + b.width <= window.innerWidth - 8 ? right : Math.max(8, at.x - at.r - GAP - b.width)
    pos.top = Math.min(window.innerHeight - b.height - 8, Math.max(8, at.y - 20))
    return
  }
  pos.left = Math.min(window.innerWidth - b.width - 8, Math.max(8, store.x - b.width / 2))
  pos.top = store.y - b.height - 12 >= 8 ? store.y - b.height - 12 : Math.min(window.innerHeight - b.height - 8, store.y + 18)
})
watch(() => route.fullPath, () => store.close())
const away = (e: PointerEvent) => { if (store.pinned && !box.value?.contains(e.target as Node)) store.unpin() }
const key = (e: KeyboardEvent) => { if (store.pinned && e.key === 'Escape') store.unpin() }
onMounted(() => { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', key) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key) })
const run = () => { const action = store.tip?.action; store.close(); action?.run() }
</script>

<template>
  <Teleport to="body">
    <div v-if="store.tip" ref="box" class="tooltip" :class="{ 'is-rich': store.tip.rows?.length || store.tip.note, 'is-field': store.tip.field, 'is-pinned': store.pinned, 'is-held': store.at && !store.pinned, 'has-action': store.tip.action }" :role="store.pinned ? 'dialog' : 'status'" :aria-label="store.pinned ? store.tip.title : undefined" :style="{ left: `${pos.left}px`, top: `${pos.top}px` }" @pointerenter="store.enter()" @pointerleave="store.leave()">
      <div class="tooltip-title">{{ store.tip.title }}</div>
      <div v-for="r in store.tip.rows" :key="r.label" class="tooltip-row">
        <span v-if="r.color" class="swatch" :style="{ background: r.color }" />
        <span class="tooltip-label">{{ r.label }}</span>
        <b class="tooltip-value">{{ r.value }}</b>
      </div>
      <div v-if="store.tip.note" class="tooltip-note">{{ store.tip.note }}</div>
      <button v-if="store.tip.action" type="button" class="icon-button tooltip-action" :title="store.tip.action.label" :aria-label="store.tip.action.label" :tabindex="store.pinned || store.at ? 0 : -1" @click="run">
        <AppIcon :name="store.tip.action.icon" class="icon icon-sm" />
      </button>
    </div>
  </Teleport>
</template>
