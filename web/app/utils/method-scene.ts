// The animations of Home's «Μεθοδολογία» (components/home/MethodScene.vue): one cloud of dots goes through the three steps, in the dots and webs of the Plegma.
// Row 0 collects the articles and cleans them, row 1 gives them a theme and joins them into stories, row 2 checks a sample. `u` runs 0 to 1 inside a row; a row starts from where the one before ended.
export interface MethodPalette { ink: string, mute: string, groups: string[], themes: string[], agree: string, differ: string }
export interface MethodLabels { themes: string[], judgeA: string, judgeB: string, score: string, agreement: string }
interface Item { i: number, o: number, k: number, h: number, kind: 'ok' | 'dup' | 'junk', ta: number, size: number, p1: P, p3: P, p4: P, partner?: Item, sample: boolean, ok: boolean }
type P = [number, number]
interface Spot { p: P, alpha: number, scale: number, slot: number, sample?: boolean, ok?: boolean }

const GRAY = 'rgba(95,93,86,.8)'
const rngOf = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const seg = (u: number, a: number, b: number) => ease((u - a) / (b - a))
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

const build = () => {
  const r = rngOf(11)
  const gauss = () => (r() + r() + r() + r() - 2) / 0.58
  const outlets = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 + r() * 0.2
    const rad = 0.62 + r() * 0.22
    return { p: [Math.cos(a) * rad * 1.2, Math.sin(a) * rad * 0.95] as P, slot: [1, 2, 3, 4, 5, 6, 7, 8, 0][Math.floor(r() * 9)]! }
  })
  const centers = Array.from({ length: 8 }, (_, k): P => { const a = (k / 8) * Math.PI * 2 - Math.PI / 2 + 0.2; return [Math.cos(a) * 0.34 * 1.25, Math.sin(a) * 0.34] })
  const hubs = centers.map(c => Array.from({ length: 3 }, (): P => [c[0] + gauss() * 0.045, c[1] + gauss() * 0.045]))
  const items: Item[] = Array.from({ length: 230 }, (_, i) => {
    const o = Math.floor(r() * outlets.length)
    const k = Math.floor(r() * 8)
    const h = Math.floor(r() * 3)
    const kind = r() < 0.12 ? 'dup' : r() < 0.09 ? 'junk' : 'ok'
    const hub = hubs[k]![h]!
    const ang = r() * 6.283
    const rad = 0.02 + r() * 0.07
    return {
      i, o, k, h, kind, ta: r() * 0.78, size: 1.8 + r() * 1.8, sample: false, ok: true,
      p1: [gauss() * 0.14 * 1.2, gauss() * 0.14],
      p3: [centers[k]![0] + gauss() * 0.06, centers[k]![1] + gauss() * 0.06],
      p4: [hub[0] + Math.cos(ang) * rad, hub[1] + Math.sin(ang) * rad]
    }
  })
  const oks = items.filter(x => x.kind === 'ok')
  items.forEach((x) => { if (x.kind === 'dup') x.partner = oks[Math.floor(r() * oks.length)] })
  oks.slice(0, 220).forEach((x, n) => { if (n % 15 === 0) { x.sample = true; x.ok = r() > 0.16 } })
  return { outlets, centers, hubs, items }
}
const scene = build()

// The loop of every row: it plays for most of the cycle, holds the end, then the canvas fades (the component does it).
export const METHOD_LOOP_PLAY = 0.86

const drawStep = (ctx: CanvasRenderingContext2D, W: number, H: number, step: number, u: number, pal: MethodPalette, labels: MethodLabels) => {
  const { ink, mute } = pal
  const S = scene
  ctx.clearRect(0, 0, W, H)
  const K = Math.min(W / 2.3, H / 1.3)
  const cx = W / 2
  const cy = H / 2
  const X = (p: P): P => [cx + p[0] * K, cy + p[1] * K]
  ctx.lineCap = 'round'
  ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif'
  const dot = (x: number, y: number, r: number, color: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1 }

  if (step <= 1) {
    const a = step === 0 ? 1 : 1 - seg(u, 0.5, 1)
    S.outlets.forEach((o, i) => {
      const [x, y] = X(o.p)
      const pulse = step === 0 ? Math.max(0, 1 - Math.abs(((u * 3 + i / 24) % 1) - 0.1) * 6) : 0
      dot(x, y, 3.6 + pulse * 3, pal.groups[o.slot]!, a)
    })
  }
  const spotOf = (it: Item): Spot | null => {
    if (step === 0) {
      if (u < it.ta) return null
      return { p: lerp(S.outlets[it.o]!.p, it.p1, seg(u, it.ta, it.ta + 0.2)), alpha: Math.min(1, (u - it.ta) * 12) * 0.5, scale: 1, slot: 0 }
    }
    if (step === 1) {
      const sweep = u * 1.25 - 0.1
      const d = ((Math.atan2(it.p1[1], it.p1[0]) + Math.PI / 2 + 6.283) % 6.283) / 6.283
      const light = d > sweep
      const m = seg(sweep - d, 0, 0.3)
      let p = it.p1
      let alpha = 1
      let scale = 1
      if (!light && it.kind === 'dup') { p = lerp(it.p1, it.partner!.p1, m); scale = 1 - m }
      if (!light && it.kind === 'junk') { alpha = 1 - m; scale = 1 + m * 0.5 }
      if (it.kind === 'dup' && !light && scale < 0.05) return null
      return { p, alpha: light ? 0.5 : alpha, scale, slot: 0 }
    }
    if (it.kind !== 'ok') return null
    if (step === 2) {
      const t = seg(u, 0.05 + (it.i % 20) * 0.006, 0.7)
      const w = seg(u, 0.1 + it.k * 0.04, 0.4 + it.k * 0.04)
      return { p: lerp(it.p1, it.p3, t), alpha: 1, scale: 1, slot: w > 0.5 ? it.k + 1 : 0 }
    }
    if (step === 3) return { p: lerp(it.p3, it.p4, seg(u, 0.05, 0.55)), alpha: 1, scale: 1, slot: it.k + 1 }
    return { p: it.p4, alpha: it.sample ? 1 : 0.45, scale: it.sample ? 1.25 : 1, slot: it.k + 1, sample: it.sample, ok: it.ok }
  }
  const pts = S.items.map(it => ({ it, s: spotOf(it) })).filter((x): x is { it: Item, s: Spot } => x.s !== null)
  const color = (slot: number) => (slot ? pal.themes[slot - 1]! : GRAY)
  if (step === 1) {
    const sweep = u * 1.25 - 0.1
    const a = -Math.PI / 2 + sweep * 6.283
    if (sweep > 0 && sweep < 1) { ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * K * 0.5, cy + Math.sin(a) * K * 0.42); ctx.stroke(); ctx.globalAlpha = 1 }
  }
  if (step >= 3) {
    const grow = step === 3 ? seg(u, 0.35, 0.95) : 1
    ctx.lineWidth = 0.8
    pts.forEach(({ it, s }) => {
      const a = X(S.hubs[it.k]![it.h]!)
      const b = X(s.p)
      const m = lerp(a, b, grow)
      ctx.strokeStyle = pal.themes[it.k]!; ctx.globalAlpha = step === 3 ? 0.55 : 0.35
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(m[0], m[1]); ctx.stroke(); ctx.globalAlpha = 1
    })
    S.hubs.forEach((hs, k) => hs.forEach((h, j) => { const [x, y] = X(h); dot(x, y, 4 + ((k + j) % 3) * 1.6, pal.themes[k]!, grow) }))
  }
  const sampled = pts.filter(q => q.s.sample)
  pts.forEach(({ it, s }) => {
    const [x, y] = X(s.p)
    const r = it.size * s.scale * (s.sample ? 1.5 : 1)
    if (s.sample && step === 4) {
      const m = seg(u, 0.45, 0.8)
      if (m * 1.2 > sampled.findIndex(q => q.it === it) / 14) dot(x, y, r + 5, s.ok ? pal.agree : pal.differ, 0.35)
    }
    dot(x, y, r, color(s.slot), s.alpha)
  })
  if (step === 2 && u > 0.55) {
    ctx.globalAlpha = seg(u, 0.55, 0.8); ctx.fillStyle = ink; ctx.textBaseline = 'middle'
    S.centers.forEach((c, k) => {
      let [x, y] = X([c[0] * 1.35, c[1] * 1.4])
      ctx.textAlign = c[0] > 0.1 ? 'left' : c[0] < -0.1 ? 'right' : 'center'
      const text = labels.themes[k] ?? ''
      const tw = ctx.measureText(text).width
      if (ctx.textAlign === 'left') x = Math.min(x, W - tw)
      else if (ctx.textAlign === 'right') x = Math.max(x, tw)
      else x = Math.min(Math.max(x, tw / 2), W - tw / 2)
      ctx.fillText(text, x, y)
    })
    ctx.globalAlpha = 1
  }
  if (step === 4) {
    const f = seg(u, 0.1, 0.5)
    const judges = ([[-0.55, 0.5], [0.55, 0.5]] as P[]).map(X)
    sampled.forEach(({ s }) => {
      const [x, y] = X(s.p)
      judges.forEach((j) => { ctx.strokeStyle = 'rgba(95,93,86,.3)'; ctx.lineWidth = 0.8; ctx.globalAlpha = f; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(j[0], j[1]); ctx.stroke(); ctx.globalAlpha = 1 })
    })
    judges.forEach((j, n) => { dot(j[0], j[1], 8, ink, f); ctx.globalAlpha = f; ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(n ? labels.judgeB : labels.judgeA, j[0], j[1] + 13); ctx.globalAlpha = 1 })
    if (u > 0.7) {
      ctx.globalAlpha = seg(u, 0.7, 0.9); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '600 26px "IBM Plex Sans", system-ui, sans-serif'; ctx.fillText(labels.score, cx, cy + K * 0.46)
      ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif'; ctx.fillStyle = mute; ctx.fillText(labels.agreement, cx, cy + K * 0.46 + 20); ctx.globalAlpha = 1
    }
  }
}

export const drawMethodRow = (ctx: CanvasRenderingContext2D, W: number, H: number, row: number, u: number, pal: MethodPalette, labels: MethodLabels) => {
  if (row === 0) return u < 0.55 ? drawStep(ctx, W, H, 0, u / 0.55, pal, labels) : drawStep(ctx, W, H, 1, (u - 0.55) / 0.45, pal, labels)
  if (row === 1) return u < 0.5 ? drawStep(ctx, W, H, 2, u / 0.5, pal, labels) : drawStep(ctx, W, H, 3, (u - 0.5) / 0.5, pal, labels)
  return drawStep(ctx, W, H, 4, u, pal, labels)
}
