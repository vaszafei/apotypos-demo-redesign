<script setup lang="ts">
// The list of the stories of a day (Home, «Η επικαιρότητα») or of a period (Μέσα › Ιστορίες): the largest first, each with its articles, its change against the day or the period before, and under it its theme
// as a link «Θέμα: title». A story pointed at is lit on the web beside it (`hover`), a theme pointed at too (`hover-theme`); a click on either opens (`open`). The rows come in parts of 100 as the list scrolls.
export interface DayStoryRow {
  id: number
  name: string
  n: number
  issue: number
  theme: string
  // null: the story is new (it had no articles before); undefined: no change is shown.
  change?: { size: string, dir: 'up' | 'down' | null } | null
}
const props = defineProps<{ rows: DayStoryRow[], title: string, info: string, empty?: string }>()
const emit = defineEmits<{ hover: [id: number | null], hoverTheme: [issue: number | null], open: [target: { story?: number, theme?: number }] }>()
const shown = ref(100)
watch(() => props.rows, () => { shown.value = 100 })
const list = computed(() => props.rows.slice(0, shown.value).map(r => ({ id: r.id, name: r.name, value: fmtInt(r.n), issue: r.issue, theme: r.theme, change: r.change })))
const more = (e: Event) => {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 300 && shown.value < props.rows.length) shown.value += 100
}
</script>

<template>
  <DashCard :title="title" :info="info" card="home-stories" class="home-day-list">
    <StoryRows v-if="rows.length" pick class="sr-fill" :rows="list" @scroll="more" @hover="emit('hover', $event)" @hover-theme="emit('hoverTheme', $event)" @open="emit('open', $event)" />
    <p v-else-if="empty" class="dcard-empty">{{ empty }}</p>
  </DashCard>
</template>
