import type { Phase } from './reducer.ts'

export interface CandyPosition { x: number; y: number; height: number; column: number }
export interface CandyMotion { id: string; dx: number; dy: number; entering: boolean }

// Layout is read once per committed board, never once per animation frame.
export function planCandyMotion(previous: Map<string, CandyPosition>, next: Map<string, CandyPosition>, pitch: number): CandyMotion[] {
  const enteringPerColumn = new Map<number, number>()
  next.forEach((position, id) => {
    if (!previous.has(id)) enteringPerColumn.set(position.column, (enteringPerColumn.get(position.column) ?? 0) + 1)
  })
  const motions: CandyMotion[] = []
  next.forEach((position, id) => {
    const old = previous.get(id)
    const dx = old ? old.x - position.x : 0
    const dy = old ? old.y - position.y : -(enteringPerColumn.get(position.column) ?? 1) * pitch
    if (dx || dy) motions.push({ id, dx, dy, entering: !old })
  })
  return motions
}

export function motionDuration(phase: Phase, motions: CandyMotion[], pitch: number) {
  if (phase === 'swapping' || phase === 'reverting') return 180
  if (phase === 'shuffling') return 320
  const distance = Math.max(1, ...motions.map(m => Math.abs(m.dy) / Math.max(1, pitch)))
  return Math.min(480, 200 + Math.sqrt(distance) * 90)
}

interface AnimationHandle { finished: Promise<unknown>; cancel: () => void }
interface FrameClock { request: (callback: () => void) => number; cancel: (id: number) => void }

// Browser frame APIs require Window as their receiver, even when used by an adapter.
export function createBrowserFrameClock(browser: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>): FrameClock {
  return {
    request: callback => browser.requestAnimationFrame(callback),
    cancel: id => browser.cancelAnimationFrame(id),
  }
}

// Every animation must finish AND a browser frame must pass before advancing the reducer.
// Cleanup prevents an old Promise/rAF from dispatching after reset, unmount or Strict Mode replay.
export function afterAnimations(animations: AnimationHandle[], complete: () => void, clock: FrameClock) {
  let active = true
  let frame: number | null = null
  void Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (!active) return
    frame = clock.request(() => {
      frame = null
      if (active) complete()
    })
  }).catch(() => { /* Cancellation belongs to the step that replaced this one. */ })
  return () => {
    active = false
    if (frame !== null) clock.cancel(frame)
    animations.forEach(animation => animation.cancel())
  }
}
