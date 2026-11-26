import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ZOOM_LEVELS, createWebZoom, isZoomed, nextLevel, settleLevel, stepZoom, zoomDown, zoomHome, zoomMove, zoomUp, zoomWheel } from '../app/utils/plegma/plegma-zoom.ts'

const BOX = { w: 1000, h: 500 }
// Runs frames of 16 ms from `t` for `ms`; returns the time after.
const run = (zs, t, ms, still = false) => { for (let k = 0; k < ms / 16; k++) { t += 16; stepZoom(zs, t, 16, BOX, still) } return t }
const view = (zs, w) => ({ x: (w.x - zs.cam.x) * zs.z, y: (w.y - zs.cam.y) * zs.z })

test('the levels: one deeper and one farther, none past the ends', () => {
  assert.deepEqual([nextLevel(1, 1), nextLevel(2.4, 1), nextLevel(5, 1)], [2.4, 5, undefined])
  assert.deepEqual([nextLevel(5, -1), nextLevel(2.4, -1), nextLevel(1, -1)], [2.4, 1, undefined])
  assert.equal(nextLevel(1.8, 1), 2.4)
})

test('a mouse notch glides one level; notches during a glide add up', () => {
  const zs = createWebZoom()
  zoomWheel(zs, { dy: -100, ctrl: false, at: { x: 0, y: 0 } }, 0)
  assert.equal(zs.zt, 2.4)
  run(zs, 0, 1500)
  assert.equal(zs.z, 2.4)
  const t = 2000
  zoomWheel(zs, { dy: 100, ctrl: false, at: { x: 0, y: 0 } }, t)
  zoomWheel(zs, { dy: 100, ctrl: false, at: { x: 0, y: 0 } }, t + 20)
  assert.equal(zs.zt, 1)
})

test('a trackpad zooms smoothly, then settles on the next level the way it went; a small move goes back', () => {
  assert.equal(settleLevel(1, 1.3), 2.4)
  assert.equal(settleLevel(2.4, 1.9), 1)
  assert.equal(settleLevel(1, 1.05), 1)
  assert.equal(settleLevel(2.4, 4.9), 5)
  const zs = createWebZoom()
  let t = 0
  for (let k = 0; k < 6; k++) { zoomWheel(zs, { dy: -6, ctrl: false, at: { x: 0, y: 0 } }, t); t = run(zs, t, 16) }
  assert.ok(zs.zt > 1 && zs.zt < 2.4 && zs.snapAt > 0)
  t = run(zs, t, 1500)
  assert.equal(zs.snapAt, 0)
  assert.equal(zs.z, 2.4)
})

test('the point under the pointer stays where it is while the zoom changes', () => {
  const zs = createWebZoom()
  const at = { x: 120, y: -60 }
  const w = { x: at.x, y: at.y }
  zoomWheel(zs, { dy: -100, ctrl: false, at }, 0)
  for (let t = 0; t < 600; t += 16) {
    stepZoom(zs, t + 16, 16, BOX)
    const v = view(zs, w)
    assert.ok(Math.hypot(v.x - at.x, v.y - at.y) < 0.01, `at ${t} ms: ${v.x},${v.y}`)
  }
})

test('never farther out than the whole web, and the view stays on the web: at the whole web the camera is at the middle', () => {
  const zs = createWebZoom()
  zoomWheel(zs, { dy: 100, ctrl: false, at: { x: 300, y: 100 } }, 0)
  run(zs, 0, 800)
  assert.equal(zs.z, 1)
  assert.deepEqual(zs.cam, { x: 0, y: 0 })
  zoomWheel(zs, { dy: -100, ctrl: false, at: { x: 480, y: 240 } }, 1000)
  run(zs, 1000, 1500)
  zoomDown(zs, { x: 0, y: 0 }, 3000)
  zoomMove(zs, { x: -5000, y: -5000 }, 3016)
  zoomUp(zs, 3200)
  run(zs, 3200, 1000)
  const reach = side => side / 2 * (1 - 1 / zs.z) + 40 * (zs.z - 1) / zs.z
  assert.ok(Math.abs(zs.cam.x) <= reach(BOX.w) + 1e-6 && Math.abs(zs.cam.y) <= reach(BOX.h) + 1e-6)
  assert.ok(Math.abs(zs.cam.x - reach(BOX.w)) < 1e-6)
})

test('a drag pans and keeps a little speed; one that rests before it ends keeps none; a click does not move', () => {
  const zs = createWebZoom()
  zoomWheel(zs, { dy: -100, ctrl: false, at: { x: 0, y: 0 } }, 0)
  let t = run(zs, 0, 1500)
  zoomDown(zs, { x: 0, y: 0 }, t)
  zoomMove(zs, { x: -20, y: 0 }, t + 16)
  zoomMove(zs, { x: -40, y: 0 }, t + 32)
  const moved = zoomUp(zs, t + 40)
  assert.equal(moved, 40)
  const cam = zs.cam.x
  t = run(zs, t + 40, 300)
  assert.ok(zs.cam.x > cam + 40 / zs.z, 'it glides on after the drag')
  zoomDown(zs, { x: 0, y: 0 }, t)
  zoomMove(zs, { x: -20, y: 0 }, t + 16)
  zoomUp(zs, t + 200)
  assert.deepEqual(zs.vel, { x: 0, y: 0 })
  zoomDown(zs, { x: 5, y: 5 }, t + 300)
  assert.equal(zoomUp(zs, t + 310), 0)
})

test('a double-click glides back to the whole web, with the camera at the middle', () => {
  const zs = createWebZoom()
  zoomWheel(zs, { dy: -100, ctrl: false, at: { x: 200, y: 80 } }, 0)
  zoomWheel(zs, { dy: -100, ctrl: false, at: { x: 200, y: 80 } }, 10)
  let t = run(zs, 0, 1500)
  assert.equal(zs.z, ZOOM_LEVELS[2])
  zoomHome(zs, { x: -100, y: 40 }, t)
  t = run(zs, t, 900)
  assert.equal(zs.z, 1)
  assert.ok(Math.abs(zs.cam.x) < 1e-6 && Math.abs(zs.cam.y) < 1e-6)
  assert.equal(isZoomed(zs), false)
})

test('reduced motion: the zoom goes to its level at once', () => {
  const zs = createWebZoom()
  zoomWheel(zs, { dy: -100, ctrl: false, at: { x: 0, y: 0 } }, 0)
  stepZoom(zs, 16, 16, BOX, true)
  assert.equal(zs.z, 2.4)
  zoomWheel(zs, { dy: -30, ctrl: false, at: { x: 0, y: 0 } }, 32)
  stepZoom(zs, 48, 16, BOX, true)
  assert.equal(zs.z, 5)
})
