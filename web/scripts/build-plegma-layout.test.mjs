import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPlegmaLayout, writePlegmaLayout, placeOf, WORLD, DX } from './build-plegma-layout.mjs'

const stories = JSON.parse(readFileSync(new URL('../public/data/stories.json', import.meta.url), 'utf8'))
const placesOf = (layout) => new Map(Array.from({ length: layout.places.length / 3 }, (_, i) => [layout.places[i * 3], layout.places.slice(i * 3 + 1, i * 3 + 3)]))
const inside = ([x, y]) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1

test('running the generator twice gives byte-identical output', () => {
  assert.equal(JSON.stringify(buildPlegmaLayout(stories)), JSON.stringify(buildPlegmaLayout(stories)))
  const dir = mkdtempSync(join(tmpdir(), 'plegma-'))
  writeFileSync(`${dir}/stories.json`, JSON.stringify(stories))
  writePlegmaLayout(`${dir}/stories.json`, `${dir}/a.json`)
  writePlegmaLayout(`${dir}/stories.json`, `${dir}/b.json`)
  assert.equal(readFileSync(`${dir}/a.json`, 'utf8'), readFileSync(`${dir}/b.json`, 'utf8'))
})

test('every non-generic story has a place and no generic story has one', () => {
  const places = placesOf(buildPlegmaLayout(stories))
  for (const s of stories.stories) assert.equal(places.has(s.id), !s.generic, `story ${s.id}`)
  assert.ok(places.size > 7000)
})

test('every place is inside the world bounds', () => {
  for (const [id, p] of placesOf(buildPlegmaLayout(stories))) assert.ok(inside(p), `story ${id} at ${p}`)
})

test('adding a story does not move any other story', () => {
  const before = placesOf(buildPlegmaLayout(stories))
  const extra = { id: 99999, el: 'new', issue: 0, outlets: 1, generic: false, days: [40, 5] }
  const after = placesOf(buildPlegmaLayout({ ...stories, stories: [...stories.stories, extra] }))
  assert.ok(after.has(99999))
  for (const [id, p] of before) assert.deepEqual(after.get(id), p, `story ${id}`)
})

test('a later day on a running story and a later month in the dates move nothing', () => {
  const before = placesOf(buildPlegmaLayout(stories))
  const last = stories.dates.length - 1
  const longer = stories.stories.map((s, i) => (i % 3 ? s : { ...s, days: [...s.days, last + 1, 900] }))
  const dates = [...stories.dates, '2026-10-28', '2026-10-29', '2026-11-30']
  const after = placesOf(buildPlegmaLayout({ ...stories, stories: longer, dates }))
  for (const [id, p] of before) assert.deepEqual(after.get(id), p, `story ${id}`)
})

test('a story from October gets a place right of the September ones and inside the bounds', () => {
  const october = stories.stories.filter((s) => !s.generic && stories.dates[s.days[0]] >= '2026-10-14')
  assert.ok(october.length > 100)
  const places = placesOf(buildPlegmaLayout(stories))
  const september = places.get(stories.stories.find((s) => !s.generic && stories.dates[s.days[0]] === '2026-09-30').id)
  for (const s of october) {
    const p = places.get(s.id)
    assert.ok(inside(p))
    assert.ok(p[0] > september[0] - 7 * DX, `story ${s.id}`)
  }
})

test('a one-day story and a 60-day story both land inside the bounds', () => {
  const clipped = [stories.dates[0], stories.dbCovered[0]]
  const oneDay = { id: 1, days: [30, 3] }
  const long = { id: 2, days: Array.from({ length: 60 }, (_, i) => [i, 4]).flat() }
  assert.ok(inside(placeOf(oneDay, stories.dates, clipped)))
  assert.ok(inside(placeOf(long, stories.dates, clipped)))
})

test('a story that starts on a block start is spread back up to 6 days, one that starts later is not', () => {
  const clipped = [stories.dates[0], stories.dbCovered[0]]
  const dayOf = (index) => Math.round((Date.parse(stories.dates[index]) - Date.parse('2026-08-01')) / 86400000)
  const x = (id, first) => placeOf({ id, days: [first, 1] }, stories.dates, clipped)[0]
  const block = stories.dates.indexOf(stories.dbCovered[0])
  for (let id = 1; id <= 40; id++) {
    assert.ok(x(id, 0) <= 0 && x(id, 0) > -6 * DX, `story ${id} on day 0`)
    assert.ok(x(id, block) <= dayOf(block) * DX && x(id, block) > (dayOf(block) - 6) * DX, `story ${id} on the block start`)
    assert.ok(x(id, block + 1) >= dayOf(block + 1) * DX && x(id, block + 1) < (dayOf(block + 1) + 1) * DX, `story ${id} the day after`)
  }
})
