<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'
import type { PlegmaArticle } from '~/utils/plegma/plegma-articles'
import { branchLag } from '~/utils/plegma/plegma-branches'

// The article of the story opened from the Plegma (the eye of its pinned tooltip, plegma.reading), in a drawer from the right with the look of the log in drawer (.auth-drawer of assets/app.css):
// its outlet and group, title, author, time and place in the story, section, length, how soon it was found, the title of its page when it says something else, and the opening of its text
// with a link to the rest (data/story-articles/<id>.json of make-story-articles.py: the whole texts are too large to ship). «Αντίγραφα» is there when it copies an article of another
// outlet or is copied (story-copies): the article it copies, the other copies of that article and the articles that copy it, each with its opening, to compare; a click opens one in the drawer.
const props = defineProps<{ id: number, view: StoryView }>()
const { t } = useI18n()
const plegma = usePlegmaStore()

interface Extra { u?: string, a?: string, s?: string, w?: number, l?: number, v?: string, p?: string, o?: string }
const extras = shallowRef<Extra[] | null>(null)
let loadedFor = -1
const load = async (sid: number) => {
  if (loadedFor === sid) return
  loadedFor = sid
  extras.value = null
  const list = await $fetch<Extra[]>(`/data/story-articles/${sid}.json`).catch(() => [])
  if (loadedFor === sid) extras.value = list
}

const list = computed(() => props.view.articles.value)
const at = computed(() => plegma.reading)
const article = computed(() => (at.value === null ? null : list.value[at.value] ?? null))
const extra = computed(() => (at.value === null ? null : extras.value?.[at.value] ?? null))
const paragraphs = computed(() => (extra.value?.o ?? '').split('\n').filter(Boolean))

const short = (g: string | null) => (g ?? t('story.nogroup')).replace(/^(Συμφέροντα|Όμιλος)\s+/, '')
const color = (a: PlegmaArticle) => `var(--cat-${plegma.inkSlot(a)})`
const when = (a: PlegmaArticle) => (a.time === undefined ? '' : `${fmtDate(athensDate(a.time))}, ${athensClock(a.time)}`)
const lag = (m: number) => { const l = branchLag(Math.abs(m)); return t(l.key, { n: l.n }).replace(/^\+/, '') }
const facts = computed(() => {
  const a = article.value
  const x = extra.value
  if (!a) return []
  const first = list.value[0]?.time
  const rows: { label: string, value: string }[] = []
  if (x?.a) rows.push({ label: t('story.article.author'), value: x.a })
  rows.push({ label: t('story.article.published'), value: when(a) })
  rows.push({ label: t('story.article.place'), value: at.value === 0 || first === undefined || a.time === undefined
    ? t('story.article.first', { total: fmtInt(list.value.length) })
    : t('story.article.nth', { n: fmtInt(at.value! + 1), total: fmtInt(list.value.length), lag: lag(a.time - first) }) })
  if (x?.s) rows.push({ label: t('story.article.section'), value: x.s })
  if (x?.w) rows.push({ label: t('story.article.length'), value: t('story.article.words', { n: fmtInt(x.w), m: fmtInt(Math.max(1, Math.round(x.w / 200))) }) })
  if (x?.l !== undefined && x.l >= 0) rows.push({ label: t('story.article.seen'), value: t('story.article.seenAt', { lag: lag(x.l), via: x.v === 'rss' ? 'RSS' : 'sitemap' }) })
  if (x?.p) rows.push({ label: t('story.article.pageTitle'), value: x.p })
  return rows
})

// The copies around this article: the one it copies, the other copies of that one, and the copies of this one.
const pairs = computed(() => props.view.copies.value ?? [])
const source = computed(() => pairs.value.find(([c]) => c === at.value)?.[1] ?? null)
const siblings = computed(() => (source.value === null ? [] : pairs.value.filter(([c, s]) => s === source.value && c !== at.value).map(([c]) => c)))
const copiedBy = computed(() => pairs.value.filter(([, s]) => s === at.value).map(([c]) => c))
const copyCount = computed(() => (source.value === null ? 0 : 1) + siblings.value.length + copiedBy.value.length)
const tab = ref<'article' | 'copies'>('article')
const rowOf = (k: number) => {
  const a = list.value[k]!
  const me = article.value?.time
  const d = a.time !== undefined && me !== undefined ? a.time - me : 0
  const opening = extras.value?.[k]?.o?.replace(/\n/g, ' ') ?? ''
  return { k, a, when: when(a), rel: d === 0 ? '' : t(d < 0 ? 'story.article.earlier' : 'story.article.later', { lag: lag(d) }), opening: opening.length > 180 ? `${opening.slice(0, 180).replace(/\s+\S*$/, '')} …` : opening }
}
const groups = computed(() => [
  { key: 'of', label: t('story.article.copyOf'), rows: source.value === null ? [] : [rowOf(source.value)] },
  { key: 'siblings', label: t('story.article.siblings'), rows: siblings.value.map(rowOf) },
  { key: 'by', label: t('story.article.copiedBy'), rows: copiedBy.value.map(rowOf) }
].filter(g => g.rows.length))
const go = (k: number) => { plegma.read(k); tab.value = 'article'; main.value?.scrollTo({ top: 0 }) }

// Open and close as the log in drawer: the page behind is inert, Esc or a click on the scrim closes it, the focus stays in it.
const rendered = ref(false)
const shown = ref(false)
const panel = ref<HTMLElement | null>(null)
const main = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const app = () => document.getElementById('__nuxt')
let closeTimer: ReturnType<typeof setTimeout> | undefined
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>('button, a[href]')].filter(el => !el.closest('[hidden]'))
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  if (!panel.value.contains(document.activeElement)) { e.preventDefault(); first.focus() }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
const open = async () => {
  clearTimeout(closeTimer)
  load(props.id)
  tab.value = 'article'
  if (rendered.value) return
  rendered.value = true
  await nextTick()
  const root = app()
  if (root) root.inert = true
  document.addEventListener('keydown', onKey)
  panel.value?.getBoundingClientRect()
  shown.value = true
  closeButton.value?.focus({ preventScroll: true })
}
function close () { plegma.read(null) }
const shut = () => {
  if (!rendered.value) return
  document.removeEventListener('keydown', onKey)
  const root = app()
  if (root) root.inert = false
  shown.value = false
  closeTimer = setTimeout(() => { rendered.value = false }, still() ? 0 : 220)
}
watch(at, k => (k === null ? shut() : open()))
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); clearTimeout(closeTimer); const root = app(); if (root) root.inert = false; plegma.read(null) })
let pressed = false
const press = (e: MouseEvent) => { pressed = e.target === e.currentTarget }
const clickScrim = (e: MouseEvent) => { if (pressed && e.target === e.currentTarget) close() }
</script>

<template>
  <Teleport to="body">
    <div v-if="rendered" class="auth-overlay art-overlay" :class="{ 'is-open': shown }" @mousedown="press" @click="clickScrim">
      <div v-if="article" ref="panel" class="auth-drawer art-drawer" role="dialog" aria-modal="true" aria-labelledby="art-title">
        <div class="art-head">
          <p class="art-outlet"><i class="art-dot" :style="{ background: color(article) }" />{{ article.outlet }}<span class="art-group">{{ short(article.group) }}</span></p>
          <button ref="closeButton" type="button" class="icon-button auth-close" :aria-label="t('story.article.close')" @click="close"><AppIcon name="x-mark" /></button>
        </div>
        <div ref="main" class="art-main">
          <h2 id="art-title" class="art-title">{{ article.title || article.outlet }}</h2>
          <div v-if="copyCount" class="art-tabs" role="tablist" :aria-label="t('story.article.tabs')">
            <button type="button" role="tab" :aria-selected="tf(tab === 'article')" @click="tab = 'article'">{{ t('story.article.tab') }}</button>
            <button type="button" role="tab" :aria-selected="tf(tab === 'copies')" @click="tab = 'copies'">{{ t('story.article.copies') }}<span class="art-tab-n">{{ fmtInt(copyCount) }}</span></button>
          </div>
          <div v-if="tab === 'article'" class="art-panel" role="tabpanel">
            <dl class="art-facts">
              <div v-for="f in facts" :key="f.label"><dt>{{ f.label }}</dt><dd>{{ f.value }}</dd></div>
            </dl>
            <section v-if="extras" class="art-text">
              <h3 class="art-label">{{ t('story.article.opening') }}</h3>
              <template v-if="paragraphs.length"><p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p></template>
              <p v-else class="art-none">{{ t('story.article.noText') }}</p>
              <a v-if="extra?.u" class="button art-more" :href="extra.u" target="_blank" rel="noopener noreferrer">{{ t('story.article.more', { outlet: article.outlet }) }}<AppIcon name="arrow-top-right-on-square" class="icon icon-sm" /></a>
            </section>
          </div>
          <div v-else class="art-panel" role="tabpanel">
            <p class="art-note">{{ t('story.article.copyNote') }}</p>
            <section v-for="g in groups" :key="g.key" class="art-copies">
              <h3 class="art-label">{{ g.label }}</h3>
              <button v-for="r in g.rows" :key="r.k" type="button" class="art-copy" @click="go(r.k)">
                <span class="art-copy-top"><i class="art-dot" :style="{ background: color(r.a) }" /><b>{{ r.a.outlet }}</b><span class="art-copy-when">{{ r.when }}<template v-if="r.rel"> · {{ r.rel }}</template></span></span>
                <span class="art-copy-title">{{ r.a.title || r.a.outlet }}</span>
                <span v-if="r.opening" class="art-copy-text">{{ r.opening }}</span>
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
