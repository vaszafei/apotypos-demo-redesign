import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareImages } from './pixel-diff.mjs'

const image = (width, height, fill = [10, 20, 30]) => {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = 255 }
  return { width, height, data }
}

test('an image against itself has no different pixels', () => {
  const a = image(8, 6)
  const result = compareImages(a, image(8, 6))
  assert.equal(result.sameSize, true)
  assert.equal(result.differ, 0)
  assert.equal(result.total, 48)
  assert.deepEqual(result.bands, [])
})

test('images of different heights are reported, not compared', () => {
  const result = compareImages(image(8, 6), image(8, 7))
  assert.equal(result.sameSize, false)
  assert.deepEqual(result.sizes, [[8, 6], [8, 7]])
})

test('a change of 24 or less in a channel is ignored, 25 is counted', () => {
  const a = image(4, 4)
  const b = image(4, 4)
  b.data[0] = 10 + 24
  assert.equal(compareImages(a, b).differ, 0)
  b.data[0] = 10 + 25
  assert.equal(compareImages(a, b).differ, 1)
})

test('rows that differ close together make one band, with its columns', () => {
  const a = image(10, 20)
  const b = image(10, 20)
  const paint = (x, y) => { b.data[(y * 10 + x) * 4] = 200 }
  paint(2, 3); paint(7, 5); paint(4, 15)
  const { bands, differ } = compareImages(a, b)
  assert.equal(differ, 3)
  assert.deepEqual(bands, [{ y0: 3, y1: 5, count: 2, x0: 2, x1: 7 }, { y0: 15, y1: 15, count: 1, x0: 4, x1: 4 }])
})
