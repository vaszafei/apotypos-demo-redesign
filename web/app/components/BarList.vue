<script setup lang="ts">
// UI.BarList of assets/components.js: a name, a value and a horizontal bar on one scale.
export interface BarRow { key: string | number, label: string, to?: string, sub?: string, text: string, value: number, color: string, arrow?: 'up' | 'down' }
const props = defineProps<{ rows: BarRow[], max?: number }>()
const top = computed(() => props.max ?? Math.max(...props.rows.map(r => r.value), 1))
const width = (v: number) => `${(Math.min(v / top.value, 1) * 100).toFixed(4).replace(/\.?0+$/, '')}%`
</script>

<template>
  <div class="bar-box">
    <ul class="bar-list">
      <li v-for="r in rows" :key="r.key">
        <span class="row-name" :title="r.to ? undefined : r.label">
          <a v-if="r.to" class="entity-link" :href="r.to">{{ r.label }}</a>
          <template v-else>{{ r.label }}</template>
          <span v-if="r.sub" class="row-sub">{{ r.sub }}</span>
        </span>
        <span class="row-value"><template v-if="r.arrow"><span :class="`tri tri-${r.arrow}`" :style="{ color: r.color }" aria-hidden="true" />{{ ' ' }}</template>{{ r.text }}</span>
        <div class="hbar"><div class="hbar-track"><div class="hbar-fill" :style="{ width: width(r.value), background: r.color }" /></div></div>
      </li>
    </ul>
  </div>
</template>
