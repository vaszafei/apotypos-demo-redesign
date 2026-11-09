<script setup lang="ts">
// DateRangePicker of assets/date-range.js: one button with the period, and a popover with the presets on the left and two months of days on the right.
// A first click on a day starts the period and a second click ends it. Only the days of the data can be picked.
interface Preset { key: string, label: string, from: string, to: string }
const props = defineProps<{ dates: string[], from: string, to: string }>()
const emit = defineEmits<{ change: [range: { from: string, to: string }] }>()

const iso = (d: Date) => d.toISOString().slice(0, 10)
const utc = (s: string) => new Date(`${s}T00:00:00Z`)
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
const monthStart = (s: string) => { const d = utc(s); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)) }
const label = (a: string, b: string) => (a === b ? fmtDate(a) : `${fmtDay(a)} – ${fmtDate(b)}`)
const dayCount = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000) + 1

const first = computed(() => props.dates[0]!)
const last = computed(() => props.dates[props.dates.length - 1]!)
const has = computed(() => new Set(props.dates))

const presets = computed<Preset[]>(() => {
  const d = props.dates
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const months = [...new Set(d.map(x => x.slice(0, 7)))].map((m) => {
    const days = d.filter(x => x.startsWith(m))
    return { key: m, label: cap(fmtMonth(days[0]!, { month: 'long', year: 'numeric' })), from: days[0]!, to: days[days.length - 1]! }
  })
  return [
    { key: 'all', label: 'Όλη η περίοδος', from: d[0]!, to: last.value },
    ...months,
    { key: 'last14', label: 'Τελευταίες 2 εβδομάδες', from: d[Math.max(0, d.length - 14)]!, to: last.value },
    { key: 'last7', label: 'Τελευταία εβδομάδα', from: d[Math.max(0, d.length - 7)]!, to: last.value }
  ]
})

const open = ref(false)
const draft = ref({ from: props.from, to: props.to })
const start = ref<string | null>(null)
const hover = ref<string | null>(null)
const view = ref(monthStart(props.from))
const clampView = (v: Date) => {
  if (iso(addMonths(v, 1)) > last.value) v = addMonths(monthStart(last.value), -1)
  if (iso(v) < iso(monthStart(first.value))) v = monthStart(first.value)
  return v
}

const edges = computed<[string, string]>(() => {
  if (start.value) { const end = hover.value || start.value; return start.value <= end ? [start.value, end] : [end, start.value] }
  return [draft.value.from, draft.value.to]
})
const inDraft = (d: string) => d >= edges.value[0] && d <= edges.value[1]

const month = (m: Date) => {
  const y = m.getUTCFullYear()
  const mo = m.getUTCMonth()
  const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  const lead = (m.getUTCDay() + 6) % 7
  return { title: fmtMonth(iso(m), { month: 'long', year: 'numeric' }), lead, days: Array.from({ length: days }, (_, i) => iso(new Date(Date.UTC(y, mo, i + 1)))) }
}
const months = computed(() => [month(view.value), month(addMonths(view.value, 1))])
const week = [0, 1, 2, 3, 4, 5, 6].map(i => fmtMonth(iso(new Date(Date.UTC(2026, 7, 3 + i))), { weekday: 'narrow' }))
const canPrev = computed(() => iso(view.value) > iso(monthStart(first.value)))
const canNext = computed(() => iso(addMonths(view.value, 2)) <= last.value)
const current = computed(() => presets.value.find(p => !start.value && p.from === draft.value.from && p.to === draft.value.to))

const pick = (key: string) => {
  if (!start.value) { start.value = key; hover.value = key } else {
    draft.value = start.value <= key ? { from: start.value, to: key } : { from: key, to: start.value }
    start.value = null; hover.value = null
  }
}
const usePreset = (p: Preset) => { draft.value = { from: p.from, to: p.to }; start.value = null; hover.value = null; view.value = clampView(monthStart(p.from)) }
const toggle = () => {
  if (open.value) { open.value = false; return }
  draft.value = { from: props.from, to: props.to }; start.value = null; hover.value = null
  view.value = clampView(monthStart(props.from)); open.value = true
}
const apply = () => { open.value = false; if (draft.value.from !== props.from || draft.value.to !== props.to) emit('change', { ...draft.value }) }

const root = ref<HTMLElement | null>(null)
onMounted(() => {
  const away = (e: PointerEvent) => { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
  document.addEventListener('pointerdown', away)
  onBeforeUnmount(() => document.removeEventListener('pointerdown', away))
})
</script>

<template>
  <div ref="root" class="dr" @keydown.esc.stop="open = false">
    <button type="button" class="dr-trigger" aria-haspopup="dialog" :aria-expanded="tf(open)" @click="toggle">
      <AppIcon name="calendar" class="icon dr-icon" /><span class="dr-text">{{ label(from, to) }}</span><AppIcon name="chevron-down" class="icon icon-sm dr-chev" />
    </button>
    <div class="dr-pop" role="dialog" aria-label="Περίοδος" :hidden="!open">
      <template v-if="open">
        <ul class="dr-presets" aria-label="Έτοιμες περίοδοι">
          <li v-for="p in presets" :key="p.key"><button type="button" class="dr-preset" :aria-pressed="tf(current === p)" @click="usePreset(p)">{{ p.label }}</button></li>
        </ul>
        <div class="dr-main">
          <div class="dr-nav">
            <button type="button" class="icon-button dr-step" :disabled="!canPrev" aria-label="Προηγούμενος μήνας" @click="view = addMonths(view, -1)"><AppIcon name="chevron-left" class="icon icon-sm" /></button>
            <button type="button" class="icon-button dr-step" :disabled="!canNext" aria-label="Επόμενος μήνας" @click="view = addMonths(view, 1)"><AppIcon name="chevron-right" class="icon icon-sm" /></button>
          </div>
          <div class="dr-months">
            <div v-for="m in months" :key="m.title" class="dr-month">
              <p class="dr-month-title">{{ m.title }}</p>
              <div class="dr-grid">
                <span v-for="(w, i) in week" :key="`w${i}`" class="dr-cell dr-wd" aria-hidden="true">{{ w }}</span>
                <span v-for="i in m.lead" :key="`b${i}`" class="dr-cell is-blank" aria-hidden="true" />
                <button
                  v-for="(d, i) in m.days" :key="d" type="button" :disabled="!has.has(d)" :data-day="d" :aria-label="fmtDate(d)" :aria-pressed="tf(d === edges[0] || d === edges[1])"
                  :class="['dr-cell', 'dr-day', inDraft(d) && 'in-range', d === edges[0] && 'is-start', d === edges[1] && 'is-end', !has.has(d) && 'is-off']"
                  @click="pick(d)" @pointerenter="start && hover !== d && (hover = d)"
                >{{ i + 1 }}</button>
              </div>
            </div>
          </div>
          <div class="dr-foot">
            <p class="dr-summary" aria-live="polite">{{ start ? 'Διαλέξτε την τελευταία ημέρα' : `${label(edges[0], edges[1])} · ${dayCount(edges[0], edges[1])} ημέρες` }}</p>
            <button type="button" class="button" @click="open = false">Ακύρωση</button>
            <button type="button" class="button button-primary" :disabled="Boolean(start)" @click="apply">Εφαρμογή</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
