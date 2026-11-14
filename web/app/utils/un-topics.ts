// Politics.topicMinutes of assets/politics.js: the minutes of the speeches by topic, from the main topics of each speech (a share of its seconds). One source for the pages of Αναλύσεις › ΟΗΕ.
// total: all the minutes of the rows; tagged: the minutes with a main topic; topics: largest first, with the three leaders of most minutes ("top") and the leaders with one minute or more.
import type { UnSpeech } from './un-hall.ts'
import { UN_REGIONS } from './un-hall.ts'

export interface UnTopicMinutes { topic: string, minutes: number, leaders: number, speeches: number, top: string[] }
export interface UnMinutes { total: number, tagged: number, topics: UnTopicMinutes[] }

export const unTopicMinutes = (rows: UnSpeech[]): UnMinutes => {
  const by = new Map<string, { topic: string, minutes: number, leaders: number, speeches: number, list: [number, string][] }>()
  let seconds = 0
  let tagged = 0
  for (const r of rows) {
    seconds += r.seconds
    for (const [k, s] of r.shares) {
      const m = (s * r.seconds) / 60
      tagged += m
      const e = by.get(k) ?? { topic: k, minutes: 0, leaders: 0, speeches: 0, list: [] }
      e.minutes += m
      e.leaders += m >= 1 ? 1 : 0
      e.speeches++
      e.list.push([m, r.speaker])
      by.set(k, e)
    }
  }
  const topics = [...by.values()].map(({ list, ...e }) => ({ ...e, top: list.sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]) })).sort((a, b) => b.minutes - a.minutes)
  return { total: seconds / 60, tagged, topics }
}

export const UN_DOMESTIC = 'Domestic affairs'
// The fingerprint colors: the 8 largest topics of all the speeches have a categorical slot, the domestic affairs are dark gray, every other topic is gray.
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8].map(i => `var(--cat-${i})`)
export const unTopicColors = (all: UnMinutes) => {
  const color = new Map(all.topics.filter(a => a.topic !== UN_DOMESTIC).slice(0, SLOTS.length).map((a, i) => [a.topic, SLOTS[i]!]))
  color.set(UN_DOMESTIC, 'var(--cat-strong)')
  return (topic: string) => color.get(topic) ?? 'var(--bar-muted)'
}

// The inner ring of the regions tints, from the largest region.
export const UN_REGION_TINTS = [7, 6, 5, 4, 3, 2].map(i => `var(--seq-${i})`)
// A topic under this share of the time of a region goes into the rest of that region, so the outer ring has no slivers.
const MIN_SHARE = 0.03
const BIG = 9

export interface UnAgendaRegion { region: string, total: number, speeches: number, kids: { topic: string, minutes: number }[] }
export interface UnAgenda {
  // The minutes of the picked speeches, the 9 largest topics of them, and the minutes of all the other topics.
  total: number, big: UnTopicMinutes[], rest: number
  // The regions of the inner ring, largest first; kids: the 9 topics in the order of `big`, then the rest (topic '').
  regions: UnAgendaRegion[]
}

// The agenda of the speeches (the rows of the region picked, or all): the regions inside, the topics outside.
export const unAgenda = (rows: UnSpeech[]): UnAgenda => {
  const mins = unTopicMinutes(rows)
  const big = mins.topics.slice(0, BIG)
  const rest = Math.max(0, mins.total - big.reduce((a, x) => a + x.minutes, 0))
  const regions = UN_REGIONS.map(g => ({ g, rows: rows.filter(r => r.region === g) })).filter(x => x.rows.length).map((x) => {
    const m = unTopicMinutes(x.rows)
    const by = new Map(m.topics.map(e => [e.topic, e.minutes]))
    const kids = big.map(e => ({ topic: e.topic, minutes: (by.get(e.topic) ?? 0) / m.total >= MIN_SHARE ? by.get(e.topic) ?? 0 : 0 }))
    kids.push({ topic: '', minutes: Math.max(0, m.total - kids.reduce((a, k) => a + k.minutes, 0)) })
    return { region: x.g as string, total: m.total, speeches: x.rows.length, kids }
  }).sort((a, b) => b.total - a.total)
  return { total: mins.total, big, rest, regions }
}
