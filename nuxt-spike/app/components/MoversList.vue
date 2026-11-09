<script setup lang="ts">
import type { TopicRow } from '~/types/topics'

const props = defineProps<{ rows: TopicRow[] }>()
const widest = computed(() => Math.max(...props.rows.map(r => Math.abs(r.change ?? 0)), 0.01))
</script>

<template>
  <ul class="flex flex-col gap-1.5 text-sm">
    <li v-for="r in rows" :key="r.k" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-2">
      <NuxtLink :to="`/topic/${r.k}`" class="truncate hover:underline">{{ r.issue.el }}</NuxtLink>
      <span class="h-2 rounded-sm bg-[var(--bar-track)]">
        <span
          class="block h-full rounded-sm"
          :style="{ width: `${(Math.abs(r.change ?? 0) / widest) * 100}%`, background: (r.change ?? 0) > 0 ? 'var(--emph-more)' : 'var(--emph-less)' }"
        />
      </span>
      <span class="text-right tabular-nums">{{ fmtSigned((r.change ?? 0) * 100) }}%</span>
    </li>
  </ul>
</template>
