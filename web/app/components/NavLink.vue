<script setup lang="ts">
// A link to a route of the sidebar, the tabs or the footer: the router for a ported page, a plain link to the static page for the others.
defineProps<{ to: string }>()
</script>

<template>
  <NuxtLink v-if="isPorted(to)" :to="to"><slot /></NuxtLink>
  <a v-else :href="staticHref(to)"><slot /></a>
</template>
