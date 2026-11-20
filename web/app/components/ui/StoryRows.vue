<script setup lang="ts">
// The rows of every list of stories (Αρχική, Μέσα › Ιστορίες, the pages of a story, a theme, an outlet and a group): the name of the story, on the right its count (and its change against the period before), under the name its theme
// as a link «Θέμα: title» when the page does not already say it. `pick`: a row opens through the page (`open`: the dive of Home and Μέσα); otherwise the name and the theme are links.
// A story pointed at is lit on the web beside the list (`hover`), a theme pointed at too (`hover-theme`).
export interface StoryRow {
  id: number
  name: string
  value: string
  issue?: number
  theme?: string
  // null: the story is new (it had no articles before); undefined: no change is shown.
  change?: { size: string, dir: 'up' | 'down' | null } | null
}
defineProps<{ rows: StoryRow[], pick?: boolean }>()
const emit = defineEmits<{ hover: [id: number | null], hoverTheme: [issue: number | null], open: [target: { story?: number, theme?: number }] }>()
const { t } = useI18n()
</script>

<template>
  <ul class="sr">
    <li v-for="r in rows" :key="r.id" @pointerenter="emit('hover', r.id)" @pointerleave="emit('hover', null)" @focusin="emit('hover', r.id)" @focusout="emit('hover', null)">
      <button v-if="pick" type="button" class="sr-name" :title="r.name" @click="emit('open', { story: r.id })">{{ r.name }}</button>
      <NuxtLink v-else class="sr-name" :title="r.name" :to="storyHref(r.id)">{{ r.name }}</NuxtLink>
      <span class="sr-end">
        <slot name="aside" :row="r" />
        <span class="sr-val">
          <span class="sr-n">{{ r.value }}</span>
          <span v-if="r.change !== undefined" class="sr-delta">
            <template v-if="r.change"><span v-if="r.change.dir" :class="`home-arrow is-${r.change.dir}`" aria-hidden="true">{{ r.change.dir === 'up' ? '▲' : '▼' }}</span> {{ r.change.size }}</template>
            <template v-else>{{ t('home.day.fresh') }}</template>
          </span>
        </span>
      </span>
      <span v-if="r.theme && r.issue !== undefined" class="sr-theme" @pointerenter="emit('hoverTheme', r.issue)" @pointerleave="emit('hoverTheme', null)" @focusin="emit('hoverTheme', r.issue)" @focusout="emit('hoverTheme', null)">
        {{ t('home.day.topic') }}
        <button v-if="pick" type="button" class="sr-theme-link" @click="emit('open', { theme: r.issue })">{{ r.theme }}</button>
        <NuxtLink v-else class="sr-theme-link" :to="topicHref(r.issue)">{{ r.theme }}</NuxtLink>
      </span>
    </li>
  </ul>
</template>
