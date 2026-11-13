<script setup lang="ts">
// A fact of EntityTitle: a label, a value, a short line after it (sub) and a small picture (spark).
defineProps<{ label: string, value: string, sub?: string }>()
</script>

<template>
  <div class="ecard-fact">
    <dt>{{ label }}</dt>
    <dd><strong>{{ value }}</strong><span v-if="sub || $slots.sub" class="ecard-sub"><slot name="sub">{{ sub }}</slot></span><slot name="spark" /></dd>
  </div>
</template>
