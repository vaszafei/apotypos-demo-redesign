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
const { t } = useI18n()
const shown = ref(100)
watch(() => props.rows, () => { shown.value = 100 })
const more = (e: Event) => {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 300 && shown.value < props.rows.length) shown.value += 100
}
</script>

<template>
  <DashCard :title="title" :info="info" card="home-stories" class="home-day-list">
    <ul v-if="rows.length" class="home-stories" @scroll="more">
      <li v-for="r in rows.slice(0, shown)" :key="r.id">
        <button type="button" class="home-story-pick" @pointerenter="emit('hover', r.id)" @pointerleave="emit('hover', null)" @focus="emit('hover', r.id)" @blur="emit('hover', null)" @click="emit('open', { story: r.id })">
          <span class="home-story-name">{{ r.name }}</span>
          <span class="home-story-num"><span class="muted-text">{{ fmtInt(r.n) }}</span><span v-if="r.change !== undefined" class="home-story-delta muted-text">
            <template v-if="r.change"><span v-if="r.change.dir" :class="`home-arrow is-${r.change.dir}`" aria-hidden="true">{{ r.change.dir === 'up' ? '▲' : '▼' }}</span> {{ r.change.size }}</template>
            <template v-else>{{ t('home.day.fresh') }}</template>
          </span></span>
        </button>
        <button type="button" class="home-row-theme" @pointerenter="emit('hoverTheme', r.issue)" @pointerleave="emit('hoverTheme', null)" @focus="emit('hoverTheme', r.issue)" @blur="emit('hoverTheme', null)" @click="emit('open', { theme: r.issue })">
          {{ t('home.day.topic') }} <span class="home-row-theme-name">{{ r.theme }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="empty" class="dcard-empty">{{ empty }}</p>
  </DashCard>
</template>
