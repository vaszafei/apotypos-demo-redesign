<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import type { Entry, Kind, Recent } from '~/utils/search'

// The global search of the top bar (GlobalSearch in assets/shell.js): a compact button that grows into a panel over the page, with a light scrim.
// The panel finds the pages and tabs at once and the rest (search.json) once it has loaded. The classes are the ones of app.css.
const { t } = useI18n()
const route = useRoute()
const { status, pages, entities, load, rememberPage } = useSearch()

interface Row { i: number, id: string, type: 'entry' | 'more' | 'query', e?: Entry, kind?: string, total?: number, q?: string }
interface Group { key: string, label: string, count?: number, rows: Row[], limit?: number, note?: string }

const panelId = 'global-search-panel'
const listId = 'global-search-list'
const button = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const scrim = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const closeButton = ref<HTMLButtonElement>()
const query = ref('')
const isOpen = ref(false)
// The panel stays in the page while it shrinks back into the button.
const shown = ref(false)
const active = ref(-1)
const expanded = ref(new Set<string>())
const recent = ref<Recent>({ pages: [], queries: [] })
const smallScreen = useMediaQuery('(max-width: 1023px)')
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
let motion: Animation[] = []

// Before typing: the last pages and searches of the visitor, then the stories in the most outlets and the groups.
// With a query: the hits of every kind, the best first.
const groups = computed<Group[]>(() => {
  let n = 0
  const row = (r: Omit<Row, 'i' | 'id'>): Row => ({ ...r, i: n, id: `gs-${n++}` })
  const section = (key: string, label: string, hits: Entry[], limit: number): Group => {
    const all = expanded.value.has(key)
    const list = hits.slice(0, all ? SHOW_ALL : limit)
    const rows = list.map(e => row({ type: 'entry', e }))
    if (hits.length > list.length && !all) rows.push(row({ type: 'more', kind: key, total: hits.length }))
    const note = all && hits.length > list.length ? t('shell.search.more', { n: fmtInt(list.length), total: fmtInt(hits.length) }) : undefined
    return { key, label, count: hits.length, rows, limit, note }
  }
  const text = query.value.trim()
  if (text) {
    const found: [Kind, Entry[]][] = [['pages', match(pages.value, text)]]
    if (entities.value) for (const k of KINDS.slice(1)) found.push([k, match(entities.value[k], text)])
    return found.filter(([, hits]) => hits.length).map(([k, hits]) => section(k, t(`shell.search.${k}`), hits, LIMITS[k]))
  }
  const here = hrefOf(route.path)
  const recentPages = recent.value.pages.filter(p => p.h !== here).slice(0, 4).map((p): Entry =>
    pages.value.find(x => x.h === p.h) ?? { kind: 'pages', n: p.n, where: placeOf(t, p.r) ?? '', h: p.h, route: p.r })
  const out: Group[] = []
  if (recentPages.length) out.push(section('recent-pages', t('shell.search.recent.pages'), recentPages, 4))
  const queries = recent.value.queries.slice(0, 4)
  if (queries.length) out.push({ key: 'recent-queries', label: t('shell.search.recent.queries'), rows: queries.map(q => row({ type: 'query', q })) })
  if (entities.value) {
    out.push(section('suggest-stories', t('shell.search.suggest.stories'), entities.value.stories.filter(s => s.outlets).slice(0, 5), 5))
    out.push(section('suggest-groups', t('shell.search.groups'), entities.value.groups, 4))
  }
  return out
})
const rows = computed(() => groups.value.flatMap(g => g.rows))
const count = computed(() => groups.value.reduce((s, g) => s + (g.count ?? 0), 0))
// What is under the groups: the index is loading or failed, or nothing was found.
const tail = computed(() => {
  if (!entities.value) return status.value === 'failed' ? 'failed' : 'loading'
  return query.value.trim() && !groups.value.length ? 'none' : null
})
const statusText = computed(() => {
  if (!query.value.trim()) return ''
  return count.value === 1 ? t('shell.search.count.one') : count.value ? t('shell.search.count', { n: fmtInt(count.value) }) : t('shell.search.none', { q: query.value.trim() })
})

const hrefFor = (e: Entry) => { const target = searchTarget(e); return 'to' in target ? target.to : target.href }
const scrollToActive = async () => {
  await nextTick()
  if (active.value >= 0) document.getElementById(`gs-${active.value}`)?.scrollIntoView({ block: 'nearest' })
}
watch(active, scrollToActive)
// A new query or the loaded index starts again at the first result.
watch([query, entities], () => {
  expanded.value = new Set()
  active.value = query.value.trim() && rows.value.length ? 0 : -1
})

// The panel sits over the button: centered on it on a wide screen, the full width of the screen on a phone (CSS).
const place = () => {
  const el = panel.value!
  el.style.maxHeight = ''
  if (smallScreen.value) { el.style.left = el.style.top = el.style.width = ''; return }
  const b = button.value!.getBoundingClientRect()
  const width = Math.min(640, window.innerWidth - 32)
  el.style.width = `${width}px`
  el.style.left = `${Math.max(16, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - 16 - width))}px`
  el.style.top = `${Math.max(8, b.top - 4)}px`
}
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
// The button grows into the panel and the panel shrinks back into the button: transform and opacity only. With reduced motion the panel only fades.
const morph = (opening: boolean) => {
  motion.forEach(a => a.cancel())
  const from = button.value!.getBoundingClientRect()
  const to = panel.value!.getBoundingClientRect()
  const small: Keyframe = { opacity: 0 }
  const big: Keyframe = { opacity: 1 }
  if (!reduceMotion.value) {
    small.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
    big.transform = 'none'
  }
  const timing = { duration: parseFloat(token('--motion-base')) || 0, easing: token(opening ? '--ease-out' : '--ease-in-out'), fill: 'both' as const }
  motion = [
    panel.value!.animate(opening ? [small, big] : [big, small], timing),
    scrim.value!.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], timing),
    button.value!.animate(opening ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { ...timing, duration: parseFloat(token('--motion-fast')) || 0 })
  ]
  return motion[0]!.finished.catch(() => null)
}

const open = async (text = '') => {
  if (isOpen.value) { input.value?.focus(); return }
  isOpen.value = true
  shown.value = true
  load()
  recent.value = readRecent()
  query.value = text
  expanded.value = new Set()
  active.value = text && rows.value.length ? 0 : -1
  await nextTick()
  place()
  input.value?.focus()
  morph(true).then(() => { if (isOpen.value) motion.forEach(a => a.cancel()) })
}
const close = ({ focus = true } = {}) => {
  if (!isOpen.value) return
  isOpen.value = false
  if (focus) button.value?.focus({ preventScroll: true })
  morph(false).then(() => {
    if (isOpen.value) return
    shown.value = false
    motion.forEach(a => a.cancel())
  })
}

// Choose: open a result, show all of a kind, or search a recent query again.
const choose = async (r: Row) => {
  if (r.type === 'more') {
    expanded.value = new Set(expanded.value).add(r.kind!)
    await nextTick()
    const group = groups.value.find(g => g.key === r.kind)
    active.value = (group?.rows[group.limit!] ?? group?.rows[0])?.i ?? -1
    input.value?.focus()
    return
  }
  if (r.type === 'query') { query.value = r.q!; input.value?.focus(); return }
  const text = query.value.trim()
  if (text) remember('queries', text, q => fold(q) === fold(text))
  close({ focus: false })
  const target = searchTarget(r.e!)
  await ('to' in target ? navigateTo(target.to) : navigateTo(target.href, { external: true }))
}
const onListClick = (e: MouseEvent) => {
  const el = (e.target as Element).closest<HTMLElement>('[role="option"]')
  if (!el || e.ctrlKey || e.metaKey || e.shiftKey) return
  e.preventDefault()
  choose(rows.value[Number(el.dataset.i)]!)
}
const onInputKey = (e: KeyboardEvent) => {
  const n = rows.value.length
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); active.value = (active.value + 1) % n }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); active.value = (active.value - 1 + n) % n }
  else if (e.key === 'Enter' && active.value >= 0) { e.preventDefault(); choose(rows.value[active.value]!) }
}
// Esc closes from anywhere in the panel. Tab moves between the field and the close button; the focus stays in the panel while it is open.
const onPanelKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === input.value ? closeButton.value : input.value)?.focus() }
}

// The "/" key opens the search from anywhere on the page.
useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || (e.target as Element).closest?.('input, textarea, select, [contenteditable]')) return
  e.preventDefault()
  open()
})
useEventListener('resize', () => { if (isOpen.value) place() })

// The search lists the last pages of the visitor.
onMounted(() => rememberPage(route.path))
watch(() => route.path, p => rememberPage(p))
</script>

<template>
  <div class="global-search" :class="{ 'is-open': isOpen }">
    <button ref="button" type="button" class="search-button" :aria-label="t('shell.search')" :title="t('shell.search')" aria-haspopup="dialog" :aria-expanded="tf(isOpen)" :aria-controls="panelId" aria-keyshortcuts="/" @click="open()">
      <AppIcon name="magnifying-glass" class="icon search-button-icon" /><span class="search-button-label" aria-hidden="true">{{ t('shell.search') }}</span><kbd class="global-search-key" aria-hidden="true">/</kbd>
    </button>
  </div>
  <ClientOnly>
    <Teleport to="body">
      <div ref="scrim" class="search-scrim" :hidden="!shown" @click="close({ focus: false })" />
      <div :id="panelId" ref="panel" class="search-panel" role="dialog" :aria-label="t('shell.search')" :hidden="!shown" @keydown="onPanelKey">
        <div class="search-field">
          <AppIcon name="magnifying-glass" class="icon global-search-icon" />
          <input
            ref="input" v-model="query" type="search" class="global-search-input" :placeholder="t('shell.search.placeholder')" :aria-label="t('shell.search')"
            role="combobox" :aria-expanded="tf(isOpen && rows.length > 0)" :aria-controls="listId" aria-autocomplete="list" :aria-activedescendant="active >= 0 ? `gs-${active}` : ''"
            autocomplete="off" spellcheck="false" enterkeyhint="go" @keydown="onInputKey"
          >
          <button ref="closeButton" type="button" class="search-close" :aria-label="t('shell.search.close')" :title="t('shell.search.close')" @click="close()"><AppIcon name="x-mark" class="icon" /></button>
        </div>
        <div :id="listId" class="global-search-list" role="listbox" :aria-label="t('shell.search')" @mousedown.prevent @click="onListClick">
          <div v-for="g in groups" :key="g.key" class="global-search-group" role="group" :aria-labelledby="`gs-kind-${g.key}`">
            <div :id="`gs-kind-${g.key}`" class="global-search-kind"><span>{{ g.label }}</span><span v-if="g.count != null" class="global-search-count">{{ fmtInt(g.count) }}</span></div>
            <template v-for="r in g.rows" :key="r.id">
              <a
                v-if="r.type === 'entry'" :id="r.id" class="global-search-option" role="option" :href="hrefFor(r.e!)" tabindex="-1" :data-i="r.i" :aria-selected="tf(r.i === active)"
              >
                <span class="global-search-name"><span class="global-search-label">{{ r.e!.n }}</span><span v-if="r.e!.d" class="global-search-sub">{{ r.e!.d }}</span></span>
                <span class="global-search-where">{{ [t(`shell.search.one.${r.e!.kind}`), r.e!.where].filter(Boolean).join(' · ') }}</span>
              </a>
              <div v-else-if="r.type === 'more'" :id="r.id" class="global-search-option global-search-more" role="option" tabindex="-1" :data-i="r.i" :aria-selected="tf(r.i === active)">{{ t('shell.search.all', { n: fmtInt(r.total!) }) }}</div>
              <div v-else :id="r.id" class="global-search-option is-query" role="option" tabindex="-1" :data-i="r.i" :aria-selected="tf(r.i === active)"><AppIcon name="magnifying-glass" class="icon icon-sm" /><span class="global-search-label">{{ r.q }}</span></div>
            </template>
            <p v-if="g.note" class="global-search-note">{{ g.note }}</p>
          </div>
          <div v-if="tail === 'loading'" class="global-search-loading"><span class="skeleton" /><span class="skeleton" /><p class="global-search-note">{{ t('shell.search.loading') }}</p></div>
          <p v-else-if="tail === 'failed'" class="global-search-note">{{ t('shell.search.failed') }}</p>
          <p v-else-if="tail === 'none'" class="global-search-note">{{ t('shell.search.none', { q: query.trim() }) }}</p>
        </div>
        <div class="visually-hidden" role="status">{{ statusText }}</div>
        <p class="search-keys" aria-hidden="true">{{ t('shell.search.keys') }}</p>
      </div>
    </Teleport>
  </ClientOnly>
</template>
