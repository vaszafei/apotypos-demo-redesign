<script setup lang="ts">
import { useEventListener, useMediaQuery, useRafFn } from '@vueuse/core'
import { mulberry } from '~/utils/plegma-world'
import { placeLabels } from '~/utils/stance-labels'
import type { StancePoint } from '~/types/mme'

// Μέσα › Στάση as a web of the Plegma (the stance map of media-v2.html, drawn over the dim world): each outlet is a node at its critical share (to the right) and its supportive share
// (up), in the color of its group and as large as its articles; around it a small loose cloud of dots in the colors of the stance of its articles (critical, neutral, supportive, as many
// of each as their share), so the mix of an outlet shows at a glance. Thin curved threads join the outlets of one group. The three zones are where one share is the largest: thin
// threads from the point where the three are a third each, with the name of each zone in its corner; the dashed threads are the shares of all the articles.
// It grows out of the point of all the articles when it comes into view, and drifts slowly. An outlet pointed at comes forward with the threads of its group; a click opens it.
export interface StanceNode extends StancePoint { slug: string, group: string | null }
const props = defineProps<{ points: StanceNode[], avg: { c: number, s: number }, active: boolean, caption: string }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const prefs = usePrefsStore()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const TAU = Math.PI * 2
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const box = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
const size = ref({ w: 0, h: 0 })

let ink = '#111'
let mute = '#6b6f78'
let paper = '#f6f4ef'
let font = 'system-ui, sans-serif'
let stance = ['#c23b3b', '#8a9099', '#7c4dbe']
const colour = new Map<string, string>()
const readTokens = () => {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  ink = v('--ink', ink)
  mute = v('--text-secondary', mute)
  paper = v('--surface-page', paper)
  font = v('--font-text', font)
  stance = [v('--stance-critical', stance[0]!), v('--stance-neutral', stance[1]!), v('--stance-supportive', stance[2]!)]
  colour.clear()
}
// A group color is a var(--cat-N): read it from the page once.
const resolve = (c: string) => {
  let out = colour.get(c)
  if (!out) {
    const m = /var\((--[\w-]+)\)/.exec(c)
    out = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || mute : c
    colour.set(c, out)
  }
  return out
}

// The plot: the axes start and end near the data, so the outlets spread over the area; a margin leaves room for the names.
const pad = { top: 34, right: 40, bottom: 44, left: 40 }
const ext = computed(() => {
  const cs = props.points.map(p => p.c)
  const ss = props.points.map(p => p.s)
  return {
    x0: Math.max(0, Math.min(...cs) - 0.05), x1: Math.min(1, Math.max(...cs) + 0.05),
    y0: Math.max(0, Math.min(...ss) - 0.04), y1: Math.min(1, Math.max(...ss) + 0.05)
  }
})
const sx = (c: number) => pad.left + ((c - ext.value.x0) / (ext.value.x1 - ext.value.x0)) * (width - pad.left - pad.right)
const sy = (s: number) => height - pad.bottom - ((s - ext.value.y0) / (ext.value.y1 - ext.value.y0)) * (height - pad.top - pad.bottom)
const maxN = computed(() => Math.max(1, ...props.points.map(p => p.n)))
const radius = (p: StancePoint) => 4 + 9 * Math.sqrt(p.n / maxN.value)

// The cloud of each outlet: dots at loose places around it, the colors in the shares of its stance; the places and the drift are seeded by its name, so they keep across frames.
interface Cloud { dx: Float32Array, dy: Float32Array, kind: Uint8Array, phase: Float32Array, speed: Float32Array, link: Int16Array, bow: Float32Array }
const clouds = computed<Cloud[]>(() => props.points.map((p) => {
  const rand = mulberry([...p.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 11))
  const k = clamp(Math.round(4 + 10 * Math.sqrt(p.n / maxN.value)), 4, 14)
  const counts = [Math.round(p.c * k), 0, Math.round(p.s * k)]
  counts[1] = Math.max(0, k - counts[0]! - counts[2]!)
  const kind = new Uint8Array(k)
  let at = 0
  counts.forEach((n, i) => { for (let j = 0; j < n && at < k; j++) kind[at++] = i })
  const dx = new Float32Array(k)
  const dy = new Float32Array(k)
  const link = new Int16Array(k)
  const bow = new Float32Array(k)
  const reach = 16 + 22 * Math.sqrt(p.n / maxN.value)
  for (let j = 0; j < k; j++) {
    const a = rand() * TAU
    const r = reach * (0.45 + 0.55 * Math.sqrt(rand()))
    dx[j] = Math.cos(a) * r
    dy[j] = Math.sin(a) * r
    // Each dot hangs from the outlet or from the nearest dot placed before it.
    let near = -1
    let best = Math.hypot(dx[j]!, dy[j]!)
    for (let q = 0; q < j; q++) { const d = Math.hypot(dx[q]! - dx[j]!, dy[q]! - dy[j]!); if (d < best) { best = d; near = q } }
    link[j] = near
    bow[j] = (rand() - 0.5) * 0.6
  }
  return { dx, dy, kind, link, bow, phase: Float32Array.from({ length: k + 1 }, () => rand() * TAU), speed: Float32Array.from({ length: k + 1 }, () => (0.25 + rand() * 0.5) * (rand() < 0.5 ? -1 : 1)) }
}))
// The threads of a group: each outlet to the next one of its group, the largest first.
const threads = computed(() => {
  const by = new Map<string, number[]>()
  props.points.forEach((p, i) => { if (p.group) by.set(p.group, [...by.get(p.group) ?? [], i]) })
  const out: [number, number][] = []
  for (const list of by.values()) {
    const order = list.slice().sort((a, b) => props.points[b]!.n - props.points[a]!.n)
    for (let k = 1; k < order.length; k++) out.push([order[k - 1]!, order[k]!])
  }
  return out
})
const labels = computed(() => {
  if (!size.value.w) return []
  const dots = props.points.map(p => ({ name: p.name, n: p.n, x: sx(p.c), y: sy(p.s), r: radius(p) + 10 }))
  return placeLabels(dots, [], { x0: 0, x1: width, y0: 0, y1: height })
})

// The growth out of the point of all the articles.
const GROW_MS = 1600
let growAt = -1
let hover = -1
let mix = 0
let litLast = -1
let last = 0
let px = new Float32Array(0)
let py = new Float32Array(0)
const ease3 = (k: number) => 1 - (1 - clamp(k, 0, 1)) ** 3

const draw = (sec: number, dt: number) => {
  const g = ctx
  if (!g || !width || !props.points.length) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, width, height)
  const grown = growAt < 0 ? (reduced.value ? 1 : 0) : clamp((performance.now() - growAt) / GROW_MS, 0, 1)
  const ox = sx(props.avg.c)
  const oy = sy(props.avg.s)
  const third = 1 / 3
  mix = reduced.value ? (hover >= 0 ? 1 : 0) : mix + ((hover >= 0 ? 1 : 0) - mix) * (1 - Math.exp(-dt * 9))
  if (hover >= 0) litLast = hover
  const litGroup = litLast >= 0 ? props.points[litLast]!.group : null
  const back = 1 - 0.6 * mix
  const frame = ease3(grown / 0.6)

  // The zones: three thin threads from the point of thirds, and their names in the corners; the shares of all the articles as dashed threads with their notes.
  g.lineCap = 'round'
  g.save()
  g.beginPath(); g.rect(pad.left, pad.top, width - pad.left - pad.right, height - pad.top - pad.bottom); g.clip()
  g.strokeStyle = ink
  g.globalAlpha = 0.22 * frame
  g.lineWidth = 1
  const tx = sx(third)
  const ty = sy(third)
  for (const [c, s] of [[0.5, 0.5], [0.5, 0], [0, 0.5]] as const) {
    const ex = tx + (sx(c) - tx) * frame
    const ey = ty + (sy(s) - ty) * frame
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo((tx + ex) / 2 + (ey - ty) * 0.04, (ty + ey) / 2 - (ex - tx) * 0.04, ex, ey); g.stroke()
  }
  g.setLineDash([3, 5])
  g.globalAlpha = 0.28 * frame
  g.beginPath(); g.moveTo(ox, oy - (oy - pad.top) * frame); g.lineTo(ox, oy + (height - pad.bottom - oy) * frame); g.stroke()
  g.beginPath(); g.moveTo(ox - (ox - pad.left) * frame, oy); g.lineTo(ox + (width - pad.right - ox) * frame, oy); g.stroke()
  g.setLineDash([])
  g.restore()
  g.font = `600 12px ${font}`
  g.fillStyle = mute
  g.globalAlpha = 0.9 * frame
  g.textAlign = 'right'; g.fillText(t('mme.map.zone.crit'), width - pad.right, height - pad.bottom + 28)
  g.textAlign = 'left'; g.fillText(t('mme.map.zone.supp'), pad.left, pad.top - 14)
  g.fillText(t('mme.map.zone.neutral'), pad.left, height - pad.bottom + 28)
  g.font = `11px ${font}`
  g.globalAlpha = 0.75 * frame
  g.fillText(t('mme.gov.avg', { v: `${Math.round(props.avg.c * 100)}%` }), ox + 6, pad.top + 4)
  g.textAlign = 'right'; g.fillText(t('mme.map.avg.supp', { v: `${Math.round(props.avg.s * 100)}%` }), width - pad.right, oy - 6)
  g.textAlign = 'left'

  // The outlets: from the point of all the articles to their places, the largest first.
  const amp = reduced.value ? 0 : 2.2
  if (px.length < props.points.length) { px = new Float32Array(props.points.length); py = new Float32Array(props.points.length) }
  const order = props.points.map((_, i) => i).sort((a, b) => props.points[b]!.n - props.points[a]!.n)
  const n = props.points.length
  const at = (i: number) => ease3((grown - 0.25 * (order.indexOf(i) / Math.max(1, n - 1))) / 0.75)
  props.points.forEach((p, i) => {
    const e = at(i)
    const cl = clouds.value[i]!
    px[i] = ox + (sx(p.c) - ox) * e + Math.cos(sec * cl.speed[0]! + cl.phase[0]!) * amp
    py[i] = oy + (sy(p.s) - oy) * e + Math.sin(sec * cl.speed[0]! + cl.phase[0]!) * amp
  })
  const curve = (x1: number, y1: number, x2: number, y2: number, bow: number) => {
    g.moveTo(x1, y1)
    g.quadraticCurveTo((x1 + x2) / 2 - (y2 - y1) * bow, (y1 + y2) / 2 + (x2 - x1) * bow, x2, y2)
  }
  // The threads of the groups.
  for (const [a, b] of threads.value) {
    const p = props.points[a]!
    const lit = litGroup !== null && p.group === litGroup
    g.strokeStyle = resolve(p.color)
    g.globalAlpha = (lit ? 0.35 + 0.4 * mix : 0.3 * back) * ease3((grown - 0.5) / 0.5)
    g.lineWidth = lit ? 1 + 0.6 * mix : 1
    g.beginPath(); curve(px[a]!, py[a]!, px[b]!, py[b]!, 0.18); g.stroke()
  }
  g.lineWidth = 1
  // The clouds: thin lines to the outlet, dots in the colors of the stance with a rim of the page's color.
  props.points.forEach((p, i) => {
    const cl = clouds.value[i]!
    const lit = i === litLast && mix > 0.01
    const fade = lit ? 1 : litGroup !== null && p.group === litGroup ? 1 - 0.3 * mix : back
    const e = ease3((at(i) - 0.35) / 0.65)
    if (e <= 0) return
    const dot = (j: number) => {
      const a = sec * cl.speed[j + 1]! + cl.phase[j + 1]!
      return [px[i]! + (cl.dx[j]! + Math.cos(a) * amp * 1.4) * e, py[i]! + (cl.dy[j]! + Math.sin(a) * amp * 1.4) * e] as const
    }
    g.strokeStyle = resolve(p.color)
    g.globalAlpha = 0.4 * fade * e
    g.beginPath()
    for (let j = 0; j < cl.kind.length; j++) {
      const [x, y] = dot(j)
      const [fx, fy] = cl.link[j]! < 0 ? [px[i]!, py[i]!] : dot(cl.link[j]!)
      curve(fx, fy, x, y, cl.bow[j]!)
    }
    g.stroke()
    for (let j = 0; j < cl.kind.length; j++) {
      const [x, y] = dot(j)
      const r = lit ? 2.6 + 0.6 * mix : 2.4
      g.globalAlpha = e
      g.fillStyle = paper
      g.beginPath(); g.arc(x, y, r + 0.9, 0, TAU); g.fill()
      g.fillStyle = stance[cl.kind[j]!]!
      g.globalAlpha = (0.85 * fade + 0.15) * e
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
    }
  })
  // The nodes of the outlets, the smallest last so they stay in view.
  for (const i of order) {
    const p = props.points[i]!
    const r = radius(p) * (0.4 + 0.6 * at(i))
    const lit = i === litLast && mix > 0.01
    g.globalAlpha = 1
    g.fillStyle = paper
    g.beginPath(); g.arc(px[i]!, py[i]!, r + 1.8, 0, TAU); g.fill()
    g.fillStyle = resolve(p.color)
    g.globalAlpha = lit ? 1 : litGroup !== null && p.group === litGroup ? 1 : 0.35 + 0.65 * back
    g.beginPath(); g.arc(px[i]!, py[i]!, r, 0, TAU); g.fill()
    if (lit) {
      g.strokeStyle = ink
      g.globalAlpha = 0.85 * mix
      g.lineWidth = 1.2
      g.beginPath(); g.arc(px[i]!, py[i]!, r + 4.5, 0, TAU); g.stroke()
      g.lineWidth = 1
    }
  }
  // The names, where they fit, once the outlets have arrived.
  const named = ease3((grown - 0.7) / 0.3)
  if (named > 0) {
    g.font = `11px ${font}`
    g.lineJoin = 'round'
    g.lineWidth = 3.5
    g.textAlign = 'left'
    for (const l of labels.value) {
      const i = props.points.findIndex(p => p.name === l.name)
      const p = props.points[i]!
      const ddx = px[i]! - sx(p.c)
      const ddy = py[i]! - sy(p.s)
      const fade = i === litLast ? 1 : litGroup !== null && p.group === litGroup ? 1 : back
      g.globalAlpha = 0.9 * named * fade
      g.strokeStyle = paper
      g.strokeText(l.name, l.x + ddx, l.y + ddy)
      g.fillStyle = i === litLast && mix > 0.5 ? ink : mute
      g.globalAlpha = named * fade
      g.fillText(l.name, l.x + ddx, l.y + ddy)
    }
  }
  g.globalAlpha = 1
}

const resize = () => {
  const el = canvas.value
  const holder = box.value
  if (!el || !holder) return
  const rect = holder.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = rect.width
  height = rect.height
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  ctx = el.getContext('2d')
  size.value = { w: width, h: height }
  draw(performance.now() / 1000, 0.016)
}
const nodeAt = (x: number, y: number) => {
  let best = -1
  let bestD = Infinity
  props.points.forEach((p, i) => {
    const d = Math.hypot(px[i]! - x, py[i]! - y) - radius(p)
    if (d < 8 && d < bestD) { bestD = d; best = i }
  })
  return best
}
const onMove = (e: PointerEvent) => {
  const rect = canvas.value!.getBoundingClientRect()
  hover = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
  if (canvas.value) canvas.value.style.cursor = hover >= 0 ? 'pointer' : ''
  if (hover < 0) { tooltip.hide(); return }
  const p = props.points[hover]!
  tooltip.show({
    title: p.name,
    rows: [
      { label: t('stance.critical'), value: fmtPct(p.c), color: stance[0] },
      { label: t('stance.neutral'), value: fmtPct(p.u), color: stance[1] },
      { label: t('stance.supportive'), value: fmtPct(p.s), color: stance[2] },
      { label: t('home.field.articles'), value: fmtInt(p.n) }
    ],
    field: true
  }, e)
}
const onLeave = () => { hover = -1; tooltip.hide() }
const onClick = () => { if (hover >= 0) { tooltip.hide(); navigateTo(outletHref(props.points[hover]!.slug)) } }

onMounted(() => {
  readTokens()
  const watcher = new ResizeObserver(resize)
  if (box.value) watcher.observe(box.value)
  onBeforeUnmount(() => { watcher.disconnect(); tooltip.hide() })
  resize()
})
watch(() => prefs.theme, async () => { await nextTick(); readTokens() })
const loop = useRafFn(({ timestamp }) => {
  const now = timestamp / 1000
  draw(now, Math.min(0.1, last ? now - last : 0.016))
  last = now
}, { immediate: false })
watch(() => [props.active, reduced.value] as const, ([on, still]) => {
  last = 0
  if (on && growAt < 0 && !still) growAt = performance.now()
  if (on && !still) loop.resume()
  else { loop.pause(); draw(performance.now() / 1000, 0.016) }
}, { immediate: true })
// A new period: the web grows again.
watch(() => props.points, () => { if (props.active && !reduced.value) growAt = performance.now(); if (!loop.isActive.value) draw(performance.now() / 1000, 0.016) })
useEventListener(document, 'visibilitychange', () => { if (document.hidden) loop.pause(); else if (props.active && !reduced.value) loop.resume() })
onBeforeUnmount(() => loop.pause())
</script>

<template>
  <div ref="box" class="plegma-day">
    <canvas ref="canvas" class="plegma-day-canvas" role="img" :aria-label="caption" @pointermove="onMove" @pointerleave="onLeave" @click="onClick" />
    <div class="visually-hidden">
      <table>
        <caption>{{ caption }}</caption>
        <tbody><tr v-for="p in points" :key="p.name"><th scope="row">{{ p.name }}</th><td>{{ t('mme.map.point', { name: p.name, c: fmtPct(p.c), u: fmtPct(p.u), s: fmtPct(p.s), n: fmtInt(p.n) }) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
