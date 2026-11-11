import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heroShape, looseOf, waveReveal, lanternReveal, heroClearMs, HERO_SPEED, HERO_FRONT } from '../app/utils/plegma-hero.ts'
import { mulberry } from '../app/utils/plegma-world.ts'

const components = (n, edges) => {
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (const [a, b] of edges) parent[find(a)] = find(b)
  return new Set(parent.map((_, i) => find(i))).size
}

test('a hero web has the dots it was asked for, all joined in one piece, with no line twice', () => {
  for (const count of [6, 11, 18, 25, 32]) {
    for (let seed = 1; seed < 40; seed++) {
      const w = heroShape(count, 40, mulberry(seed))
      assert.equal(w.offs.length, count)
      assert.equal(components(count, w.edges), 1, `count ${count} seed ${seed}`)
      const keys = w.edges.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`))
      assert.equal(new Set(keys).size, keys.length)
      assert.ok(w.edges.every(([a, b]) => a !== b && a < count && b < count))
    }
  }
})

test('a hero web has clusters, and a node knows its cluster', () => {
  const w = heroShape(25, 40, mulberry(5))
  assert.equal(w.cluster[0], -1)
  assert.ok(w.clusters >= 2 && w.clusters <= 5)
  assert.ok(w.cluster.slice(1).every(c => c >= 0 && c < w.clusters))
  assert.ok(w.edges.length >= 24)
})

test('the same seed gives the same hero web', () => {
  assert.deepEqual(heroShape(20, 40, mulberry(9)), heroShape(20, 40, mulberry(9)))
})

test('a loose node is the same on every call and lies outside the web', () => {
  assert.deepEqual(looseOf(12, 3), looseOf(12, 3))
  const l = looseOf(12, 3)
  assert.ok(Math.hypot(l.x, l.y / 0.85) >= 0.89)
})

test('the wave reaches a near point before a far one, and clears all in the end', () => {
  assert.equal(waveReveal(500, 0), 0)
  assert.ok(waveReveal(100, 400) > waveReveal(900, 400))
  assert.equal(waveReveal(1000, (1000 + HERO_FRONT) / HERO_SPEED * 1000), 1)
  assert.ok(heroClearMs(1920, 960) > 2000 && heroClearMs(1920, 960) < 5000)
})

test('the lantern is full at the pointer and gone at its radius', () => {
  assert.equal(lanternReveal(0, 150), 1)
  assert.equal(lanternReveal(150, 150), 0)
  assert.ok(lanternReveal(60, 150) > 0 && lanternReveal(60, 150) < 1)
})
