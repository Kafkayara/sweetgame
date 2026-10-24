import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, initialGameState, planNextTransition, isBusy } from '../app/game/reducer.ts'
import type { GameState, StepToken } from '../app/game/reducer.ts'
import { collapseAndFillBoard, findMatchesOnBoard, determineSpecialCreates, findMatchGroups, getCombinationCells } from '../app/game/engine.ts'
import type { Board } from '../app/game/engine.ts'

const first = { row: 0, column: 2 }
const second = { row: 1, column: 2 }
function board(): Board {
  return Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ({ id: `${r}:${c}`, type: (r + c) % 6, special: null })))
}
function fixture(): Board {
  const b = board()
  b[0][1]!.type = 0
  b[0][2]!.type = 1
  b[1][2]!.type = 0
  return b
}
function reset(b = fixture(), mode: 'target' | 'unlimited' = 'target'): GameState {
  return gameReducer(initialGameState(), { type: 'reset', board: b, level: 0, gameMode: mode })
}
const token = (s: GameState): StepToken => ({ session: s.session, revision: s.revision })
const animate = (s: GameState) => gameReducer(s, { type: 'animation-finished', token: token(s) })
function advance(s: GameState, refill?: (b: Board) => Board) {
  const next = planNextTransition(s, refill)
  assert.ok(next)
  return gameReducer(s, { type: 'advance', token: token(s), next })
}
function swapping(s = reset()) { return gameReducer(s, { type: 'swap', first, second }) }

// Fixed seed makes cascades reproducible without mocking global randomness.
function seededRefill(seed = 42) {
  let serial = 0
  return (b: Board) => collapseAndFillBoard(b, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return { id: `new:${serial++}`, type: (seed >>> 16) % 6, special: null }
  })
}

test('rapid input locks atomically in reducer; click selection also uses the current state', () => {
  let s = reset()
  s = gameReducer(s, { type: 'click', position: first })
  assert.deepEqual(s.selectedCandy, first)
  s = gameReducer(s, { type: 'click', position: second })
  assert.equal(s.phase, 'swapping')
  assert.equal(s.selectedCandy, null)
  assert.equal(gameReducer(s, { type: 'swap', first, second }), s)
  assert.equal(gameReducer(s, { type: 'click', position: first }), s)
  assert.equal(gameReducer(s, { type: 'swap', first: { row: -1, column: 0 }, second }), s)
})

test('cascade waits for each rendered step, scores once, spends exactly one move', () => {
  let s = swapping()
  let refills = 0
  const randomRefill = seededRefill()
  const refill = (b: Board) => {
    // First refill guarantees another row match; subsequent fills use a fixed seed.
    if (refills++ === 0) {
      let id = 0
      return collapseAndFillBoard(b, () => ({ id: `chain:${id++}`, type: 5, special: null }))
    }
    return randomRefill(b)
  }
  assert.equal(planNextTransition(s), null)
  assert.equal(s.moves, 30)
  let pops = 0, earned = 0
  for (let i = 0; i < 100 && isBusy(s); i++) {
    assert.equal(s.settled, false)
    assert.equal(planNextTransition(s), null)
    s = animate(s)
    const next = planNextTransition(s, refill)!
    assert.ok(next)
    const action = { type: 'advance' as const, token: token(s), next }
    const old = s
    s = gameReducer(s, action)
    assert.equal(gameReducer(s, action), s, 'duplicate callbacks must not double score')
    if (next.phase === 'popping') {
      pops++
      earned += next.gained
      assert.equal(s.moves, 29)
      assert.equal(s.combo, pops)
    }
    assert.notEqual(s, old)
  }
  assert.ok(!isBusy(s), 'cascade must terminate')
  assert.ok(pops >= 2, 'fixture must exercise an actual chained cascade')
  assert.equal(s.score, earned)
  assert.equal(s.moves, 29)
  assert.equal(findMatchesOnBoard(s.board).size, 0)
})

test('late animation, planning and hint actions are ignored after restart even at same revision', () => {
  const old = animate(swapping())
  const next = planNextTransition(old)!
  const fresh = swapping(gameReducer(old, { type: 'reset', board: fixture(), level: 1, gameMode: 'target' }))
  assert.equal(old.revision, fresh.revision)
  assert.notEqual(old.session, fresh.session)
  assert.equal(gameReducer(fresh, { type: 'animation-finished', token: token(old) }), fresh)
  assert.equal(gameReducer(fresh, { type: 'advance', token: token(old), next }), fresh)
  const idle = reset()
  assert.equal(gameReducer(idle, { type: 'hint', token: token(old), cells: [first] }), idle)
})

test('invalid swap animates back without consuming moves or adding score', () => {
  const initial = reset(board())
  let s = swapping(initial)
  s = advance(animate(s))
  assert.equal(s.phase, 'reverting')
  assert.deepEqual(s.board, initial.board)
  assert.equal(s.moves, 30)
  assert.equal(s.score, 0)
  assert.equal(planNextTransition(s), null)
  s = advance(animate(s))
  assert.equal(s.phase, 'idle')
})

test('unlimited mode keeps moves during valid matches', () => {
  const s = advance(animate(swapping(reset(fixture(), 'unlimited'))))
  assert.equal(s.phase, 'popping')
  assert.equal(s.moves, 30)
  assert.ok(s.score > 0)
})

test('last move resolves all matches before checking victory or defeat', () => {
  let s = swapping({ ...reset(), moves: 1, score: 990 })
  s = advance(animate(s))
  assert.equal(s.moves, 0)
  assert.equal(s.phase, 'popping')
  assert.ok(s.score >= 1000)
  s = advance(animate(s), () => board())
  assert.equal(s.phase, 'falling')
  assert.equal(planNextTransition(s), null)
  s = advance(animate(s))
  assert.equal(s.phase, 'won')
  let lost = { ...reset(board()), moves: 0, phase: 'falling' as const, settled: true }
  assert.equal(advance(lost).phase, 'lost')
})

test('gravity preserves survivor order, identity, and input board', () => {
  const b = board()
  const original = b[0][0]!
  b[2][0] = null
  b[5][0] = null
  const snapshot = JSON.stringify(b)
  let id = 0
  const filled = collapseAndFillBoard(b, () => ({ id: `fill:${id++}`, type: 4, special: null }))
  assert.equal(filled[2][0]!.id, original.id)
  assert.deepEqual(filled.slice(2).map(row => row[0]!.id), ['0:0', '1:0', '3:0', '4:0', '6:0', '7:0'])
  assert.equal(new Set(filled.flat().map(c => c!.id)).size, 64)
  assert.equal(JSON.stringify(b), snapshot)
})

test('special creation and double color bomb rules survive extraction', () => {
  const b = board()
  for (let c = 0; c < 5; c++) b[0][c]!.type = 4
  const creates = determineSpecialCreates(findMatchGroups(b), null, null, b)
  assert.ok(creates.some(c => c.special === 'color-bomb'))
  b[0][0]!.special = 'color-bomb'
  b[0][1]!.special = 'color-bomb'
  assert.equal(getCombinationCells({ row: 0, column: 0 }, { row: 0, column: 1 }, 'color-color', b).size, 64)
})

test('reducer and planning leave the previous snapshot unchanged', () => {
  const s = animate(swapping())
  const snapshot = JSON.stringify({ ...s, poppingCells: [...s.poppingCells] })
  const action = { type: 'advance' as const, token: token(s), next: planNextTransition(s)! }
  assert.deepEqual(gameReducer(s, action), gameReducer(s, action))
  assert.equal(JSON.stringify({ ...s, poppingCells: [...s.poppingCells] }), snapshot)
})

test('special swap spends one move and preserves the ordinary cascade scoring afterward', () => {
  const b = board()
  b[0][0]!.special = 'color-bomb'
  b[0][1]!.special = 'color-bomb'
  let s = gameReducer(reset(b), { type: 'swap', first: { row: 0, column: 0 }, second: { row: 0, column: 1 } })
  s = advance(animate(s))
  assert.equal(s.phase, 'popping')
  assert.equal(s.poppingCells.size, 64)
  assert.equal(s.score, 1280)
  assert.equal(s.moves, 29)
  const cascade = board()
  for (let c = 0; c < 3; c++) cascade[0][c]!.type = 5
  s = advance(animate(s), () => cascade)
  assert.equal(s.phase, 'falling')
  s = advance(animate(s))
  assert.equal(s.gained, 30)
  assert.equal(s.moves, 29)
})

test('a mode reset during a fall replaces all gameplay fields and rejects the old completion', () => {
  let s = advance(animate(swapping()))
  s = advance(animate(s), seededRefill())
  assert.equal(s.phase, 'falling')
  const oldToken = token(s)
  const fresh = gameReducer(s, { type: 'reset', board: board(), level: 3, gameMode: 'unlimited' })
  assert.equal(fresh.score, 0)
  assert.equal(fresh.moves, 24)
  assert.equal(fresh.phase, 'idle')
  assert.equal(fresh.poppingCells.size, 0)
  assert.equal(fresh.gameMode, 'unlimited')
  assert.equal(gameReducer(fresh, { type: 'animation-finished', token: oldToken }), fresh)
})

test('matched candies stay in the rendered board until the whole explosion finishes', () => {
  const s = advance(animate(swapping()))
  assert.equal(s.phase, 'popping')
  assert.ok(s.poppingCells.size > 0)
  for (const key of s.poppingCells) {
    const [row, column] = key.split(',').map(Number)
    assert.ok(s.board[row][column], 'original candy must stay mounted during its explosion')
  }
  assert.equal(planNextTransition(s), null, 'gravity must not run before explosion completion')
  assert.equal(advance(animate(s), seededRefill()).phase, 'falling')
})
