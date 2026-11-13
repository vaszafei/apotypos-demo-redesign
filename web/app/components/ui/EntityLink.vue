<script setup lang="ts">
// UI.EntityLink of assets/components.js: the name of an entity as a link to its page. A page that is ported is a router link; the others open their static page.
const props = defineProps<{ to: string, type?: string }>()
const internal = computed(() => portedPath(props.to))
</script>

<template>
  <NuxtLink v-if="internal" class="entity-link" :to="internal" :data-entity="type"><slot /></NuxtLink>
  <a v-else class="entity-link" :href="to" :data-entity="type"><slot /></a>
</template>
