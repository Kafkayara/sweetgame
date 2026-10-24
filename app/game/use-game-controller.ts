'use client'

import { useEffect, useReducer, useCallback } from 'react'
import { gameReducer, initialGameState, planNextTransition } from './reducer.ts'
import type { GameMode } from './reducer.ts'
import { generateInitialBoard, findPossibleMoveOnBoard } from './engine.ts'

export function useGameController() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState)

  useEffect(() => {
    dispatch({ type: 'reset', board: generateInitialBoard(), level: 0, gameMode: 'target' })
  }, [])

  useEffect(() => {
    const next = planNextTransition(state)
    if (next) dispatch({ type: 'advance', token: { session: state.session, revision: state.revision }, next })
  }, [state])

  useEffect(() => {
    if (state.phase !== 'idle' || !state.board.length) return
    const token = { session: state.session, revision: state.revision }
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      const move = findPossibleMoveOnBoard(state.board)
      if (move) dispatch({ type: 'hint', token, cells: [move.first, move.second] })
      clearTimer = setTimeout(() => dispatch({ type: 'hint', token, cells: [] }), 1500)
    }, 5000)
    return () => { clearTimeout(timer); clearTimeout(clearTimer) }
  }, [state.session, state.revision, state.phase, state.board, state.selectedCandy])

  const restartGame = useCallback((level: number, gameMode: GameMode) => {
    dispatch({ type: 'reset', board: generateInitialBoard(), level, gameMode })
  }, [])

  return { state, dispatch, restartGame }
}
