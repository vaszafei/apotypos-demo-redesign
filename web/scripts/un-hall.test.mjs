import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unCountries, unSeats, unSeatOrder, unLayout, unIsraelLayout, unHallLines, UN_REGIONS, UN_BOX } from '../app/utils/un-hall.ts'
import { UN_COUNTRY_EL } from '../app/utils/un-countries.ts'

const rows = JSON.parse(readFileSync(new URL('../public/data/speeches.json', import.meta.url), 'utf8')).rows
const countries = unCountries(rows)
const seats = unSeats(countries)
const input = { countries, seats, nameOf: n => n, clusterName: k => k, firstSeat: 'first' }

test('one dot per country of the 192 speeches, in the six regions', () => {
  assert.equal(rows.length, 192)
  assert.equal(countries.length, new Set(rows.map(r => r.country)).size)
  assert.ok(countries.every(c => UN_REGIONS.includes(c.region)))
  assert.equal(countries.reduce((a, c) => a + c.seconds, 0), rows.reduce((a, r) => a + r.seconds, 0))
})

test('the seats are the UN order: Morocco first, the observers last, every country one seat', () => {
  const order = unSeatOrder(countries).map(c => c.name)
  assert.equal(order[0], 'Morocco')
  assert.deepEqual(order.slice(-2), ['State of Palestine', 'Holy See'])
  assert.equal(seats.size, countries.length)
  assert.deepEqual([...seats.keys()].sort(), countries.map(c => c.name).sort())
  const cells = new Set([...seats.values()].map(s => `${Math.round(s.ix)}:${Math.round(s.iy)}`))
  assert.equal(cells.size, seats.size)
  assert.ok([...seats.values()].every(s => s.x > 0 && s.x < UN_BOX.w && s.y > 0 && s.y < UN_BOX.h))
  assert.equal(seats.get('Morocco').row, 0)
})

test('the hall is the same each time', () => {
  assert.deepEqual([...unSeats(countries)], [...seats])
  assert.ok(unHallLines(seats).arcs.length >= 18)
})

test('attacks on Israel are the targets that start with Israel, the speaker itself left out', () => {
  const total = countries.reduce((a, c) => a + c.attacksOnIsrael, 0)
  assert.equal(total, rows.reduce((a, r) => a + r.targets.filter(t => /^Israel/.test(t[0])).reduce((s, t) => s + t[1], 0), 0))
  assert.ok(countries.filter(c => c.attacksOnIsrael > 0).length > 10)
})

test('every tab places every country, with finite places, and its curves end at seats of the hall', () => {
  for (const tab of ['hall', 'themes', 'attacks', 'greece']) {
    const layout = unLayout(tab, input)
    assert.equal(layout.pos.size, countries.length, tab)
    assert.ok([...layout.pos.values()].every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), tab)
    assert.ok(layout.edges.every(e => !e.d.includes('NaN')), tab)
  }
  assert.ok(unLayout('attacks', input).edges.length > 0)
  assert.ok(unLayout('greece', input).edges.length > 0)
  assert.ok(unIsraelLayout(input).edges.length > 0)
})

test('the themes tab has a cluster for every country and the cluster names', () => {
  const layout = unLayout('themes', input)
  assert.ok(layout.labels.length === 7)
  assert.equal(layout.labels.reduce((a, l) => a + Number(l.text.split(' · ')[1]), 0), countries.length)
})

test('every country has a Greek name', () => {
  assert.deepEqual(countries.map(c => c.name).filter(n => !UN_COUNTRY_EL[n]), [])
})
