<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// The people the story names and how it portrays them.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const m = computed(() => props.view.model.value!)
const PORTRAYAL = ['var(--emph-less)', 'var(--bar-muted)', 'var(--emph-more)']
const columns = computed(() => [
  { key: 'person', label: t('story.people.col.person') },
  { key: 'mentions', label: t('story.people.col.mentions'), num: true },
  { key: 'portrayal', label: t('story.people.col.portrayal'), phone: false }
])
</script>

<template>
  <DashCard :title="t('story.people.title')" :info="t('story.people.info')">
    <DataTable :rows="m.people" :columns="columns" rank-column :page-size="7" :empty-text="t('story.people.empty')">
      <template #cell-person="{ row }"><div><div>{{ row.person.name }}</div><span class="muted-text">{{ [row.person.role, row.person.party].filter(Boolean).join(' · ') }}</span></div></template>
      <template #cell-mentions="{ row }">{{ fmtInt(totalOf(row.counts)) }}</template>
      <template #cell-portrayal="{ row }"><StackedBar :segments="row.counts.map((n, i) => ({ label: t(`story.portrayal.${m.dd.portrayals[i]}`), value: n, color: PORTRAYAL[i]! }))" /></template>
    </DataTable>
  </DashCard>
</template>
