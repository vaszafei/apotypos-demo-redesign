// Αναλύσεις › ΟΗΕ as a screen of the Plegma: the 192 countries of the 81st General Assembly as dots, in the places of its hall and in the arrangements the tabs ask for.
// The numbers are the speeches (data/speeches.json). The seats are not data: the order is the UN's (English alphabetical, the first seat drawn by lot: Morocco), the rows, blocks and aisles are drawn.

export interface UnSpeech {
  vid: string, speaker: string, role: string, country: string, region: string, date: string, seconds: number, words: number, url?: string
  shares: [string, number][], counts: { claims: number, promises: number, attacks: number }, targets: [string, number][]
  greece: { n: number, tones: Record<string, number>, refers_to: string[] }
}
export interface UnData { rows: UnSpeech[] }

export const UN_REGIONS = ['North America', 'Europe', 'Middle East', 'Africa', 'Asia-Pacific', 'Latin America & Caribbean'] as const
const REGION_COLOR: Record<string, string> = {
  'North America': 'var(--cat-1)', 'Europe': 'var(--cat-3)', 'Middle East': 'var(--cat-2)', 'Africa': 'var(--cat-4)', 'Asia-Pacific': 'var(--cat-7)', 'Latin America & Caribbean': 'var(--cat-5)'
}
export const unRegionColor = (region: string) => REGION_COLOR[region] ?? 'var(--cat-0)'

export const UN_ISRAEL_TOPIC = 'Israel–Palestine'
// The topics that have a cluster of their own on the Θέματα tab, in this order; the other countries share the last cluster.
export const UN_CLUSTER_TOPICS = ['Domestic affairs', 'Russia-Ukraine War', 'UN & its reform', 'Climate Change', '*', 'Artificial Intelligence', UN_ISRAEL_TOPIC]
// A name of a target in the speeches that is another name of a country of the data.
const TARGET_ALIAS: Record<string, string> = { 'Russia': 'Russian Federation', 'United States': 'United States of America', 'Turkey': 'Türkiye' }
// The seat keys of the UN's alphabetical order where it uses the official name.
const SORT_KEY: Record<string, string> = { 'Tanzania': 'United Republic of Tanzania', 'Moldova': 'Republic of Moldova', 'Syria': 'Syrian Arab Republic' }
const OBSERVERS = ['State of Palestine', 'Holy See']
const FIRST_SEAT = 'Morocco'

export interface UnCountry {
  name: string, region: string, speaker: string
  // Seconds of speech, and the minutes of it on the Israel–Palestine topic (the shares of each speech times its seconds).
  seconds: number, israelMinutes: number
  // The topic most of its speeches are about.
  main: string
  // The attacks it made on Israel, and on each other country of the data (to, count).
  attacksOnIsrael: number, attacks: [string, number][]
  // Its words about Greece and Cyprus: the main tone and which of the two it named. null when it said nothing of them.
  greece: { tone: string, greece: boolean, cyprus: boolean } | null
}

export const unCountries = (rows: UnSpeech[]): UnCountry[] => {
  const by = new Map<string, { c: UnCountry, topics: Map<string, number>, out: Map<string, number> }>()
  for (const r of rows) {
    let e = by.get(r.country)
    if (!e) {
      e = { c: { name: r.country, region: r.region, speaker: r.speaker, seconds: 0, israelMinutes: 0, main: '', attacksOnIsrael: 0, attacks: [], greece: null }, topics: new Map(), out: new Map() }
      by.set(r.country, e)
    }
    e.c.seconds += r.seconds
    e.c.israelMinutes += (r.shares.find(s => s[0] === UN_ISRAEL_TOPIC)?.[1] ?? 0) * r.seconds / 60
    const main = r.shares[0]?.[0]
    if (main) e.topics.set(main, (e.topics.get(main) ?? 0) + 1)
    for (const [target, n] of r.targets) {
      if (/^Israel/.test(target)) e.c.attacksOnIsrael += n
      const to = TARGET_ALIAS[target] ?? target
      if (to !== r.country) e.out.set(to, (e.out.get(to) ?? 0) + n)
    }
    if (r.greece.n > 0) {
      const tone = Object.entries(r.greece.tones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral'
      e.c.greece = { tone, greece: r.greece.refers_to.includes('Greece'), cyprus: r.greece.refers_to.includes('Cyprus') }
    }
  }
  const names = new Set(by.keys())
  return [...by.values()].map(({ c, topics, out }) => ({
    ...c,
    israelMinutes: Number(c.israelMinutes.toFixed(2)),
    main: [...topics].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
    // Only a target that sits in the hall can be drawn.
    attacks: [...out].filter(([to]) => names.has(to))
  }))
}

// A seeded generator (the same dots in the same places each time).
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

// The plan is drawn in a box of UN_BOX; the hall stands at the bottom of it with the rostrum at HALL and the arc 116° wide.
export const UN_BOX = { w: 660, h: 800 }
// What the plan shows of it: the hall and the clusters of the topics stand between y 190 and 720.
export const UN_VIEW = { x: 0, y: 190, w: 660, h: 530 }
const HALL = { x: 328, y: 630, half: 58, rows: 7 }
const CLUSTERS = { x: 328, y: 460 }
const rowRadius = (i: number) => 70 + i * 35
const polar = (angle: number, r: number) => [HALL.x + r * Math.sin(angle * Math.PI / 180), HALL.y - r * Math.cos(angle * Math.PI / 180)] as const

export interface UnSeat { x: number, y: number, ix: number, iy: number, angle: number, row: number, block: number }

// The countries in the UN's order: English alphabetical from Morocco, the observers last.
export const unSeatOrder = (countries: UnCountry[]) => {
  const members = countries.filter(c => !OBSERVERS.includes(c.name)).sort((a, b) => (SORT_KEY[a.name] ?? a.name).localeCompare(SORT_KEY[b.name] ?? b.name, 'en'))
  const first = members.findIndex(c => c.name === FIRST_SEAT)
  return [...members.slice(Math.max(first, 0)), ...members.slice(0, Math.max(first, 0)), ...countries.filter(c => OBSERVERS.includes(c.name))]
}

// 7 rows, a row has as many seats as its length gives it, rows are filled from the right of the President to the left; 3 blocks with two aisles.
export const unSeats = (countries: UnCountry[]) => {
  const seq = unSeatOrder(countries)
  const rnd = seeded(11)
  const total = [0, 1, 2, 3, 4, 5, 6].map(rowRadius).reduce((a, b) => a + b, 0)
  const seats = new Map<string, UnSeat>()
  const GAP = 6
  const usable = 2 * HALL.half - 2 * GAP
  let left = seq.length
  let index = 0
  for (let i = 0; i < HALL.rows; i++) {
    const n = i === HALL.rows - 1 ? left : Math.round(seq.length * rowRadius(i) / total)
    left -= n
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0.5 : k / (n - 1)
      const angle = HALL.half - (u * usable + (u > 1 / 3 ? GAP : 0) + (u > 2 / 3 ? GAP : 0))
      const [x, y] = polar(angle, rowRadius(i))
      seats.set(seq[index++]!.name, { x: x + (rnd() - 0.5) * 5, y: y + (rnd() - 0.5) * 5, ix: x, iy: y, angle, row: i, block: u > 2 / 3 ? 2 : u > 1 / 3 ? 1 : 0 })
    }
  }
  return seats
}

// The lines of the empty hall: the rows of each block as arcs, the outer wall and the rostrum.
export const unHallLines = (seats: Map<string, UnSeat>) => {
  const arcs: string[] = []
  const byBlock = new Map<string, UnSeat[]>()
  for (const s of seats.values()) {
    const key = `${s.row}:${s.block}`
    byBlock.set(key, [...(byBlock.get(key) ?? []), s])
  }
  for (const [key, list] of byBlock) {
    if (list.length < 2) continue
    const row = Number(key.split(':')[0])
    const sorted = list.slice().sort((a, b) => a.angle - b.angle)
    const a = sorted[0]!
    const z = sorted[sorted.length - 1]!
    arcs.push(`M${a.ix} ${a.iy} A${rowRadius(row)} ${rowRadius(row)} 0 0 1 ${z.ix} ${z.iy}`)
  }
  const R = rowRadius(6) + 30
  const [x0, y0] = polar(-HALL.half - 5, R)
  const [x1, y1] = polar(HALL.half + 5, R)
  return { arcs, wall: `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`, rostrum: { x: HALL.x, y: HALL.y } }
}

export type UnTab = 'hall' | 'themes' | 'attacks' | 'greece'
export interface UnPlace { x: number, y: number, r?: number, o?: number }
export interface UnEdge { d: string, w: number, color: string, o: number }
export interface UnLabel { x: number, y: number, text: string, small?: boolean }
export interface UnLayout { pos: Map<string, UnPlace>, edges: UnEdge[], labels: UnLabel[], hall: boolean }

// A dot is 2.6 px and grows with its speaking time (square root), or on the Israel–Palestine view with its minutes on the topic.
export const unRadius = (c: UnCountry, topic: boolean, maxMinutes: number) =>
  topic ? (c.israelMinutes > 0 ? 2.6 + Math.sqrt(c.israelMinutes / maxMinutes) * 8 : 1.8) : 2.6 + Math.sqrt(c.seconds / 60) * 0.6
export const unOpacity = (c: UnCountry, topic: boolean) => (topic ? (c.israelMinutes > 0 ? 0.9 : 0.22) : 0.85)

const curve = (a: { x: number, y: number }, b: { x: number, y: number }, pull: { x: number, y: number }) => {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx + (pull.x - mx) * 0.55).toFixed(1)} ${(my + (pull.y - my) * 0.55).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}
// The curves of a hall go up to the middle of the floor, so they cross over the seats and not along the rows.
const PULL = { x: HALL.x, y: HALL.y - 190 }
const GREECE_PULL = { x: HALL.x, y: HALL.y - 150 }
const TONE_COLOR: Record<string, string> = { hostile: 'var(--stance-critical)', critical: 'var(--stance-critical)', neutral: 'var(--bar-muted)', conciliatory: 'var(--stance-supportive)', supportive: 'var(--stance-supportive)' }

export interface UnLayoutInput {
  countries: UnCountry[]
  seats: Map<string, UnSeat>
  // The name of a country, or of a cluster key, as the page shows it.
  nameOf: (country: string) => string
  clusterName: (key: string) => string
  // The word of the first seat, shown by its label.
  firstSeat: string
}

const hallPos = (seats: Map<string, UnSeat>) => new Map<string, UnPlace>([...seats].map(([name, s]) => [name, { x: s.x, y: s.y }]))
const seatOf = (seats: Map<string, UnSeat>, name: string) => seats.get(name)!

export const unHallLayout = (i: UnLayoutInput): UnLayout => {
  const labels: UnLabel[] = []
  for (const name of ['Morocco', 'Greece', 'Israel', 'United States of America']) {
    const s = i.seats.get(name)
    if (s) labels.push({ x: s.x + 8, y: s.y + 4, text: name === 'Morocco' ? `${i.nameOf(name)} · ${i.firstSeat}` : i.nameOf(name) })
  }
  return { pos: hallPos(i.seats), edges: [], labels, hall: true }
}

// Each country at the cluster of its main topic (a phyllotaxis spiral, the largest speaker at the middle); the topics stand on an ellipse.
export const unThemesLayout = (i: UnLayoutInput): UnLayout => {
  const pos = new Map<string, UnPlace>()
  const labels: UnLabel[] = []
  const keyOf = (c: UnCountry) => (UN_CLUSTER_TOPICS.includes(c.main) ? c.main : '*')
  const K = UN_CLUSTER_TOPICS.length
  UN_CLUSTER_TOPICS.forEach((key, k) => {
    const angle = -90 + 360 * k / K + (K === 7 ? 6 : 0)
    const cx = CLUSTERS.x + 190 * Math.cos(angle * Math.PI / 180)
    const cy = CLUSTERS.y + 225 * Math.sin(angle * Math.PI / 180)
    const members = i.countries.filter(c => keyOf(c) === key).sort((a, b) => b.seconds - a.seconds)
    members.forEach((c, j) => {
      const a = j * 2.39996
      const r = 7.4 * Math.sqrt(j + 0.5)
      pos.set(c.name, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    })
    labels.push({ x: cx, y: cy - (7.4 * Math.sqrt(members.length) + 14) - 6, text: `${i.clusterName(key)} · ${members.length}` })
  })
  return { pos, edges: [], labels, hall: false }
}

// Who attacked whom, among the countries in the hall: a curve from the seat of the speaker to the seat of the target; the 6 most attacked are larger and named.
export const unAttacksLayout = (i: UnLayoutInput): UnLayout => {
  const pos = hallPos(i.seats)
  const total = new Map<string, number>()
  for (const c of i.countries) for (const [to, n] of c.attacks) total.set(to, (total.get(to) ?? 0) + n)
  const top = [...total].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topNames = new Set(top.map(t => t[0]))
  const edges: UnEdge[] = []
  for (const c of i.countries) {
    for (const [to, n] of c.attacks) {
      if (topNames.has(to)) edges.push({ d: curve(seatOf(i.seats, c.name), seatOf(i.seats, to), PULL), w: 0.7 + n * 0.35, color: 'var(--stance-critical)', o: 0.55 })
    }
  }
  const labels: UnLabel[] = []
  for (const [to, n] of top) {
    const s = seatOf(i.seats, to)
    pos.set(to, { x: s.x, y: s.y, r: 4 + Math.sqrt(n) * 1.2 })
    labels.push({ x: s.x + 9, y: s.y + 4, text: `${i.nameOf(to)} · ${n}` })
  }
  return { pos, edges, labels, hall: true }
}

// Who named Greece and Cyprus: curves from the seat of whoever did, colored by the tone; the rest of the hall dims.
export const unGreeceLayout = (i: UnLayoutInput): UnLayout => {
  const pos = new Map<string, UnPlace>([...i.seats].map(([name, s]) => [name, { x: s.x, y: s.y, o: 0.3 }]))
  const labels: UnLabel[] = []
  const edges: UnEdge[] = []
  for (const name of ['Greece', 'Cyprus']) {
    const s = i.seats.get(name)
    if (!s) continue
    pos.set(name, { x: s.x, y: s.y, r: 7, o: 1 })
    labels.push({ x: s.x + 9, y: s.y + 4, text: i.nameOf(name) })
  }
  for (const c of i.countries) {
    if (!c.greece) continue
    const s = seatOf(i.seats, c.name)
    pos.set(c.name, { x: s.x, y: s.y, r: 5, o: 1 })
    if (c.name !== 'Greece' && c.name !== 'Cyprus') labels.push({ x: s.x + 8, y: s.y + 4, text: i.nameOf(c.name), small: true })
    for (const [named, flag] of [['Greece', c.greece.greece], ['Cyprus', c.greece.cyprus]] as const) {
      if (flag && named !== c.name && i.seats.has(named)) edges.push({ d: curve(s, seatOf(i.seats, named), GREECE_PULL), w: 1.6, color: TONE_COLOR[c.greece.tone] ?? 'var(--bar-muted)', o: 0.8 })
    }
  }
  return { pos, edges, labels, hall: true }
}

// Παλαιστίνη–Ισραήλ: the hall stays, Israel is the large dot, the others fade and whoever attacked it grows with its attacks, a curve to its seat.
export const unIsraelLayout = (i: UnLayoutInput): UnLayout => {
  const israel = i.seats.get('Israel')
  const pos = new Map<string, UnPlace>([...i.seats].map(([name, s]) => [name, { x: s.x, y: s.y, o: 0.14 }]))
  if (!israel) return { pos, edges: [], labels: [], hall: true }
  pos.set('Israel', { x: israel.x, y: israel.y, r: 9, o: 1 })
  const labels: UnLabel[] = [{ x: israel.x + 11, y: israel.y + 4, text: i.nameOf('Israel') }]
  const edges: UnEdge[] = []
  const attackers = i.countries.filter(c => c.attacksOnIsrael > 0 && c.name !== 'Israel').sort((a, b) => b.attacksOnIsrael - a.attacksOnIsrael)
  attackers.forEach((c, k) => {
    const s = seatOf(i.seats, c.name)
    pos.set(c.name, { x: s.x, y: s.y, r: 3.6 + Math.sqrt(c.attacksOnIsrael) * 2.4, o: 0.95 })
    edges.push({ d: curve(s, israel, { x: HALL.x, y: HALL.y - 200 }), w: 0.8 + c.attacksOnIsrael * 0.35, color: 'var(--stance-critical)', o: 0.6 })
    if (k < 4) labels.push({ x: s.x + 9, y: s.y - 8, text: `${i.nameOf(c.name)} ${c.attacksOnIsrael}` })
  })
  return { pos, edges, labels, hall: true }
}

export const unLayout = (tab: UnTab, i: UnLayoutInput): UnLayout =>
  tab === 'themes' ? unThemesLayout(i) : tab === 'attacks' ? unAttacksLayout(i) : tab === 'greece' ? unGreeceLayout(i) : unHallLayout(i)
