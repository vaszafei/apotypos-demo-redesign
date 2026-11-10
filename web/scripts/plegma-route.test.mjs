import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLEGMA_VIEW } from '../app/utils/plegma-route.ts'

test('a story or a theme route, with its query or a trailing slash, is a view of the Plegma', () => {
  for (const to of ['/story?id=5', '/topic?i=3', '/story/?id=5', '/story', '/topic/']) assert.ok(PLEGMA_VIEW.test(to), to)
})

test('a page, a group or an outlet is not a view of the Plegma, nor is a path that only starts like one', () => {
  for (const to of ['/', '/media', '/stories', '/group?slug=a', '/outlet?slug=a', '/storyboard', '/topics']) assert.equal(PLEGMA_VIEW.test(to), false, to)
})
