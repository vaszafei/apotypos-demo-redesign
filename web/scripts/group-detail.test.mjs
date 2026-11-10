import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { storyProfiles } from '../app/utils/profiles.ts'
import { groupDaily, groupWindow, storiesOfGroup, groupTopics, groupWrites } from '../app/utils/group-detail.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const media = read('media')
const list = read('stories')
const dd = read('storyDetail')
const groups = read('groups')
const plain = v => JSON.parse(JSON.stringify(v))

const spread = () => {
  const window = {}
  runInNewContext(readFileSync(new URL('../../docs/redesign/prototypes/assets/spread.js', import.meta.url), 'utf8'), { window })
  return window.Spread
}

test('the profiles of the stories are those of Spread.profiles', () => {
  assert.deepEqual(plain(storyProfiles(dd)), plain(spread().profiles(dd)))
})

test('the daily articles of a group are the sum of its outlets, null when no outlet has a count', () => {
  for (const g of groups.groups) {
    const daily = groupDaily(media, g)
    assert.equal(daily.length, media.dates.length)
    const members = new Set(g.outlets.map(o => o.slug))
    const day = daily.findIndex(c => c[0] > 0)
    const expected = media.outlets.reduce((s, o, k) => (members.has(o.slug) ? s + (media.outletDaily[k][day][0] ?? 0) : s), 0)
    assert.equal(daily[day][0], expected)
  }
  const nothing = groupDaily({ dates: ['a'], outlets: [{ slug: 'x' }], outletDaily: [[[null, null]]] }, { outlets: [{ slug: 'x' }] })
  assert.deepEqual(nothing, [[null, null]])
})

test('the window of the title card starts at the first day with articles and ends in the window of the groups file', () => {
  for (const g of groups.groups) {
    const { start, end } = groupWindow(groupDaily(media, g), media.dates, groups.window[1])
    assert.ok(start >= 0 && end >= start)
    assert.ok(end <= media.dates.indexOf(groups.window[1]))
  }
})

test('the stories of a group: its articles are the sum of its outlets in the story, sorted, and the topics add up to them', () => {
  const g = groups.groups.find(x => x.slug === 'politis')
  const last = media.dates.length - 1
  const r = storiesOfGroup(list, dd, g, last)
  assert.ok(r.mine.length > 0)
  assert.ok(r.mine.every((s, i) => i === 0 || r.mine[i - 1].n >= s.n))
  assert.ok(r.mine.every(s => s.days.reduce((a, b) => a + b, 0) === s.n))
  assert.ok(r.alone <= r.withOthers)
  const inTopics = [...r.topicDays.values()].reduce((a, v) => a + v.reduce((x, y) => x + y, 0), 0)
  assert.equal(inTopics, r.mine.filter(s => s.story).reduce((a, s) => a + s.n, 0))
})

test('the topics of a group are shares that sum to at most 1, without the catch-all, 10 at most', () => {
  for (const g of groups.groups) {
    const { rows } = groupTopics(groups, g)
    assert.ok(rows.length <= 10)
    assert.ok(rows.every(r => !r.issue.catchAll))
    assert.ok(rows.reduce((a, r) => a + r.value, 0) <= 1 + 1e-9)
    assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].value >= r.value))
  }
})

test('how a group writes: the stance counts are the sum of its outlets, and the usual is that of all outlets', () => {
  const g = groups.groups[0]
  const w = groupWrites(groups, g)
  assert.equal(w.stanceN, g.outlets.reduce((a, o) => a + o.stance[0] + o.stance[1] + o.stance[2], 0))
  assert.ok(w.stanceAll.every((v, i) => v >= w.stanceMine[i]))
  assert.ok(w.news.value >= 0 && w.news.value <= 1)
})
