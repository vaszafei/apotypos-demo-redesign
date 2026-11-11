import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { articleDays, articleRadius, articleWebOf, buildArticleWeb } from '../app/utils/plegma-articles.ts'
import { usePlegmaStore } from '../app/stores/plegma.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))

test('a web has one node for each article, inside the unit disc, the first article at the center', () => {
  for (const n of [1, 2, 44, 1183, 3219]) {
    const web = buildArticleWeb(n, 7)
    assert.equal(web.n, n)
    assert.equal(web.x.length, n)
    assert.ok([...web.x].every((v, i) => Math.hypot(v, web.y[i] / 0.9) < 1.2))
  }
  const web = buildArticleWeb(44, 7)
  assert.ok(Math.hypot(web.x[0], web.y[0]) < 0.2)
})

test('each node after the first is joined to an earlier one, and the web is the same on every call', () => {
  const web = buildArticleWeb(300, 11)
  assert.equal(web.edges.length, web.bow.length * 2)
  const joined = new Set()
  for (let e = 0; e < web.bow.length; e++) {
    assert.ok(web.edges[e * 2 + 1] < web.edges[e * 2])
    joined.add(web.edges[e * 2])
  }
  assert.equal(joined.size, 299)
  assert.deepEqual(buildArticleWeb(300, 11).edges, web.edges)
  assert.equal(articleWebOf(5, 20), articleWebOf(5, 20))
  assert.notDeepEqual(buildArticleWeb(300, 12).x, web.x)
})

test('the days of the articles follow the days of the story, first day first, and add up to its articles in every story', () => {
  assert.deepEqual(articleDays([3, 2, 5, 1]), [3, 3, 5])
  const stories = read('stories')
  const detail = new Map(read('storyDetail').stories.map(r => [r.id, r]))
  for (const s of stories.stories.filter(x => !x.generic)) {
    let fromDetail = 0
    const row = detail.get(s.id)
    for (let i = 2; i < row.t.length; i += 3) fromDetail += row.t[i]
    assert.equal(articleDays(s.days).length, fromDetail, `story ${s.id}`)
  }
})

test('a small story has a web a little over half the largest radius and the largest fill it', () => {
  assert.ok(articleRadius(1, 100) >= 50 && articleRadius(1, 100) < 55)
  assert.ok(articleRadius(100, 100) > 50)
  assert.equal(articleRadius(3219, 100), 100)
})

test('the articles of the focused story are forgotten when another story is in focus', () => {
  setActivePinia(createPinia())
  const plegma = usePlegmaStore()
  const route = id => ({ path: '/story', query: { id: String(id) }, meta: { plegma: true } })
  plegma.syncRoute(route(5))
  plegma.setArticles([{ day: 0, outlet: 'A', group: null, slot: 0 }])
  plegma.syncRoute(route(5))
  assert.equal(plegma.articles.length, 1)
  plegma.syncRoute(route(6))
  assert.equal(plegma.articles, null)
})
