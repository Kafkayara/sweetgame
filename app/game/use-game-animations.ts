'use client'

import { useLayoutEffect, useRef } from 'react'
import type { RefObject, Dispatch } from 'react'
import type { GameState, GameAction } from './reducer.ts'
import { isBusy } from './reducer.ts'
import { planCandyMotion, motionDuration, afterAnimations, createBrowserFrameClock } from './motion.ts'
import type { CandyPosition } from './motion.ts'

export function useGameAnimations(state: GameState, containerRef: RefObject<HTMLDivElement | null>, dispatch: Dispatch<GameAction>) {
  const layoutRef = useRef({ session: -1, revision: -1, previous: new Map<string, CandyPosition>(), next: new Map<string, CandyPosition>() })
  const { session, revision, phase, board, poppingCells } = state

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const elements = [...container.querySelectorAll<HTMLElement>('[data-motion-id]')]
    // Batch layout reads before any animation writes to avoid layout thrashing.
    const measured = new Map(elements.map(element => [element.dataset.motionId!, {
      x: element.offsetLeft, y: element.offsetTop, height: element.offsetHeight,
      column: Number(element.dataset.column),
    }]))
    const cached = layoutRef.current
    const sameStep = cached.session === session && cached.revision === revision
    const previous = cached.session !== session ? new Map<string, CandyPosition>()
      : sameStep ? cached.previous : cached.next
    layoutRef.current = { session, revision, previous, next: measured }
    if (!isBusy(state)) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animations: Animation[] = []
    if (!reducedMotion) {
      if (phase === 'popping') {
        container.querySelectorAll<HTMLElement>('[data-popping="true"]').forEach(element => {
          animations.push(element.animate([
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(1.13)', opacity: 1, offset: 0.4 },
            { transform: 'scale(0.1)', opacity: 0 },
          ], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }))
        })
      } else {
        const first = elements[0]
        const pitch = first ? first.offsetHeight + parseFloat(getComputedStyle(first.parentElement!).rowGap || '0') : 1
        const motions = planCandyMotion(previous, measured, pitch)
        const byId = new Map(elements.map(element => [element.dataset.motionId!, element]))
        const duration = motionDuration(phase, motions, pitch)
        motions.forEach(motion => {
          const element = byId.get(motion.id)!
          animations.push(element.animate([
            { transform: `translate3d(${motion.dx}px, ${motion.dy}px, 0)`, opacity: motion.entering ? 0.3 : 1 },
            { transform: 'translate3d(0, 0, 0)', opacity: 1 },
          ], {
            duration, fill: 'both',
            easing: phase === 'falling' ? 'cubic-bezier(.32,0,.6,1)' : 'cubic-bezier(.22,.68,.25,1)',
          }))
        })
      }
    }
    return afterAnimations(animations, () => {
      dispatch({ type: 'animation-finished', token: { session, revision } })
    }, createBrowserFrameClock(window))
    // settled/selection/hints don't restart the committed animation step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, revision, phase, board, poppingCells, containerRef, dispatch])
}
