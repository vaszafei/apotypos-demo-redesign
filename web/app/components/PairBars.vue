<script setup lang="ts">
// PairBars of assets/mme.js: two bars, one under the other, on one center line: the outlet (critical to the left, supportive to the right) and, thin and gray, all the other articles to compare with.
defineProps<{ here: { left: number, right: number }, others: { left: number, right: number }, scale: number, label: string }>()
</script>

<template>
  <div class="pair-dbar">
    <DivergingBar :left="here.left" :right="here.right" :scale="scale" :colors="['var(--stance-critical)', null, 'var(--stance-supportive)']" :label="label" />
    <DivergingBar :left="others.left" :right="others.right" :scale="scale" :colors="['var(--cat-0)', null, 'var(--cat-0)']" />
  </div>
</template>
