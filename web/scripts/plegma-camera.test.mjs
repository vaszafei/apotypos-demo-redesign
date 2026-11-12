import { test } from 'node:test'
import assert from 'node:assert/strict'
import { regionBox, frameStory, frameTheme, frameHome, framePair, toScreen, poseAt, startFlight, cameraAt, redirectFlight, flightDone, PLEGMA_REGION, PLEGMA_Z_FOCUS, PLEGMA_FLIGHT_MIN, PLEGMA_FLIGHT_MAX } from '../app/utils/plegma-camera.ts'

const W = 1440
const H = 900
const inRegion = (p, pad = 0) => p.x >= PLEGMA_REGION.x0 * W - pad && p.x <= PLEGMA_REGION.x1 * W + pad && p.y >= PLEGMA_REGION.y0 * H - pad && p.y <= PLEGMA_REGION.y1 * H + pad
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)

test('a story is framed at the center of the top-left map region', () => {
  const cam = frameStory({ x: 5000, y: 300 }, W, H)
  const at = toScreen(cam, W, H, { x: 5000, y: 300 })
  const box = regionBox(W, H)
  near(at.x, box.cx)
  near(at.y, box.cy)
  assert.ok(box.cx < W / 2 && box.cy < H / 2)
  assert.ok(cam.z <= PLEGMA_Z_FOCUS && cam.z > 2)
})

test('a theme is framed with all its stories inside the map region', () => {
  const stories = Array.from({ length: 25 }, (_, i) => ({ x: 400 + i * 150, y: 100 + ((i * 337) % 1000) }))
  const cam = frameTheme(stories, W, H)
  for (const s of stories) assert.ok(inRegion(toScreen(cam, W, H, s)), `${s.x},${s.y}`)
})

test('a theme spread over the whole map still fits, at a small zoom', () => {
  const stories = [{ x: 0, y: 0 }, { x: 5000, y: 1200 }, { x: 2500, y: 600 }]
  const cam = frameTheme(stories, W, H)
  assert.ok(cam.z < 0.3)
  for (const s of stories) assert.ok(inRegion(toScreen(cam, W, H, s)))
})

test('Home frames its webs on the whole screen', () => {
  const webs = [{ x: 4400, y: 100 }, { x: 5200, y: 900 }, { x: 4800, y: 500 }]
  const cam = frameHome(webs, W, H)
  for (const s of webs) {
    const p = toScreen(cam, W, H, s)
    assert.ok(p.x > 0 && p.x < W && p.y > 0 && p.y < H)
  }
  assert.ok(cam.z <= 1)
})

test('a compared pair that is near fits both inside the map region; a pair months apart keeps the first story', () => {
  const a = { x: 3000, y: 300 }
  const close = framePair(a, { x: 3300, y: 600 }, W, H)
  assert.equal(close.together, true)
  assert.ok(inRegion(toScreen(close.camera, W, H, a)) && inRegion(toScreen(close.camera, W, H, { x: 3300, y: 600 })))
  const far = framePair(a, { x: 3000 + 90 * 60, y: 900 }, W, H)
  assert.equal(far.together, false)
  assert.deepEqual(far.camera, frameStory(a, W, H))
})

test('the flight starts at the first framing, ends at the second and is zoomed out in the middle', () => {
  const a = frameHome([{ x: 4400, y: 100 }, { x: 5200, y: 900 }], W, H)
  const b = frameStory({ x: 1500, y: 700 }, W, H)
  const flight = startFlight(a, b, 1000, W)
  assert.deepEqual(cameraAt(flight, 1000, W), a)
  assert.deepEqual(cameraAt(flight, 1000 + flight.dur, W), b)
  const mid = cameraAt(flight, 1000 + flight.dur / 2, W)
  assert.ok(mid.z < a.z && mid.z < b.z, `${mid.z} against ${a.z} and ${b.z}`)
  assert.equal(flightDone(flight, 1000 + flight.dur), true)
  assert.equal(flightDone(flight, 1000 + flight.dur - 1), false)
})

test('a longer distance gives a longer flight, and a longer flight dips deeper', () => {
  const from = { x: 0, y: 0, z: 1 }
  const short = startFlight(from, { x: 300, y: 0, z: 1 }, 0, W)
  const long = startFlight(from, { x: 6000, y: 0, z: 1 }, 0, W)
  assert.ok(long.dur > short.dur)
  assert.ok(poseAt(from, long.b, 0.5, W).z < poseAt(from, short.b, 0.5, W).z)
  assert.ok(long.dur <= PLEGMA_FLIGHT_MAX && short.dur >= PLEGMA_FLIGHT_MIN)
})

test('a flight asked during a flight starts from where the camera is', () => {
  const a = { x: 0, y: 0, z: 1 }
  const b = { x: 4000, y: 800, z: 3 }
  const first = startFlight(a, b, 0, W)
  const t = first.dur / 2
  const here = cameraAt(first, t, W)
  const second = redirectFlight(first, a, { x: 100, y: 100, z: 2 }, t, W)
  assert.deepEqual(second.a, here)
  assert.notDeepEqual(second.a, a)
  const after = redirectFlight(first, b, a, first.dur + 5, W)
  assert.deepEqual(after.a, b)
})

test('covers AE4: with reduced motion the flight is one step to the target', () => {
  const a = { x: 0, y: 0, z: 1 }
  const b = { x: 4000, y: 800, z: 3 }
  const flight = startFlight(a, b, 500, W, true)
  assert.equal(flight.dur, 0)
  assert.deepEqual(cameraAt(flight, 500, W), b)
  assert.equal(flightDone(flight, 500), true)
})
