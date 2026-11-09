<script setup lang="ts">
const store = useTooltipStore()
const style = computed(() => {
  const w = typeof window === 'undefined' ? 1200 : window.innerWidth
  const left = Math.min(store.x + 14, w - 260)
  return { left: `${left}px`, top: `${store.y + 14}px` }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.tip"
      class="pointer-events-none fixed z-50 max-w-60 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-lg"
      :style="style"
      role="tooltip"
    >
      <p v-if="store.tip.title" class="font-medium">{{ store.tip.title }}</p>
      <p v-if="store.tip.text">{{ store.tip.text }}</p>
      <p v-for="r in store.tip.rows" :key="r.label" class="flex items-center gap-2">
        <span class="size-2 shrink-0 rounded-full" :style="{ background: r.color }" />
        <span class="flex-1 truncate">{{ r.label }}</span>
        <span class="tabular-nums">{{ r.value }}</span>
      </p>
    </div>
  </Teleport>
</template>
