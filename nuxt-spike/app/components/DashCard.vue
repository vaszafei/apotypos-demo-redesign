<script setup lang="ts">
defineProps<{ title: string, info?: string, sub?: string }>()
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[var(--surface-card)] p-4 transition-colors hover:border-[var(--border)]">
    <header class="flex items-start justify-between gap-2">
      <h2 class="text-base font-semibold">{{ title }}</h2>
      <UTooltip v-if="info" :text="info">
        <UButton icon="i-lucide-info" color="neutral" variant="ghost" size="xs" :aria-label="info" />
      </UTooltip>
    </header>
    <p v-if="sub" class="-mt-2 text-sm text-[var(--text-secondary)]">{{ sub }}</p>
    <slot />
  </section>
</template>
