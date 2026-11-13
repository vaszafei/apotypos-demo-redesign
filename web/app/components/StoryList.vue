<script setup lang="ts">
import type { StoryDay } from '~/types/stories'

// The list of the stories of a period (Home.DayCard with part 'list' and linkRows): a row is the link to its story. A period can have thousands of stories, so the list draws them in parts
// of PART: the next part comes when the scroll is near the end. A new period starts at the top (the page gives the list a new key).
const props = defineProps<{ rows: StoryDay[] }>()
// The story pointed at in the list, for a web beside it (Μέσα › Ιστορίες) to light it.
const emit = defineEmits<{ point: [id: number | null] }>()
const PART = 100
const shown = ref(PART)
const visible = computed(() => props.rows.slice(0, shown.value))
const onScroll = (e: Event) => {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 400 && shown.value < props.rows.length) shown.value += PART
}
</script>

<template>
  <ul class="home-stories" @scroll.passive="onScroll" @pointerleave="emit('point', null)">
    <li v-for="o in visible" :key="o.s.id" @pointerenter="emit('point', o.s.id)">
      <NuxtLink class="home-story-pick" :to="storyHref(o.s.id)"><span class="home-story-name">{{ storyName(o.s) }}</span><span class="muted-text">{{ fmtInt(o.n) }}</span></NuxtLink>
    </li>
  </ul>
</template>
