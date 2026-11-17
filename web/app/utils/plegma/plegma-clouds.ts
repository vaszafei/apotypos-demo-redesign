import { mulberry } from './plegma-world.ts'

// The web of the articles of an outlet grouped by day: one loose cloud for each day with articles, as large as the articles of the day, the clouds spread over a disc of radius 1 in no order
// (a day is not next to the day after it). Inside a cloud each node is joined to the one before it; the first node of a cloud is joined to the first node of the nearest cloud before it.
// `counts` are the nodes of each day with articles (at least 1).
export interface PlegmaCloudWeb {
  n: number
  x: Float32Array
  y: Float32Array
  phase: Float32Array
  speed: Float32Array
  reach: Float32Array
  edges: Uint32Array
  bow: Float32Array
  // The distance between two neighbours on the unit disc.
  gap: number
  // The cloud (the place of its day in `counts`) of each node.
  cloud: Uint16Array
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export const cloudWeb = (counts: number[], seed: number): PlegmaCloudWeb => {
  const rand = mulberry(seed * 13 + 5)
  const days = counts.length
  const total = counts.reduce((a, b) => a + b, 0)
  // Dots fill about half the disc: that fixes the distance of two neighbours and the radius of a cloud.
  const gap = Math.sqrt((Math.PI * 0.5) / Math.max(total, 1))
  const rho = counts.map(c => 0.55 * gap * Math.sqrt(c) + 0.5 * gap)
  // The clouds go to the places of a sunflower in an order that keeps days apart from the days beside them, then are pushed apart until none touches another or the rim.
  const order = counts.map((_, k) => k).sort((a, b) => ((a * 0.6180339887) % 1) - ((b * 0.6180339887) % 1))
  const cx = new Float32Array(days)
  const cy = new Float32Array(days)
  order.forEach((k, place) => {
    const r = Math.sqrt((place + 0.5) / days) * 0.8
    cx[k] = Math.cos(place * GOLDEN) * r
    cy[k] = Math.sin(place * GOLDEN) * r
  })
  for (let pass = 0; pass < 120; pass++) {
    for (let a = 0; a < days; a++) {
      for (let b = a + 1; b < days; b++) {
        const dx = cx[b]! - cx[a]!
        const dy = cy[b]! - cy[a]!
        const d = Math.hypot(dx, dy) || 1e-4
        const need = rho[a]! + rho[b]! + gap * 0.6
        if (d < need) {
          const push = (need - d) / 2
          cx[a] = cx[a]! - (dx / d) * push; cy[a] = cy[a]! - (dy / d) * push
          cx[b] = cx[b]! + (dx / d) * push; cy[b] = cy[b]! + (dy / d) * push
        }
      }
    }
    for (let a = 0; a < days; a++) {
      const d = Math.hypot(cx[a]!, cy[a]!)
      const room = 0.97 - rho[a]!
      if (d > room && d > 0) { cx[a] = (cx[a]! / d) * room; cy[a] = (cy[a]! / d) * room }
    }
  }
  const x = new Float32Array(total)
  const y = new Float32Array(total)
  const phase = new Float32Array(total)
  const speed = new Float32Array(total)
  const reach = new Float32Array(total)
  const cloud = new Uint16Array(total)
  const pairs: number[] = []
  const bows: number[] = []
  const firstOf: number[] = []
  let at = 0
  for (let k = 0; k < days; k++) {
    const c = counts[k]!
    firstOf.push(at)
    for (let j = 0; j < c; j++) {
      const i = at + j
      const r = c === 1 ? 0 : rho[k]! * Math.sqrt((j + 0.5) / c)
      const a = j * GOLDEN + k
      x[i] = cx[k]! + Math.cos(a) * r + (rand() - 0.5) * gap * 0.35
      y[i] = cy[k]! + Math.sin(a) * r + (rand() - 0.5) * gap * 0.35
      phase[i] = rand() * Math.PI * 2
      speed[i] = (0.22 + rand() * 0.55) * (rand() < 0.5 ? -1 : 1)
      reach[i] = 0.55 + rand() * 0.9
      cloud[i] = k
      if (j > 0) { pairs.push(i, i - 1); bows.push((rand() - 0.5) * 0.6) }
      if (j > 1 && rand() < 0.3) { pairs.push(i, at + Math.floor(rand() * (j - 1))); bows.push((rand() - 0.5) * 0.6) }
    }
    // The cloud is joined to the nearest cloud before it.
    if (k > 0) {
      let best = 0
      let bestD = Infinity
      for (let p = 0; p < k; p++) {
        const d = Math.hypot(cx[p]! - cx[k]!, cy[p]! - cy[k]!)
        if (d < bestD) { bestD = d; best = p }
      }
      pairs.push(at, firstOf[best]!)
      bows.push((rand() - 0.5) * 0.5)
    }
    at += c
  }
  return { n: total, x, y, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows), gap, cloud }
}
