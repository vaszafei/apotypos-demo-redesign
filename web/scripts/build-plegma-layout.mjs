// The permanent place of every story on the Plegma, written to public/data/plegma.json by `npm run sync`.
// A place is a pure function of the story's own fields (its id and its first day), so a story stays where it is when other stories or later months arrive.
// Across: the first day as days since EPOCH. Up and down: a seeded spread by the story id (layout A of the U1 prototype, chosen by the user).
// Run alone: node scripts/build-plegma-layout.mjs [stories.json] [plegma.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The day that is x = 0. It is a date, not an index of `dates`, so the window may start earlier or later without moving a story.
export const EPOCH = '2026-08-01'
// World units per day, and the height of the world.
export const DX = 60
export const WORLD_H = 1200
// A story that is running on the first day of a data block has a clipped first day; it is spread back this many days.
export const SMEAR_DAYS = 6
// Fixed world bounds: from just left of the epoch to two years after it, so later months have room on the right.
export const WORLD = { x0: -SMEAR_DAYS * DX, x1: 730 * DX, y0: 0, y1: WORLD_H }

const mulberry = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}
// A number in [0, 1) that depends on the story id and a slot k, and on nothing else.
const hash = (id, k) => {
  const r = mulberry(id * 2654435761 + k * 97 + 13)
  r()
  return r()
}

const dayMs = 86400000
const daysSinceEpoch = (date) => Math.round((Date.parse(date) - Date.parse(EPOCH)) / dayMs)
const round = (v) => Math.round(v * 10) / 10

// The place [x, y] of one story. `story` has `id` and `days` (day, articles pairs); `dates` maps a day index to a date;
// `clipped` is the list of dates on which a data block begins (the first date of the window and of the October block).
export const placeOf = (story, dates, clipped) => {
  const first = story.days[0]
  const date = dates[first]
  const offset = daysSinceEpoch(date)
  const x = clipped.includes(date)
    ? (offset - hash(story.id, 3) * SMEAR_DAYS) * DX
    : (offset + hash(story.id, 2) * 0.92) * DX
  return [round(x), round(hash(story.id, 1) * WORLD_H)]
}

// The fixture of the places: world bounds and `places` as a flat list, id, x, y for each story. Generic stories have none.
export const buildPlegmaLayout = (stories) => {
  const clipped = [stories.dates[0], stories.dbCovered?.[0]].filter(Boolean)
  const places = []
  for (const story of stories.stories) {
    if (story.generic || !story.days.length) continue
    places.push(story.id, ...placeOf(story, stories.dates, clipped))
  }
  return { epoch: EPOCH, dx: DX, world: WORLD, places }
}

export const writePlegmaLayout = (from, to) => {
  const layout = buildPlegmaLayout(JSON.parse(readFileSync(from, 'utf8')))
  writeFileSync(to, JSON.stringify(layout))
  return layout.places.length / 3
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = process.argv[2] ?? fileURLToPath(new URL('../public/data/stories.json', import.meta.url))
  const to = process.argv[3] ?? fileURLToPath(new URL('../public/data/plegma.json', import.meta.url))
  console.log(`${writePlegmaLayout(from, to)} places written to ${to}`)
}
