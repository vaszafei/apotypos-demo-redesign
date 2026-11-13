<script setup lang="ts">
// A glyph of the nav (Material Symbols Sharp, viewBox 0 -960 960 960) or a Heroicons outline path (viewBox 0 0 24 24), as in Icon() of the prototype.
const props = defineProps<{ name: string, glyph?: boolean, class?: string }>()
const html = computed(() => (props.glyph ? NAV_GLYPHS[props.name] : ICONS[props.name]) ?? '')
</script>

<template>
  <svg
    :class="props.class ?? (glyph ? 'icon nav-icon' : 'icon')" :viewBox="glyph ? '0 -960 960 960' : '0 0 24 24'"
    :fill="glyph ? 'currentColor' : 'none'" :stroke-width="glyph ? undefined : 1.5" :stroke="glyph ? undefined : 'currentColor'"
    aria-hidden="true" :data-icon="name" v-html="html"
  />
</template>
