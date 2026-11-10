<script setup lang="ts" generic="Row extends object">
// UI.DataTable of assets/components.js: a table of the first rows with a control for the rest. Each cell is the slot cell-<key>, or row[key].
// A column with num is right-aligned, with phone: false it is hidden below 640 px. Sorting and moreStep are not here (no ported page needs them yet).
export interface Column { key: string, label: string, num?: boolean, phone?: boolean }
const props = withDefaults(defineProps<{ columns: Column[], rows: Row[], rankColumn?: boolean, pageSize?: number, emptyText: string }>(), { pageSize: 10 })
const { t } = useI18n()
const expanded = ref(false)
const visible = computed(() => (expanded.value ? props.rows : props.rows.slice(0, props.pageSize)))
const cellClass = (c: Column) => [c.num && 'num', c.phone === false && 'hide-phone'].filter(Boolean).join(' ') || undefined
</script>

<template>
  <div v-if="!rows.length" class="empty-state" data-state="empty"><AppIcon name="inbox" /><p style="margin: 0">{{ emptyText }}</p></div>
  <div v-else>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="rankColumn" class="rank" scope="col">{{ t('table.rank') }}</th>
            <th v-for="c in columns" :key="c.key" scope="col" :class="cellClass(c)">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in visible" :key="i">
            <td v-if="rankColumn" class="rank">{{ i + 1 }}</td>
            <td v-for="c in columns" :key="c.key" :class="cellClass(c)"><slot :name="`cell-${c.key}`" :row="row">{{ (row as Record<string, unknown>)[c.key] }}</slot></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="rows.length > pageSize" class="table-more">
      <button type="button" class="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? t('table.less') : t('table.more', { n: fmtInt(rows.length) }) }}</button>
    </div>
  </div>
</template>
