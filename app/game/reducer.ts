import {
  BOARD_SIZE, LEVELS, SCORE_PER_CANDY, cloneBoard, isAdjacent,
  findMatchesOnBoard, findMatchGroups, determineSpecialCreates, expandSpecialEffects,
  getSpecialCombination, getCombinationCells, collapseAndFillBoard, createCandy,
  hasPossibleMoveOnBoard, generateInitialBoard,
} from './engine.ts'
import type { Board, Pos, SpecialType } from './engine.ts'

export type GameMode = 'target' | 'unlimited'
export type Phase = 'idle' | 'swapping' | 'reverting' | 'popping' | 'falling' | 'shuffling' | 'won' | 'lost'
export interface StepToken { session: number; revision: number }
interface SpecialCreate extends Pos { type: number; special: SpecialType }
export interface GameState extends StepToken {
  board: Board
  score: number
  moves: number
  level: number
  gameMode: GameMode
  phase: Phase
  settled: boolean
  selectedCandy: Pos | null
  idleHintCells: Pos[]
  dragOverPos: Pos | null
  swap: { first: Pos; second: Pos } | null
  poppingCells: Set<string>
  specialCreates: SpecialCreate[]
  combo: number
  gained: number
  detonatesSpecial: boolean
  message: string
}
export function initialGameState(): GameState {
  return {
    session: 0, revision: 0, board: [], score: 0, moves: LEVELS[0].moves,
    level: 0, gameMode: 'target', phase: 'idle', settled: true,
    selectedCandy: null, idleHintCells: [], dragOverPos: null, swap: null,
    poppingCells: new Set(), specialCreates: [], combo: 0, gained: 0,
    detonatesSpecial: false, message: 'Pilih atau geser dua permen yang bersebelahan.',
  }
}
export function isBusy(state: GameState) {
  return !['idle', 'won', 'lost'].includes(state.phase)
}
export type Transition =
  | { phase: 'popping'; cells: Set<string>; creates: SpecialCreate[]; gained: number; special: boolean; combo: number }
  | { phase: 'falling' | 'shuffling'; board: Board }
  | { phase: 'reverting' | 'idle' | 'won' | 'lost' }
export type GameAction =
  | { type: 'reset'; board: Board; level: number; gameMode: GameMode }
  | { type: 'click'; position: Pos }
  | { type: 'swap'; first: Pos; second: Pos }
  | { type: 'hint'; cells: Pos[]; token: StepToken }
  | { type: 'clear-hint' }
  | { type: 'drag-over'; position: Pos | null }
  | { type: 'animation-finished'; token: StepToken }
  | { type: 'advance'; token: StepToken; next: Transition }

function matchesToken(state: GameState, token: StepToken) {
  return state.session === token.session && state.revision === token.revision
}
function swapBoard(board: Board, first: Pos, second: Pos) {
  const swapped = cloneBoard(board)
  ;[swapped[first.row][first.column], swapped[second.row][second.column]] =
    [swapped[second.row][second.column], swapped[first.row][first.column]]
  return swapped
}
function beginSwap(state: GameState, first: Pos, second: Pos): GameState {
  if (state.phase !== 'idle' || !isAdjacent(first, second) ||
      !state.board[first.row]?.[first.column] || !state.board[second.row]?.[second.column]) return state
  return {
    ...state, board: swapBoard(state.board, first, second), swap: { first, second },
    phase: 'swapping', settled: false, revision: state.revision + 1,
    selectedCandy: null, idleHintCells: [], dragOverPos: null, combo: 0,
  }
}

// Pure reducer: random boards/IDs are prepared by the controller, never in a replayable reducer.
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'reset':
      return {
        ...initialGameState(), session: state.session + 1, board: action.board,
        level: action.level, moves: LEVELS[action.level].moves, gameMode: action.gameMode,
      }
    case 'click': {
      if (state.phase !== 'idle' || !state.board[action.position.row]?.[action.position.column]) return state
      const selected = state.selectedCandy
      if (selected && isAdjacent(selected, action.position)) return beginSwap(state, selected, action.position)
      const same = selected?.row === action.position.row && selected?.column === action.position.column
      return { ...state, selectedCandy: same ? null : action.position, idleHintCells: [] }
    }
    case 'swap': return beginSwap(state, action.first, action.second)
    case 'hint':
      return matchesToken(state, action.token) && state.phase === 'idle'
        ? { ...state, idleHintCells: action.cells } : state
    case 'clear-hint': return state.idleHintCells.length ? { ...state, idleHintCells: [] } : state
    case 'drag-over':
      return state.phase === 'idle' ? { ...state, dragOverPos: action.position } : state
    case 'animation-finished':
      return matchesToken(state, action.token) && isBusy(state) && !state.settled
        ? { ...state, settled: true } : state
    case 'advance': {
      if (!matchesToken(state, action.token) || !state.settled || !isBusy(state)) return state
      const next = action.next
      const base = { ...state, revision: state.revision + 1, settled: false }
      if (next.phase === 'popping' && (state.phase === 'swapping' || state.phase === 'falling')) {
        return {
          ...base, phase: 'popping', poppingCells: next.cells, specialCreates: next.creates,
          score: state.score + next.gained, gained: next.gained, combo: next.combo,
          moves: state.moves - (state.phase === 'swapping' && state.gameMode === 'target' ? 1 : 0),
          detonatesSpecial: next.special,
          message: state.combo ? `COMBO x${state.combo + 1}` : `Match! +${next.gained}`,
        }
      }
      if (next.phase === 'falling' && state.phase === 'popping') {
        return { ...base, phase: 'falling', board: next.board, poppingCells: new Set(), specialCreates: [], detonatesSpecial: false }
      }
      if (next.phase === 'reverting' && state.phase === 'swapping' && state.swap) {
        return { ...base, phase: 'reverting', board: swapBoard(state.board, state.swap.first, state.swap.second), message: 'Swap itu tidak menghasilkan match.' }
      }
      if (next.phase === 'shuffling' && state.phase === 'falling') {
        return { ...base, phase: 'shuffling', board: next.board, message: 'Tidak ada kombinasi tersisa. Mengacak papan...' }
      }
      if (['idle', 'won', 'lost'].includes(next.phase) && ['falling', 'reverting', 'shuffling'].includes(state.phase)) {
        const phase = next.phase as 'idle' | 'won' | 'lost'
        return {
          ...base, phase, settled: true, swap: null,
          message: phase === 'won' ? 'Target tercapai! Kamu menang.' : phase === 'lost' ? 'Langkah habis.'
            : state.phase === 'reverting' ? state.message : 'Nice! Cari kombinasi berikutnya.',
        }
      }
      return state
    }
  }
}

function shuffledBoard(board: Board): Board {
  const flat = board.flat().filter(cell => cell !== null)
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[flat[i], flat[j]] = [flat[j], flat[i]]
    }
    const next = Array.from({ length: BOARD_SIZE }, (_, r) => flat.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE))
    if (!findMatchesOnBoard(next).size && hasPossibleMoveOnBoard(next)) return next
  }
  return generateInitialBoard()
}

// Called only AFTER the committed step's animations finish. No async cascade loop.
export function planNextTransition(state: GameState, refill: (board: Board) => Board = collapseAndFillBoard): Transition | null {
  if (!state.settled || !isBusy(state)) return null
  if (state.phase === 'reverting' || state.phase === 'shuffling') return { phase: 'idle' }
  if (state.phase === 'popping') {
    const cleared = cloneBoard(state.board)
    state.poppingCells.forEach(key => {
      const [r, c] = key.split(',').map(Number)
      cleared[r][c] = null
    })
    cleared.forEach(row => row.forEach(cell => { if (cell) delete cell.justCreated }))
    for (const special of state.specialCreates) {
      const candy = createCandy(special.type, special.special)
      cleared[special.row][special.column] = {
        ...candy, id: state.board[special.row][special.column]?.id ?? candy.id, justCreated: true,
      }
    }
    return { phase: 'falling', board: refill(cleared) }
  }
  const { board, swap } = state
  const combination = state.phase === 'swapping' && swap ? getSpecialCombination(swap.first, swap.second, board) : null
  const matches = combination && swap
    ? getCombinationCells(swap.first, swap.second, combination, board) : findMatchesOnBoard(board)
  if (matches.size) {
    const cells = combination ? matches : expandSpecialEffects(matches, board)
    const combo = state.combo + 1
    return {
      phase: 'popping', cells, combo: combination ? 0 : combo,
      creates: combination ? [] : determineSpecialCreates(findMatchGroups(board), state.combo === 0 ? swap?.first ?? null : null, state.combo === 0 ? swap?.second ?? null : null, board),
      gained: Math.round(cells.size * SCORE_PER_CANDY * (combination ? 2 : 1 + (combo - 1) * 0.5)),
      special: !!combination || [...cells].some(key => { const [r, c] = key.split(',').map(Number); return !!board[r][c]?.special }),
    }
  }
  if (state.phase === 'swapping') return { phase: 'reverting' }
  if (state.gameMode === 'target') {
    if (state.score >= LEVELS[state.level].target) return { phase: 'won' }
    if (state.moves <= 0) return { phase: 'lost' }
  }
  return hasPossibleMoveOnBoard(board) ? { phase: 'idle' } : { phase: 'shuffling', board: shuffledBoard(board) }
}
