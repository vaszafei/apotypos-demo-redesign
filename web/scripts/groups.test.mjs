import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GAP, groupColors, shortName, compactName, stanceTotals, tintOf } from '../app/utils/groups.ts'
import { netLayout } from '../app/utils/net-layout.ts'
import { inkOn, tintHex, tokenName } from '../app/utils/ink.ts'

const groups = JSON.parse(readFileSync(new URL('../public/data/groups.json', import.meta.url), 'utf8'))

const netGroups = () => groups.groups.filter(g => g.collected > 0).map(g => {
  const outlets = g.outlets.filter(o => o.collected > 0).map(o => ({ name: o.name, slug: o.slug, value: o.collected, analysed: o.analysed, news: o.news, stance: o.stance }))
  return { key: g.name, label: g.name, owner: g.owner, color: 'red', slug: g.slug, outlets, value: outlets.reduce((s, o) => s + o.value, 0) }
})

test('a group keeps its color slot whatever the list is', () => {
  const colors = groupColors([{ name: 'Politis Group' }, { name: 'Alter Ego Media' }, { name: 'Unknown' }])
  assert.equal(colors.get('Alter Ego Media'), 'var(--cat-1)')
  assert.equal(colors.get('Politis Group'), 'var(--cat-4)')
  assert.equal(colors.get('Unknown'), 'var(--cat-3)')
})

test('names are shortened for the legends', () => {
  assert.equal(shortName('Συμφέροντα Μελισσανίδη'), 'Μελισσανίδη')
  assert.equal(compactName('DPG Digital Media', false, 'none'), 'DPG')
  assert.equal(compactName('Όμιλος ΣΚΑΪ', false, 'none'), 'ΣΚΑΪ')
  assert.equal(compactName('anything', true, 'Χωρίς όμιλο'), 'Χωρίς όμιλο')
  assert.equal(GAP, 50)
})

test('the stance of a group is the sum of its outlets', () => {
  assert.deepEqual(stanceTotals([{ stance: [1, 2, 3] }, { stance: [10, 20, 30] }]), [11, 22, 33])
})

test('a tint is a mix with white', () => {
  assert.equal(tintOf('var(--cat-2)', 0.35), 'color-mix(in srgb, var(--cat-2) 65%, white)')
  assert.equal(tintHex('#000000', 0.5), '#808080')
})

test('the ink on a fill is the one with the better contrast', () => {
  assert.equal(inkOn('#ffffff', '#1f1f1f', '#ffffff'), '#1f1f1f')
  assert.equal(inkOn('#101010', '#1f1f1f', '#ffffff'), '#ffffff')
  assert.equal(tokenName('var(--cat-3)'), '--cat-3')
  assert.equal(tokenName('#fff'), null)
})

test('the network puts every outlet in the chart and no two groups overlap', () => {
  const list = netGroups()
  const { nodes, links, clusters } = netLayout(list, 640, 358)
  assert.equal(nodes.filter(n => n.kind === 'outlet').length, list.reduce((s, g) => s + g.outlets.length, 0))
  assert.equal(links.length, nodes.filter(n => n.kind === 'outlet').length)
  for (const n of nodes) assert.ok(n.x >= 0 && n.x <= 640 && n.y >= 0 && n.y <= 358, `${n.kind} inside the chart`)
  clusters.forEach((p, i) => clusters.slice(i + 1).forEach(q => assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= p.R + q.R, 'two groups do not overlap')))
})

test('the positions are rounded to 0.0001 px, so the server and the browser print the same numbers', () => {
  const { nodes } = netLayout(netGroups(), 1000, 440)
  for (const n of nodes) { assert.equal(n.x, Math.round(n.x * 10000) / 10000); assert.equal(n.y, Math.round(n.y * 10000) / 10000) }
})
