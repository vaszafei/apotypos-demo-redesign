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

test('attacks on Israel are the targets that name Israel, alone or with another country, the speaker itself left out', () => {
  const total = countries.reduce((a, c) => a + c.attacksOnIsrael, 0)
  assert.equal(total, rows.reduce((a, r) => a + r.targets.filter(t => t[0].includes('Israel')).reduce((s, t) => s + t[1], 0), 0))
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

test('topic minutes: the total is the seconds of the rows, the topics are largest first and the agenda adds up', async () => {
  const { unTopicMinutes, unAgenda, unTopicColors, UN_DOMESTIC } = await import('../app/utils/un-topics.ts')
  const m = unTopicMinutes(rows)
  assert.ok(Math.abs(m.total - rows.reduce((a, r) => a + r.seconds, 0) / 60) < 1e-6)
  assert.ok(m.tagged <= m.total + 1e-6)
  assert.ok(m.topics.every((x, i) => i === 0 || m.topics[i - 1].minutes >= x.minutes))
  assert.ok(m.topics.every(x => x.top.length >= 1 && x.top.length <= 3))
  const a = unAgenda(rows)
  assert.equal(a.big.length, 9)
  assert.ok(Math.abs(a.total - m.total) < 1e-6)
  // The regions add up to all the speeches; each region's outer pieces add up to its own minutes.
  assert.equal(a.regions.reduce((s, x) => s + x.speeches, 0), rows.length)
  assert.ok(Math.abs(a.regions.reduce((s, x) => s + x.total, 0) - a.total) < 1e-6)
  for (const x of a.regions) assert.ok(Math.abs(x.kids.reduce((s, k) => s + k.minutes, 0) - x.total) < 1e-6)
  assert.ok(a.regions.every((x, i) => i === 0 || a.regions[i - 1].total >= x.total))
  // One region picked: the inner ring is that region alone.
  const one = unAgenda(rows.filter(r => r.region === 'Europe'))
  assert.deepEqual(one.regions.map(x => x.region), ['Europe'])
  const color = unTopicColors(m)
  assert.equal(color(UN_DOMESTIC), 'var(--cat-strong)')
  assert.equal(color('no such topic'), 'var(--bar-muted)')
  assert.equal(new Set(m.topics.filter(x => x.topic !== UN_DOMESTIC).slice(0, 8).map(x => color(x.topic))).size, 8)
})

test('the Israel–Palestine page: 184 minutes in 62 speeches, 3rd of 132 topics, 50 attacks on Israel from 21 leaders, and the hall counts the same', async () => {
  const { unIsraelPage } = await import('../app/utils/un-israel.ts')
  const p = unIsraelPage(rows)
  assert.equal(p.minutes.toFixed(1), '184.0')
  assert.equal(p.speeches, 62)
  assert.equal(p.onTopic.length, 62)
  assert.equal(p.rank, 3)
  assert.equal(p.topics, 132)
  assert.equal(p.israelAttacks, 50)
  assert.equal(p.israel.length, 21)
  assert.equal(p.hamasAttacks, 3)
  assert.equal(p.hamas.length, 3)
  assert.ok(p.onTopic.every((r, i) => i === 0 || p.onTopic[i - 1].minutes >= r.minutes))
  // The attackers of the hall are the same 21 leaders (one country each) and the same 50 attacks.
  assert.equal(countries.reduce((a, c) => a + c.attacksOnIsrael, 0), p.israelAttacks)
  assert.equal(countries.filter(c => c.attacksOnIsrael > 0).length, p.israel.length)
})
