import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildThemeWeb } from '../app/utils/plegma-theme.ts'

const stories = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1, name: `s${i}`, n: 200 - i * 10, media: 20,
  outlets: Array.from({ length: 3 + (i * 5) % 6 }, (_, j) => ({ name: `o${j}`, group: j % 3 ? `g${j % 3}` : null, slot: j % 3, n: 1 + j }))
}))

test('a theme web has the theme at the center, a node for each story around it and a node for each outlet near its story, all inside the disc', () => {
  const web = buildThemeWeb(stories, 4)
  assert.equal(web.n, 1 + stories.length + stories.reduce((sum, s) => sum + s.outlets.length, 0))
  assert.equal(Math.hypot(web.x[0], web.y[0]), 0)
  const seen = stories.map(() => new Set())
  for (let i = 1; i < web.n; i++) {
    assert.ok(Math.hypot(web.x[i], web.y[i]) <= 1.2, `node ${i} inside the disc`)
    const s = web.story[i]
    if (web.outlet[i] < 0) continue
    seen[s].add(web.outlet[i])
    assert.ok(Math.hypot(web.x[i] - web.x[1 + s], web.y[i] - web.y[1 + s]) < 0.35, `outlet ${i} near its story`)
  }
  stories.forEach((s, i) => assert.equal(seen[i].size, s.outlets.length))
})

test('every node but the theme is joined to an earlier node of its own story or to the theme, and the web is the same on every call', () => {
  const web = buildThemeWeb(stories, 4)
  assert.equal(web.bow.length, web.n - 1)
  for (let e = 0; e < web.bow.length; e++) {
    const [i, j] = [web.edges[e * 2], web.edges[e * 2 + 1]]
    assert.ok(j < i)
    if (web.outlet[i] < 0) assert.equal(j, 0)
    else assert.equal(web.story[j], web.story[i])
  }
  assert.deepEqual(buildThemeWeb(stories, 4).x, web.x)
  assert.notDeepEqual(buildThemeWeb(stories, 5).x, web.x)
})
