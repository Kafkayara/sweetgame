import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCandyMotion, afterAnimations, createBrowserFrameClock } from '../app/game/motion.ts'
import type { CandyPosition } from '../app/game/motion.ts'

const position = (y: number, column = 0): CandyPosition => ({ x: column * 50, y, height: 44, column })
test('falling uses candy identity across rows and stacks incoming candies above board', () => {
  const previous = new Map([['survivor', position(0)], ['still', position(150, 1)]])
  const next = new Map([['a', position(0)], ['b', position(50)], ['survivor', position(100)], ['still', position(150, 1)]])
  const motions = planCandyMotion(previous, next, 50)
  assert.deepEqual(motions, [
    { id: 'a', dx: 0, dy: -100, entering: true },
    { id: 'b', dx: 0, dy: -100, entering: true },
    { id: 'survivor', dx: 0, dy: -100, entering: false },
  ])
  assert.equal(next.get('a')!.y + motions[0].dy, -100)
  assert.equal(next.get('b')!.y + motions[1].dy, -50)
})
function deferred() {
  let resolve!: () => void
  const finished = new Promise<void>(done => { resolve = done })
  let cancelled = false
  return { finished, resolve, cancel: () => { cancelled = true }, get cancelled() { return cancelled } }
}
function clock() {
  let next = 0
  const callbacks = new Map<number, () => void>()
  return {
    request(callback: () => void) { callbacks.set(++next, callback); return next },
    cancel(id: number) { callbacks.delete(id) },
    tick() { const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback()) },
  }
}

test('render barrier waits for ALL finished animations and then requestAnimationFrame', async () => {
  const a = deferred(), b = deferred(), frames = clock()
  let advances = 0
  afterAnimations([a, b], () => { advances++ }, frames)
  a.resolve(); await Promise.resolve(); frames.tick()
  assert.equal(advances, 0)
  b.resolve(); await Promise.resolve(); await Promise.resolve()
  assert.equal(advances, 0)
  frames.tick()
  assert.equal(advances, 1)
})

test('reset/unmount cleanup cancels animations and prevents an old completion', async () => {
  const a = deferred(), frames = clock()
  let advances = 0
  const cancel = afterAnimations([a], () => { advances++ }, frames)
  cancel(); a.resolve(); await Promise.resolve(); await Promise.resolve(); frames.tick()
  assert.ok(a.cancelled)
  assert.equal(advances, 0)
})

test('Strict Mode cleanup also cancels an already queued frame; replacement can finish', async () => {
  const frames = clock()
  let advances = 0
  const cancel = afterAnimations([], () => { advances++ }, frames)
  await Promise.resolve()
  cancel(); frames.tick()
  assert.equal(advances, 0)
  afterAnimations([], () => { advances++ }, frames)
  await Promise.resolve(); frames.tick()
  assert.equal(advances, 1)
})

test('browser frame adapter keeps the Window receiver when cleanup cancels a pending frame', async () => {
  let cancelled: number | null = null
  const browser = {
    requestAnimationFrame(this: unknown, _callback: FrameRequestCallback) {
      assert.equal(this, browser, 'requestAnimationFrame requires the Window receiver')
      return 42
    },
    cancelAnimationFrame(this: unknown, id: number) {
      assert.equal(this, browser, 'cancelAnimationFrame requires the Window receiver')
      cancelled = id
    },
  }
  const cancel = afterAnimations([], () => assert.fail('cancelled step must not advance'), createBrowserFrameClock(browser))
  await Promise.resolve()
  assert.doesNotThrow(cancel)
  assert.equal(cancelled, 42)
})

test('cleanup after a completed frame does not cancel a stale frame ID', async () => {
  const frames = clock()
  let cancelled = 0
  const cancel = afterAnimations([], () => {}, {
    request: frames.request,
    cancel: () => { cancelled++ },
  })
  await Promise.resolve()
  frames.tick()
  cancel()
  assert.equal(cancelled, 0)
})
