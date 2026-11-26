import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fullData } from './lib/full-data.mjs'

const dir = new URL('../../docs/redesign/prototypes/data/story-times/', import.meta.url)
const times = Object.assign({}, ...readdirSync(dir).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8'))))
const detail = fullData('storyDetail')
const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' })

test('every story from the database has its times, and no other story has any', () => {
  const fromDb = detail.stories.filter(s => s.id >= detail.dbStoryFrom).map(s => String(s.id)).sort()
  assert.deepEqual(Object.keys(times).sort(), fromDb)
})

test('the articles of each story, by outlet and Athens day, are the counts of storyDetail', () => {
  const dayIndex = new Map(detail.dates.map((d, i) => [d, i]))
  for (const s of detail.stories.filter(s => s.id >= detail.dbStoryFrom)) {
    const row = times[s.id]
    const t0 = row[0]
    const cells = new Map()
    for (let i = 1; i < row.length; i += 2) {
      const day = dayIndex.get(athensDay.format(new Date((t0 + row[i + 1]) * 60000)))
      const key = `${row[i]}:${day}`
      cells.set(key, (cells.get(key) ?? 0) + 1)
    }
    const want = new Map()
    for (let i = 0; i < s.t.length; i += 3) want.set(`${s.t[i]}:${s.t[i + 1]}`, s.t[i + 2])
    assert.deepEqual(cells, want, `story ${s.id}`)
  }
})

test('the articles of a story are in order of time, from its first', () => {
  for (const [id, row] of Object.entries(times)) {
    assert.equal(row[2], 0, `story ${id} starts at its t0`)
    for (let i = 4; i < row.length; i += 2) assert.ok(row[i] >= row[i - 2], `story ${id}`)
  }
})
