<script setup lang="ts">
import { useElementSize, useMediaQuery, useRafFn } from '@vueuse/core'
import { PLEGMA_NODES_MAX } from '~/utils/plegma/plegma-articles'
import { cloudWeb } from '~/utils/plegma/plegma-clouds'
import { shareArcs } from '~/utils/plegma/stage/stage-draw-util'

// The web of the outlet's articles on Επισκόπηση: one node for each article, or for several when there are many (each node then stands for `perNode` articles), in a loose cloud for each day
// (utils/plegma/plegma-clouds.ts), as large as the articles of the day. No date is written. Around it is the ring of the stance towards
// the government: an arc each for critical, neutral and supportive, as wide as their share, with the name and the share written outside it.
const props = defineProps<{ days: number[], colorSlot: number, stance: number[], label: string }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const TAU = Math.PI * 2
const STANCES = ['critical', 'neutral', 'supportive']

const box = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const { width, height } = useElementSize(box)

const total = computed(() => props.days.reduce((a, n) => a + n, 0))
const perNode = computed(() => (total.value ? Math.ceil(total.value / Math.min(total.value, PLEGMA_NODES_MAX)) : 1))
// A cloud for each day with articles: a node for each `perNode` articles of the day (at least one).
const web = computed(() => {
  const counts = props.days.filter(n => n > 0).map(n => Math.max(1, Math.round(n / perNode.value)))
  return counts.length ? cloudWeb(counts, 7 + total.value) : null
})
const ringArcs = computed(() => shareArcs(props.stance))

let ink = '#111'
let mute = '#6b6f78'
let paper = '#f6f4ef'
let fontText = 'system-ui, sans-serif'
let dot = '#888'
let stanceInk: string[] = []
const readTokens = () => {
  const style = getComputedStyle(document.documentElement)
  ink = style.getPropertyValue('--ink').trim() || ink
  mute = style.getPropertyValue('--text-secondary').trim() || mute
  paper = style.getPropertyValue('--surface-page').trim() || paper
  fontText = style.getPropertyValue('--font-text').trim() || fontText
  dot = style.getPropertyValue(`--cat-${props.colorSlot}`).trim() || mute
  stanceInk = STANCES.map(k => style.getPropertyValue(`--stance-${k}`).trim() || mute)
}

// Where the nodes are on the screen now (for the pointer), set by each draw.
let px = new Float32Array(0)
let py = new Float32Array(0)
let nodeR = 3
let startedAt = 0
const ease = (v: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3)

const draw = (now: number) => {
  const el = canvas.value
  const w = width.value
  const h = height.value
  const aw = web.value
  if (!el || !w || !h) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr) }
  const g = el.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  if (!aw) return
  const sec = reduced.value ? 0 : now / 1000
  const grow = reduced.value ? 1 : ease((now - startedAt) / 1100)
  // The web is an ellipse, wider than tall, up to 1.6; the room for the names of the ring is at its two sides.
  const kx = Math.min(1.6, Math.max(1, (w - 340) / Math.max(1, h - 40)))
  const R = Math.max(40, Math.min((h - 44) / 2.4, (w - 340) / (2 * kx * 1.2)))
  const cx = w / 2
  const cy = h / 2 - 8
  const ringR = (R * 1.2 + 6) * grow
  const spacing = aw.gap * R
  const amp = Math.min(3.2, Math.max(0.8, spacing * 0.2))
  nodeR = Math.min(4.6, Math.max(1.6, spacing * 0.27))
  if (px.length < aw.n) { px = new Float32Array(aw.n); py = new Float32Array(aw.n) }
  for (let i = 0; i < aw.n; i++) {
    const a = sec * aw.speed[i]! + aw.phase[i]!
    const reach = aw.reach[i]!
    px[i] = cx + aw.x[i]! * R * kx * grow + Math.cos(a) * amp * reach
    py[i] = cy + aw.y[i]! * R * grow + Math.sin(a) * amp * reach
  }
  g.lineCap = 'round'
  g.strokeStyle = mute
  g.globalAlpha = 0.45
  g.lineWidth = 0.8
  g.beginPath()
  for (let e = 0; e < aw.edges.length; e += 2) {
    const i = aw.edges[e]!
    const j = aw.edges[e + 1]!
    const dx = px[j]! - px[i]!
    const dy = py[j]! - py[i]!
    const bow = aw.bow[e / 2]!
    g.moveTo(px[i]!, py[i]!)
    g.quadraticCurveTo((px[i]! + px[j]!) / 2 - dy * bow, (py[i]! + py[j]!) / 2 + dx * bow, px[j]!, py[j]!)
  }
  g.stroke()
  g.globalAlpha = 1
  g.lineWidth = 1.3
  g.strokeStyle = dot
  g.fillStyle = paper
  for (let i = 0; i < aw.n; i++) {
    g.beginPath()
    g.arc(px[i]!, py[i]!, nodeR, 0, TAU)
    g.globalAlpha = 0.55
    g.fill()
    g.globalAlpha = 1
    g.stroke()
  }
  // The ring of the stance and its names. An angle runs from the top, clockwise.
  const arcs = ringArcs.value
  if (!arcs) return
  const counts = props.stance
  const sum = counts.reduce((a, b) => a + b, 0)
  g.lineWidth = 2.4
  g.font = `12px ${fontText}`
  g.textBaseline = 'middle'
  STANCES.forEach((key, k) => {
    const from = arcs[k * 2]!
    const span = arcs[k * 2 + 1]!
    if (span <= 0) return
    g.strokeStyle = stanceInk[k] ?? mute
    g.beginPath()
    g.ellipse(cx, cy, ringR * kx, ringR, 0, from - Math.PI / 2, from + span - Math.PI / 2)
    g.stroke()
    const mid = from + span / 2
    const lx = cx + Math.sin(mid) * (ringR * kx + 12)
    const ly = cy - Math.cos(mid) * (ringR + 12)
    const text = `${t(`stance.${key}`)} · ${fmtPct(counts[k]! / sum)}`
    g.textAlign = Math.sin(mid) >= 0 ? 'left' : 'right'
    g.fillStyle = ink
    g.fillText(text, lx + (Math.sin(mid) >= 0 ? 6 : -6), ly)
  })
}

const { pause, resume } = useRafFn(({ timestamp }) => draw(timestamp), { immediate: false })
onMounted(() => { readTokens(); startedAt = performance.now(); resume() })
onBeforeUnmount(() => { pause(); tooltip.hide() })
watch(() => [props.colorSlot, total.value], () => { readTokens(); startedAt = performance.now() })
watch(reduced, v => { if (v) draw(performance.now()) })

const onMove = (e: PointerEvent) => {
  const r = canvas.value!.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  let best = -1
  let bestD = (nodeR + 5) ** 2
  for (let i = 0; i < (web.value?.n ?? 0); i++) {
    const d = (px[i]! - x) ** 2 + (py[i]! - y) ** 2
    if (d < bestD) { bestD = d; best = i }
  }
  if (best < 0) { tooltip.hide(); return }
  tooltip.show({ title: perNode.value > 1 ? t('outlet.web.dots', { n: fmtInt(perNode.value) }) : t('outlet.web.dot') }, e)
}
</script>

<template>
  <div ref="box" class="outlet-article-web">
    <canvas ref="canvas" role="img" :aria-label="label" @pointermove="onMove" @pointerleave="tooltip.hide()" />
  </div>
</template>
