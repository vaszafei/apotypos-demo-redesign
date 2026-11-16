import type { MmeData } from '~/types/mme'
import { sumPairs, sumRows } from '~/utils/mme'

// Πρόσωπα (fingerprints-v2.html): two tabs. Επισκόπηση reads the quotes and the tone of the people in data/mme.json (the Greek set, the whole window); Στάση reads the stance of each outlet to the 15 persons of the API (data/stanceRatings.json).

// The people who have a page of their own (the key of the entity /person/<slug>): the file of the data.
export const PERSON_KEYS: Record<string, string> = { 'Άδωνις Γεωργιάδης': 'adonis' }
export const personHref = (key: string | undefined) => (key === 'adonis' ? '/persons-v2.html?slug=adonis' : '')

// Βενιαμίν Νετανιάχου, Μαρία Καρυστιανού and Ζωή Κωνσταντοπούλου are not on Επισκόπηση (decision of 2026-11-09).
const HIDDEN_PEOPLE = ['Βενιαμίν Νετανιάχου', 'Μαρία Καρυστιανού', 'Ζωή Κωνσταντοπούλου']

// ———— Επισκόπηση ————
export interface PersonOverview { k: number, name: string, role: string | null, party: string | null, quotes: number, tone: [number, number, number], daily: number[] }
export interface PeopleOverviewData { updatedAt: string, dates: string[], total: number, people: PersonOverview[] }

// What the tab reads, from the whole file: for each person with statements the quotes, the articles by tone over the outlets with articles, and the articles of each day (all tones).
export const peopleOverview = (b: MmeData): PeopleOverviewData => {
  const set = b.sets.gr!
  const last = set.dates.length - 1
  const active = set.od.map((row, k) => ({ k, n: set.dates.reduce((s, _, d) => s + row[d * 7]!, 0) })).filter(o => o.n > 0).map(o => o.k)
  const total = set.od.reduce((s, row) => s + set.dates.reduce((a, _, d) => a + row[d * 7]!, 0), 0)
  const people = set.people.map((p, k) => {
    const quotes = set.q.reduce((s, perOutlet) => s + sumPairs(perOutlet[k]!, 0, last), 0)
    const tone: [number, number, number] = [0, 0, 0]
    for (const o of active) { const r = sumRows(set.mt[o]![k]!, 4, 0, last); tone[0] += r[0]!; tone[1] += r[1]!; tone[2] += r[2]! }
    const daily = new Array<number>(set.dates.length).fill(0)
    for (const perPerson of set.mt) { const rows = perPerson[k]!; for (let j = 0; j < rows.length; j += 4) daily[rows[j]!]! += rows[j + 1]! + rows[j + 2]! + rows[j + 3]! }
    return { k, name: p.name, role: p.role, party: p.party, quotes, tone, daily }
  }).filter(p => p.quotes > 0 && !HIDDEN_PEOPLE.includes(p.name)).sort((a, b) => b.quotes - a.quotes)
  return { updatedAt: b.updatedAt, dates: set.dates, total, people }
}

// The tone of a person over all the outlets: the articles, the net balance (supportive minus critical over all) and the statements per 1,000 articles of all the outlets.
export const overall = (p: PersonOverview, total: number) => {
  const n = p.tone[0] + p.tone[1] + p.tone[2]
  return { n, net: n ? (p.tone[2] - p.tone[0]) / n : 0, rate: total ? (p.quotes / total) * 1000 : 0 }
}
// The balance as a whole number of points: +12, −7.
export const netPoints = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}`

// ———— Στάση ————
export interface StanceRatingsData { days: number, referenceDate: string, minN: number, persons: { name: string, outlets: Record<string, [number, number]> }[] }
export interface PersonStance { name: string, short: string, mean: number, spread: number, mentions: number, rated: { outlet: string, n: number, v: number }[] }

// An outlet is named only from 20 mentions of the person (a stance from 1 or 2 mentions is not a finding). The stance of an outlet counts from 10 mentions (the API's own minimum).
export const NAME_MIN = 20
export const STANCE_MIN = 10

const two = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmt2 = (v: number) => two.format(v)
export const netText = (v: number) => (Math.abs(v) < 0.005 ? '0' : `${v > 0 ? '+' : '−'}${fmt2(Math.abs(v))}`)

// The short name of a person is the last word. A name that two persons share stays whole.
const shortNames = (names: string[]) => names.map((n) => { const last = n.split(' ').pop()!; return names.filter(m => m.split(' ').pop() === last).length > 1 ? n : last })

// One record for each person: the mean stance over the outlets weighted by mentions, the spread between the outlets (weighted standard deviation), the mentions, and the outlets with NAME_MIN mentions
// (the most supportive first). The persons are in the order of the mentions.
export const stancePeople = (d: StanceRatingsData): PersonStance[] => {
  const short = shortNames(d.persons.map(p => p.name))
  return d.persons.map((p, i) => {
    const rated = Object.entries(p.outlets).map(([outlet, [v, n]]) => ({ outlet, n, v })).filter(x => x.n >= STANCE_MIN)
    const mentions = rated.reduce((a, x) => a + x.n, 0)
    const mean = mentions ? rated.reduce((a, x) => a + x.v * x.n, 0) / mentions : 0
    const spread = mentions ? Math.sqrt(rated.reduce((a, x) => a + x.n * (x.v - mean) ** 2, 0) / mentions) : 0
    return { name: p.name, short: short[i]!, mean, spread, mentions, rated: rated.filter(x => x.n >= NAME_MIN).sort((a, b) => b.v - a.v) }
  }).filter(p => p.mentions).sort((a, b) => b.mentions - a.mentions)
}

// The place of the name of a dot (the scatters): beside it, else over it or under it, where no other name or dot is. `free` tells if a box is empty.
export interface NameBox { x0: number, x1: number, y0: number, y1: number }
export const nameSpot = (cx: number, cy: number, r: number, w: number, free: (b: NameBox) => boolean) => {
  const spots = [
    { x: cx + r + 6, y: cy + 4, anchor: 'start' as const, b: { x0: cx + r + 4, x1: cx + r + 8 + w, y0: cy - 8, y1: cy + 8 } },
    { x: cx - r - 6, y: cy + 4, anchor: 'end' as const, b: { x0: cx - r - 8 - w, x1: cx - r - 4, y0: cy - 8, y1: cy + 8 } },
    { x: cx, y: cy - r - 6, anchor: 'middle' as const, b: { x0: cx - w / 2, x1: cx + w / 2, y0: cy - r - 18, y1: cy - r - 4 } },
    { x: cx, y: cy + r + 14, anchor: 'middle' as const, b: { x0: cx - w / 2, x1: cx + w / 2, y0: cy + r + 2, y1: cy + r + 16 } }
  ]
  return spots.find(q => free(q.b)) ?? spots[0]!
}
