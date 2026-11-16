<script setup lang="ts">
// Entity.TitleCard of assets/entity-cards.js: the kind and the name, the period once on the right, and one line of facts under them (EntityFact in the default slot). The slot title replaces the name (a group has its dot).
defineProps<{ kind: string, title?: string }>()
</script>

<template>
  <section class="dcard c-12 ecard">
    <div class="ecard-head">
      <div class="ecard-name"><span class="hero-kicker">{{ kind }}</span><h1 class="hero-title"><slot name="title">{{ title }}</slot></h1></div>
      <p v-if="$slots.meta" class="ecard-meta"><slot name="meta" /></p>
    </div>
    <dl class="ecard-facts"><slot /></dl>
  </section>
</template>
