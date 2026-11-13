<script setup lang="ts">
import { useEventListener, useMediaQuery, useRafFn } from '@vueuse/core'
import { placeLabels } from '~/utils/stance-labels'
import { mulberry } from '~/utils/plegma-world'

// Μέσα › Στάση as a web of the Plegma (the stance map of media-v2.html, drawn over the dim world): each outlet is a node at its critical share (to the right) and its supportive share
// (up), in the color of its group and as large as its articles. Thin curved threads join the outlets of one group. The three zones are where one share is the largest: thin
// threads from the point where the three are a third each, with a flat tint of the stance color in each zone (as in the HTML map) that fades at the edge of the plot, and the name of each zone in its corner; the dashed threads are the shares of all the articles.
// Every outlet has a series over time (one value for each step of the player under the web) and `at` is the place in it, in steps: the outlets glide to it, and an outlet without enough articles
// at a step fades out. The axes are those of the whole series, so the zones stay where they are while the outlets move.
// It grows out of the point of all the articles when it comes into view, and drifts slowly. An outlet pointed at comes forward with the threads of its group; a click opens it.
export interface StanceSeries { name: string, slug: string, group: string | null, color: string, c: number[], u: number[], s: number[], n: number[] }
const props = defineProps<{ series: StanceSeries[], avgs: { c: number, s: number }[], at: number, active: boolean, caption: string }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const prefs = usePrefsStore()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const TAU = Math.PI * 2
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const lerp = (a: number, b: number, w: number) => a + (b - a) * w
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

// The plot: the axes start and end near the data of every step, so the outlets spread over the area; a margin leaves room for the names.
const pad = { top: 34, right: 40, bottom: 44, left: 40 }
const lastStep = computed(() => Math.max(0, props.avgs.length - 1))
const shown = computed(() => props.series.flatMap(o => o.n.map((n, f) => (n > 0 ? { c: o.c[f]!, s: o.s[f]!, n } : null)).filter(p => p !== null)))
const ext = computed(() => {
  const cs = shown.value.map(p => p.c)
  const ss = shown.value.map(p => p.s)
  return {
    x0: Math.max(0, Math.min(...cs) - 0.05), x1: Math.min(1, Math.max(...cs) + 0.05),
    y0: Math.max(0, Math.min(...ss) - 0.04), y1: Math.min(1, Math.max(...ss) + 0.05)
  }
})
const sx = (c: number) => pad.left + ((c - ext.value.x0) / (ext.value.x1 - ext.value.x0)) * (width - pad.left - pad.right)
const sy = (s: number) => height - pad.bottom - ((s - ext.value.y0) / (ext.value.y1 - ext.value.y0)) * (height - pad.top - pad.bottom)
const maxN = computed(() => Math.max(1, ...shown.value.map(p => p.n)))
const radius = (n: number) => 4 + 9 * Math.sqrt(n / maxN.value)

// An outlet at a place of its series: between two steps its shares and articles are the mix of the two; an outlet present at one of them only is the one, fading in or out.
interface Cur { c: number, u: number, s: number, n: number, vis: number }
const cur: Cur[] = []
const sample = (i: number, at: number) => {
  const o = props.series[i]!
  const a = clamp(Math.floor(at), 0, lastStep.value)
  const b = Math.min(lastStep.value, a + 1)
  const w = clamp(at - a, 0, 1)
  const out = (cur[i] ??= { c: 0, u: 0, s: 0, n: 0, vis: 0 })
  const ha = o.n[a]! > 0
  const hb = o.n[b]! > 0
  if (ha && hb) {
    out.c = lerp(o.c[a]!, o.c[b]!, w); out.u = lerp(o.u[a]!, o.u[b]!, w); out.s = lerp(o.s[a]!, o.s[b]!, w); out.n = lerp(o.n[a]!, o.n[b]!, w); out.vis = 1
  } else if (ha || hb) {
    const k = ha ? a : b
    out.c = o.c[k]!; out.u = o.u[k]!; out.s = o.s[k]!; out.n = o.n[k]!; out.vis = ha ? 1 - w : w
  } else {
    out.c = 0; out.u = 0; out.s = 0; out.n = 0; out.vis = 0
  }
  return out
}
// The slow drift of each outlet: a phase and a speed seeded by its name, so they keep across frames.
const drift = computed(() => props.series.map((p) => {
  const rand = mulberry([...p.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 11))
  return { phase: rand() * TAU, speed: (0.25 + rand() * 0.5) * (rand() < 0.5 ? -1 : 1) }
}))
// The threads of a group: each outlet to the next one of its group, the largest first.
const threads = computed(() => {
  const by = new Map<string, number[]>()
  props.series.forEach((p, i) => { if (p.group) by.set(p.group, [...by.get(p.group) ?? [], i]) })
  const total = (i: number) => props.series[i]!.n.reduce((x, y) => x + y, 0)
  const out: [number, number][] = []
  for (const list of by.values()) {
    const order = list.slice().sort((a, b) => total(b) - total(a))
    for (let k = 1; k < order.length; k++) out.push([order[k - 1]!, order[k]!])
  }
  return out
})
// The names are placed for one step at a time (and kept), and follow their dot between two steps.
let labelCache = new Map<number, { name: string, x: number, y: number, i: number }[]>()
const labelsAt = (f: number) => {
  let list = labelCache.get(f)
  if (!list) {
    const idx = props.series.map((_, i) => i).filter(i => props.series[i]!.n[f]! > 0)
    const dots = idx.map(i => ({ name: props.series[i]!.name, n: props.series[i]!.n[f]!, x: sx(props.series[i]!.c[f]!), y: sy(props.series[i]!.s[f]!), r: radius(props.series[i]!.n[f]!) + 10 }))
    const where = new Map(idx.map(i => [props.series[i]!.name, i]))
    list = placeLabels(dots, [], { x0: 0, x1: width, y0: 0, y1: height }).map(l => ({ name: l.name, x: l.x, y: l.y, i: where.get(l.name)! }))
    labelCache.set(f, list)
  }
  return list
}

// The tints of the three zones, drawn once on their own layer (they only change with the size and the axes): flat inside the plot, fading out over 40px across its edge.
let zoneLayer: HTMLCanvasElement | null = null
let zoneKey = ''
const buildZones = (dpr: number) => {
  const key = [width, height, dpr, ext.value.x0, ext.value.x1, ext.value.y0, ext.value.y1, ...stance].join('|')
  if (zoneLayer && key === zoneKey) return zoneLayer
  zoneKey = key
  zoneLayer ??= document.createElement('canvas')
  zoneLayer.width = Math.round(width * dpr)
  zoneLayer.height = Math.round(height * dpr)
  const z = zoneLayer.getContext('2d')!
  z.setTransform(dpr, 0, 0, dpr, 0, 0)
  z.clearRect(0, 0, width, height)
  const third = 1 / 3
  const zones: [number, [number, number][]][] = [
    [0, [[third, third], [0.5, 0], [1, 0], [0.5, 0.5]]],
    [2, [[third, third], [0, 0.5], [0, 1], [0.5, 0.5]]],
    [1, [[0, 0], [0.5, 0], [third, third], [0, 0.5]]]
  ]
  z.globalAlpha = 0.13
  for (const [k, pts] of zones) {
    z.fillStyle = stance[k]!
    z.beginPath()
    pts.forEach(([c, s], i) => (i ? z.lineTo(sx(c), sy(s)) : z.moveTo(sx(c), sy(s))))
    z.closePath(); z.fill()
  }
  z.globalAlpha = 1
  z.globalCompositeOperation = 'destination-out'
  // The ramp is 40px, centred on the edge of the plot, and everything past it is cleared.
  const ramp = 20
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const grad = z.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,1)')
    z.fillStyle = grad
    z.fillRect(rx, ry, rw, rh)
  }
  edge(pad.left + ramp, 0, pad.left - ramp, 0, 0, 0, pad.left + ramp, height)
  edge(width - pad.right - ramp, 0, width - pad.right + ramp, 0, width - pad.right - ramp, 0, pad.right + ramp, height)
  edge(0, pad.top + ramp, 0, pad.top - ramp, 0, 0, width, pad.top + ramp)
  edge(0, height - pad.bottom - ramp, 0, height - pad.bottom + ramp, 0, height - pad.bottom - ramp, width, pad.bottom + ramp)
  return zoneLayer
}

// The growth out of the point of all the articles.
const GROW_MS = 1600
let growAt = -1
let hover = -1
let mix = 0
let litLast = -1
let last = 0
let shownAt = -1
let px = new Float32Array(0)
let py = new Float32Array(0)
const ease3 = (k: number) => 1 - (1 - clamp(k, 0, 1)) ** 3

const draw = (sec: number, dt: number) => {
  const g = ctx
  const total = props.series.length
  if (!g || !width || !total) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // The place the outlets are at glides to the place asked for.
  if (shownAt < 0 || reduced.value) shownAt = props.at
  else shownAt += (props.at - shownAt) * (1 - Math.exp(-dt * 5))
  if (Math.abs(props.at - shownAt) < 0.002) shownAt = props.at
  const at0 = clamp(shownAt, 0, lastStep.value)
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, width, height)
  const grown = growAt < 0 ? (reduced.value ? 1 : 0) : clamp((performance.now() - growAt) / GROW_MS, 0, 1)
  const a = Math.floor(at0)
  const b = Math.min(lastStep.value, a + 1)
  const avg = { c: lerp(props.avgs[a]!.c, props.avgs[b]!.c, at0 - a), s: lerp(props.avgs[a]!.s, props.avgs[b]!.s, at0 - a) }
  for (let i = 0; i < total; i++) sample(i, at0)
  const ox = sx(avg.c)
  const oy = sy(avg.s)
  const third = 1 / 3
  mix = reduced.value ? (hover >= 0 ? 1 : 0) : mix + ((hover >= 0 ? 1 : 0) - mix) * (1 - Math.exp(-dt * 9))
  if (hover >= 0) litLast = hover
  const litGroup = litLast >= 0 ? props.series[litLast]!.group : null
  const back = 1 - 0.6 * mix
  const frame = ease3(grown / 0.6)

  g.globalAlpha = frame
  g.drawImage(buildZones(dpr), 0, 0, width, height)
  g.globalAlpha = 1

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
  g.fillText(t('mme.gov.avg', { v: `${Math.round(avg.c * 100)}%` }), ox + 6, pad.top + 4)
  g.textAlign = 'right'; g.fillText(t('mme.map.avg.supp', { v: `${Math.round(avg.s * 100)}%` }), width - pad.right, oy - 6)
  g.textAlign = 'left'

  // The outlets: from the point of all the articles to their places, the largest first.
  const amp = reduced.value ? 0 : 2.2
  if (px.length < total) { px = new Float32Array(total); py = new Float32Array(total) }
  const order = props.series.map((_, i) => i).sort((p, q) => cur[q]!.n - cur[p]!.n)
  const rank = new Map(order.map((i, k) => [i, k]))
  const at = (i: number) => ease3((grown - 0.25 * (rank.get(i)! / Math.max(1, total - 1))) / 0.75)
  props.series.forEach((_, i) => {
    const e = at(i)
    const d = drift.value[i]!
    px[i] = ox + (sx(cur[i]!.c) - ox) * e + Math.cos(sec * d.speed + d.phase) * amp
    py[i] = oy + (sy(cur[i]!.s) - oy) * e + Math.sin(sec * d.speed + d.phase) * amp
  })
  const curve = (x1: number, y1: number, x2: number, y2: number, bow: number) => {
    g.moveTo(x1, y1)
    g.quadraticCurveTo((x1 + x2) / 2 - (y2 - y1) * bow, (y1 + y2) / 2 + (x2 - x1) * bow, x2, y2)
  }
  // The threads of the groups.
  for (const [p, q] of threads.value) {
    const o = props.series[p]!
    const lit = litGroup !== null && o.group === litGroup
    g.strokeStyle = resolve(o.color)
    g.globalAlpha = (lit ? 0.35 + 0.4 * mix : 0.3 * back) * ease3((grown - 0.5) / 0.5) * Math.min(cur[p]!.vis, cur[q]!.vis)
    g.lineWidth = lit ? 1 + 0.6 * mix : 1
    g.beginPath(); curve(px[p]!, py[p]!, px[q]!, py[q]!, 0.18); g.stroke()
  }
  g.lineWidth = 1
  // The nodes of the outlets, the smallest last so they stay in view.
  for (const i of order) {
    const o = props.series[i]!
    const v = cur[i]!
    if (v.vis <= 0.01) continue
    const r = radius(v.n) * (0.4 + 0.6 * at(i)) * (0.5 + 0.5 * v.vis)
    const lit = i === litLast && mix > 0.01
    g.globalAlpha = v.vis
    g.fillStyle = paper
    g.beginPath(); g.arc(px[i]!, py[i]!, r + 1.8, 0, TAU); g.fill()
    g.fillStyle = resolve(o.color)
    g.globalAlpha = (lit ? 1 : litGroup !== null && o.group === litGroup ? 1 : 0.35 + 0.65 * back) * v.vis
    g.beginPath(); g.arc(px[i]!, py[i]!, r, 0, TAU); g.fill()
    if (lit) {
      g.strokeStyle = ink
      g.globalAlpha = 0.85 * mix * v.vis
      g.lineWidth = 1.2
      g.beginPath(); g.arc(px[i]!, py[i]!, r + 4.5, 0, TAU); g.stroke()
      g.lineWidth = 1
    }
  }
  // The names, where they fit, once the outlets have arrived.
  const named = ease3((grown - 0.7) / 0.3)
  if (named > 0) {
    const f = clamp(Math.round(at0), 0, lastStep.value)
    g.font = `11px ${font}`
    g.lineJoin = 'round'
    g.lineWidth = 3.5
    g.textAlign = 'left'
    for (const l of labelsAt(f)) {
      const i = l.i
      const o = props.series[i]!
      const v = cur[i]!
      if (v.vis <= 0.01) continue
      const ddx = px[i]! - sx(o.c[f]!)
      const ddy = py[i]! - sy(o.s[f]!)
      const fade = (i === litLast ? 1 : litGroup !== null && o.group === litGroup ? 1 : back) * v.vis
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
  labelCache = new Map()
  draw(performance.now() / 1000, 0.016)
}
const nodeAt = (x: number, y: number) => {
  let best = -1
  let bestD = Infinity
  props.series.forEach((_, i) => {
    const v = cur[i]
    if (!v || v.vis < 0.5) return
    const d = Math.hypot(px[i]! - x, py[i]! - y) - radius(v.n)
    if (d < 8 && d < bestD) { bestD = d; best = i }
  })
  return best
}
const onMove = (e: PointerEvent) => {
  const rect = canvas.value!.getBoundingClientRect()
  hover = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
  if (canvas.value) canvas.value.style.cursor = hover >= 0 ? 'pointer' : ''
  if (hover < 0) { tooltip.hide(); return }
  const v = cur[hover]!
  tooltip.show({
    title: props.series[hover]!.name,
    rows: [
      { label: t('stance.critical'), value: fmtPct(v.c), color: stance[0] },
      { label: t('stance.neutral'), value: fmtPct(v.u), color: stance[1] },
      { label: t('stance.supportive'), value: fmtPct(v.s), color: stance[2] },
      { label: t('home.field.articles'), value: fmtInt(Math.round(v.n)) }
    ],
    field: true
  }, e)
}
const onLeave = () => { hover = -1; tooltip.hide() }
const onClick = () => { if (hover >= 0) { tooltip.hide(); navigateTo(outletHref(props.series[hover]!.slug)) } }

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
// With the loop stopped (a still screen) a new place is drawn at once.
watch(() => props.at, () => { if (!loop.isActive.value) draw(performance.now() / 1000, 0.016) })
useEventListener(document, 'visibilitychange', () => { if (document.hidden) loop.pause(); else if (props.active && !reduced.value) loop.resume() })
onBeforeUnmount(() => loop.pause())
// The table for a screen reader: the outlets at the step the player is on.
const stepNow = computed(() => clamp(Math.round(props.at), 0, lastStep.value))
const rows = computed(() => props.series.filter(o => o.n[stepNow.value]! > 0).map(o => ({ name: o.name, text: t('mme.map.point', { name: o.name, c: fmtPct(o.c[stepNow.value]!), u: fmtPct(o.u[stepNow.value]!), s: fmtPct(o.s[stepNow.value]!), n: fmtInt(o.n[stepNow.value]!) }) })))
</script>

<template>
  <div ref="box" class="plegma-day">
    <canvas ref="canvas" class="plegma-day-canvas" role="img" :aria-label="caption" @pointermove="onMove" @pointerleave="onLeave" @click="onClick" />
    <div class="visually-hidden">
      <table>
        <caption>{{ caption }}</caption>
        <tbody><tr v-for="r in rows" :key="r.name"><th scope="row">{{ r.name }}</th><td>{{ r.text }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
