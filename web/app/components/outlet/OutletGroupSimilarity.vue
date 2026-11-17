<script setup lang="ts">
import type { RelatedOutlet } from '~/utils/outlet-detail'

// The similarity of the outlet with the other outlets of its group. A pair with fewer than 10 shared stories has no score («—»). The row the pointer is on is told to the page (`hover`), which
// lights the line from the web to it.
const props = defineProps<{ rows: RelatedOutlet[], color: string, group: string | null }>()
const emit = defineEmits<{ hover: [slug: string | null] }>()
const { t } = useI18n()
const list = computed(() => props.rows.map(r => ({
  key: r.slug, label: r.name, to: outletHref(r.slug), text: r.score === null ? '—' : fmtPct(r.score), value: r.score ?? 0, color: props.color,
  tip: t('outlet2.related.row', { shared: fmtInt(r.shared) })
})))
const over = (e: PointerEvent) => {
  const li = (e.target as HTMLElement).closest('li')
  const at = li?.parentElement ? [...li.parentElement.children].indexOf(li) : -1
  emit('hover', at >= 0 ? props.rows[at]?.slug ?? null : null)
}
</script>

<template>
  <DashCard class="c-12" :title="t('outlet2.group.title')" :info="t('outlet2.group.info')" @pointerover="over" @pointerleave="emit('hover', null)">
    <BarList v-if="list.length" :rows="list" :max="Math.max(...list.map(r => r.value), 0.01)" />
    <p v-else class="dcard-empty">{{ group ? t('outlet2.group.alone') : t('outlet2.group.none') }}</p>
  </DashCard>
</template>
