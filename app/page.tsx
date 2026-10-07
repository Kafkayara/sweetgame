'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

// ============================================================================
// KONSTANTA & TIPE DATA
// ============================================================================

const BOARD_SIZE = 8
const CANDY_TYPES = 6

const STARTING_MOVES = 30
const TARGET_SCORE = 1000
const SCORE_PER_CANDY = 10

const POP_DELAY = 220
const FALL_DELAY = 480
const HINT_DELAY = 5000

export type SpecialType =
  | 'color-bomb'
  | 'striped-horizontal'
  | 'striped-vertical'
  | 'wrapped'
  | null

export interface Candy {
  id: string
  type: number
  special: SpecialType
  justCreated?: boolean
}

interface Pos {
  row: number
  column: number
}

export interface PastelCandyConfig {
  name: string
  bg: string
  border: string
  glow: string
  shardColor: string
}

export const PASTEL_CANDIES: PastelCandyConfig[] = [
  {
    name: 'Rose',
    bg: 'bg-rose-400',
    border: 'border-b-rose-600',
    glow: 'shadow-rose-400/40',
    shardColor: '#fb7185',
  },
  {
    name: 'Emerald',
    bg: 'bg-emerald-400',
    border: 'border-b-emerald-600',
    glow: 'shadow-emerald-400/40',
    shardColor: '#34d399',
  },
  {
    name: 'Amber',
    bg: 'bg-amber-400',
    border: 'border-b-amber-600',
    glow: 'shadow-amber-400/40',
    shardColor: '#fbbf24',
  },
  {
    name: 'Sky',
    bg: 'bg-sky-400',
    border: 'border-b-sky-600',
    glow: 'shadow-sky-400/40',
    shardColor: '#38bdf8',
  },
  {
    name: 'Violet',
    bg: 'bg-violet-400',
    border: 'border-b-violet-600',
    glow: 'shadow-violet-400/40',
    shardColor: '#a78bfa',
  },
  {
    name: 'Fuchsia',
    bg: 'bg-fuchsia-400',
    border: 'border-b-fuchsia-600',
    glow: 'shadow-fuchsia-400/40',
    shardColor: '#e879f9',
  },
]

const SHARD_COLORS = PASTEL_CANDIES.map(c => c.shardColor)

const COMBO_LABELS: Record<number, string> = {
  2: 'Manis!',
  3: 'Lezat!',
  4: 'Luar Biasa!',
}
const COMBO_LABEL_MAX = 'Fantastis!'

let candyIdCounter = 0
function getNextId() {
  return `c_${Date.now()}_${++candyIdCounter}`
}

function randomCandy(): number {
  return Math.floor(Math.random() * CANDY_TYPES)
}

function createCandy(type = randomCandy(), special: SpecialType = null): Candy {
  return {
    id: getNextId(),
    type,
    special,
  }
}

function cloneBoard(b: (Candy | null)[][]): (Candy | null)[][] {
  return b.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function isAdjacent(first: Pos, second: Pos): boolean {
  const rowDiff = Math.abs(first.row - second.row)
  const colDiff = Math.abs(first.column - second.column)
  return rowDiff + colDiff === 1
}

function sameCandyType(first: Candy | null, second: Candy | null): boolean {
  if (!first || !second) return false
  if (first.special === 'color-bomb' || second.special === 'color-bomb') return false
  return first.type === second.type
}

function isStriped(candy: Candy | null): boolean {
  if (!candy) return false
  return candy.special === 'striped-horizontal' || candy.special === 'striped-vertical'
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createCandyLabel(row: number, column: number, candy: Candy | null): string {
  const position = `Permen baris ${row + 1}, kolom ${column + 1}`
  if (!candy) return position
  if (candy.special === 'color-bomb') return `${position}, bom warna`
  if (candy.special === 'striped-horizontal') return `${position}, permen bergaris horizontal`
  if (candy.special === 'striped-vertical') return `${position}, permen bergaris vertikal`
  if (candy.special === 'wrapped') return `${position}, permen bungkus`
  return `${position}, warna ${PASTEL_CANDIES[candy.type]?.name ?? candy.type}`
}

function computeFallOffsets(boardState: (Candy | null)[][]): number[][] {
  const offsets: number[][] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    offsets.push(new Array(BOARD_SIZE).fill(0))
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    const removedRows: number[] = []
    const survivorRows: number[] = []

    for (let r = 0; r < BOARD_SIZE; r++) {
      if (boardState[r][col] === null) {
        removedRows.push(r)
      } else {
        survivorRows.push(r)
      }
    }

    const emptyCount = removedRows.length
    if (emptyCount === 0) continue

    for (let i = 0; i < survivorRows.length; i++) {
      const originalRow = survivorRows[i]
      const finalRow = emptyCount + i
      let shift = 0
      for (const removedRow of removedRows) {
        if (removedRow < originalRow) {
          shift++
        }
      }
      offsets[finalRow][col] = shift
    }

    for (let finalRow = 0; finalRow < emptyCount; finalRow++) {
      offsets[finalRow][col] = (emptyCount - finalRow) + 3
    }
  }

  return offsets
}

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================

export default function SweetGridGame() {
  // Game mode & stats
  const [gameMode, setGameMode] = useState<'target' | 'unlimited'>('target')
  const [score, setScore] = useState<number>(0)
  const [moves, setMoves] = useState<number>(STARTING_MOVES)
  const [message, setMessage] = useState<string>('Pilih atau drag dua permen yang bersebelahan.')
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [gameWon, setGameWon] = useState<boolean>(false)

  // Board state: 8x8 matrix
  const [board, setBoard] = useState<(Candy | null)[][]>([])

  // Selection & hints
  const [selectedCandy, setSelectedCandy] = useState<Pos | null>(null)
  const [idleHintCells, setIdleHintCells] = useState<Pos[]>([])

  // Animation visual states
  const [poppingCells, setPoppingCells] = useState<Set<string>>(new Set())
  const [landingCandies, setLandingCandies] = useState<Set<string>>(new Set())
  const [animatingSwap, setAnimatingSwap] = useState<{
    first: Pos
    second: Pos
  } | null>(null)

  // Refs untuk asynchronous gameplay & lock
  const boardRef = useRef<(Candy | null)[][]>([])
  const gameLockedRef = useRef<boolean>(false)
  const gameOverRef = useRef<boolean>(false)
  const scoreRef = useRef<number>(0)
  const movesRef = useRef<number>(STARTING_MOVES)
  const gameModeRef = useRef<'target' | 'unlimited'>('target')

  // Drag-and-drop state refs
  const squareBeingDragged = useRef<Pos | null>(null)
  const squareBeingReplaced = useRef<Pos | null>(null)
  const [dragOverPos, setDragOverPos] = useState<Pos | null>(null)

  // Timer refs
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hintClearTimerRef = useRef<NodeJS.Timeout | null>(null)

  // DOM ref untuk particle layer & board container
  const boardContainerRef = useRef<HTMLDivElement | null>(null)
  const particleLayerRef = useRef<HTMLDivElement | null>(null)

  // Sinkronisasi refs
  useEffect(() => {
    boardRef.current = board
  }, [board])
  useEffect(() => {
    scoreRef.current = score
  }, [score])
  useEffect(() => {
    movesRef.current = moves
  }, [moves])
  useEffect(() => {
    gameOverRef.current = gameOver
  }, [gameOver])
  useEffect(() => {
    gameModeRef.current = gameMode
  }, [gameMode])

  // ==========================================================================
  // PARTIKEL & VISUAL FEEDBACK
  // ==========================================================================

  const spawnParticle = (
    className: string,
    x: number,
    y: number,
    tx: number,
    ty: number,
    extraStyle?: React.CSSProperties,
    lifespan = 500,
    rotationDeg?: number
  ) => {
    if (!particleLayerRef.current) return
    const particle = document.createElement('span')
    particle.className = className
    particle.style.left = `${x}px`
    particle.style.top = `${y}px`
    particle.style.setProperty('--tx', `${tx}px`)
    particle.style.setProperty('--ty', `${ty}px`)
    if (rotationDeg !== undefined) {
      particle.style.setProperty('--rot', `${rotationDeg}deg`)
    }
    if (extraStyle) {
      Object.assign(particle.style, extraStyle)
    }
    particleLayerRef.current.appendChild(particle)
    setTimeout(() => particle.remove(), lifespan)
  }

  const spawnPopEffect = (candyData: Candy | null, rect: DOMRect, layerRect: DOMRect) => {
    if (!particleLayerRef.current) return
    const centerX = rect.left + rect.width / 2 - layerRect.left
    const centerY = rect.top + rect.height / 2 - layerRect.top

    const special = candyData?.special ?? null
    const color =
      special === 'color-bomb' ? null : SHARD_COLORS[candyData?.type ?? 0] ?? '#ffffff'
    const isColorBomb = special === 'color-bomb'
    const shardCount = isColorBomb ? 10 : 5
    const sparkCount = isColorBomb ? 8 : 4
    const burstRadius = isColorBomb ? 34 : 22

    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.6
      const distance = burstRadius + Math.random() * 14
      const shardColor = color ?? SHARD_COLORS[i % SHARD_COLORS.length]

      spawnParticle(
        'shard',
        centerX,
        centerY,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        { background: shardColor } as unknown as React.CSSProperties,
        500,
        Math.round(Math.random() * 280 - 140)
      )
    }

    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = 16 + Math.random() * 18
      spawnParticle(
        'spark',
        centerX,
        centerY,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        undefined,
        450
      )
    }

    if (special === 'wrapped') {
      const ring = document.createElement('span')
      ring.className = 'shockwave'
      ring.style.left = `${centerX}px`
      ring.style.top = `${centerY}px`
      particleLayerRef.current.appendChild(ring)
      setTimeout(() => ring.remove(), 500)
    }

    if (special === 'striped-horizontal' || special === 'striped-vertical') {
      const streak = document.createElement('span')
      streak.className =
        special === 'striped-horizontal'
          ? 'streak streak-horizontal'
          : 'streak streak-vertical'
      if (special === 'striped-horizontal') {
        streak.style.top = `${centerY}px`
      } else {
        streak.style.left = `${centerX}px`
      }
      particleLayerRef.current.appendChild(streak)
      setTimeout(() => streak.remove(), 380)
    }
  }

  const spawnBoardFlash = () => {
    if (!particleLayerRef.current) return
    const flash = document.createElement('span')
    flash.className = 'board-flash'
    particleLayerRef.current.appendChild(flash)
    setTimeout(() => flash.remove(), 500)
  }

  const showScorePopup = (points: number, cellsSet: Set<string>) => {
    if (!particleLayerRef.current || points <= 0 || !boardContainerRef.current) return
    const layerRect = particleLayerRef.current.getBoundingClientRect()
    let sumX = 0
    let sumY = 0
    let count = 0

    cellsSet.forEach(posStr => {
      const [r, c] = posStr.split(',').map(Number)
      const el = boardContainerRef.current?.querySelector(`[data-cell="${r}-${c}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        sumX += rect.left + rect.width / 2 - layerRect.left
        sumY += rect.top + rect.height / 2 - layerRect.top
        count++
      }
    })

    if (count === 0) return
    const popup = document.createElement('span')
    popup.className = 'score-popup'
    popup.textContent = `+${points}`
    popup.style.left = `${sumX / count}px`
    popup.style.top = `${sumY / count}px`
    particleLayerRef.current.appendChild(popup)
    setTimeout(() => popup.remove(), 650)
  }

  const showComboPopup = (combo: number) => {
    if (!particleLayerRef.current) return
    const label = COMBO_LABELS[combo] ?? COMBO_LABEL_MAX
    const popup = document.createElement('span')
    popup.className = 'combo-popup'
    popup.textContent = label
    particleLayerRef.current.appendChild(popup)
    setTimeout(() => popup.remove(), 700)
  }

  // ==========================================================================
  // MATCH-3 ALGORITHM (Sama persis dengan app.js)
  // ==========================================================================

  const findMatchesOnBoard = (currentBoard: (Candy | null)[][]): Set<string> => {
    const matches = new Set<string>()

    // Horizontal check
    for (let row = 0; row < BOARD_SIZE; row++) {
      let start = 0
      for (let column = 1; column <= BOARD_SIZE; column++) {
        const current = column < BOARD_SIZE ? currentBoard[row][column] : null
        const previous = currentBoard[row][start]

        if (column < BOARD_SIZE && sameCandyType(current, previous)) {
          continue
        }

        const length = column - start
        if (length >= 3) {
          for (let pos = start; pos < column; pos++) {
            matches.add(`${row},${pos}`)
          }
        }
        start = column
      }
    }

    // Vertical check
    for (let column = 0; column < BOARD_SIZE; column++) {
      let start = 0
      for (let row = 1; row <= BOARD_SIZE; row++) {
        const current = row < BOARD_SIZE ? currentBoard[row][column] : null
        const previous = currentBoard[start][column]

        if (row < BOARD_SIZE && sameCandyType(current, previous)) {
          continue
        }

        const length = row - start
        if (length >= 3) {
          for (let pos = start; pos < row; pos++) {
            matches.add(`${pos},${column}`)
          }
        }
        start = row
      }
    }

    return matches
  }

  const getHorizontalRun = (row: number, column: number, b: (Candy | null)[][]): string[] => {
    const candy = b[row][column]
    if (!candy || candy.special === 'color-bomb') return []
    let start = column
    while (start > 0 && sameCandyType(b[row][start - 1], candy)) {
      start--
    }
    let end = column
    while (end + 1 < BOARD_SIZE && sameCandyType(b[row][end + 1], candy)) {
      end++
    }
    const res: string[] = []
    for (let i = start; i <= end; i++) {
      res.push(`${row},${i}`)
    }
    return res
  }

  const getVerticalRun = (row: number, column: number, b: (Candy | null)[][]): string[] => {
    const candy = b[row][column]
    if (!candy || candy.special === 'color-bomb') return []
    let start = row
    while (start > 0 && sameCandyType(b[start - 1][column], candy)) {
      start--
    }
    let end = row
    while (end + 1 < BOARD_SIZE && sameCandyType(b[end + 1][column], candy)) {
      end++
    }
    const res: string[] = []
    for (let i = start; i <= end; i++) {
      res.push(`${i},${column}`)
    }
    return res
  }

  const longestConsecutiveRun = (numbers: number[]): number[] => {
    const sorted = [...numbers].sort((a, b) => a - b)
    let best: number[] = []
    let current: number[] = []

    for (const num of sorted) {
      const prev = current[current.length - 1]
      if (current.length === 0 || num === prev + 1) {
        current.push(num)
      } else {
        if (current.length > best.length) best = current
        current = [num]
      }
    }
    if (current.length > best.length) best = current
    return best
  }

  const findMatchGroups = (b: (Candy | null)[][]) => {
    const groups: {
      cells: Set<string>
      horizontal: string[]
      vertical: string[]
      type: number
    }[] = []
    const visited = new Set<string>()

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let column = 0; column < BOARD_SIZE; column++) {
        const key = `${row},${column}`
        if (visited.has(key)) continue

        const candy = b[row][column]
        if (!candy || candy.special === 'color-bomb') continue

        if (
          getHorizontalRun(row, column, b).length < 3 &&
          getVerticalRun(row, column, b).length < 3
        ) {
          continue
        }

        const componentCells = new Set<string>()
        const stack = [key]

        while (stack.length > 0) {
          const currentKey = stack.pop()!
          if (componentCells.has(currentKey)) continue
          const [r, c] = currentKey.split(',').map(Number)
          const curCandy = b[r]?.[c]
          if (!curCandy || !sameCandyType(curCandy, candy)) continue

          const isPartOfRun =
            getHorizontalRun(r, c, b).length >= 3 || getVerticalRun(r, c, b).length >= 3
          if (!isPartOfRun) continue

          componentCells.add(currentKey)
          stack.push(`${r - 1},${c}`, `${r + 1},${c}`, `${r},${c - 1}`, `${r},${c + 1}`)
        }

        for (const cellKey of componentCells) {
          visited.add(cellKey)
        }

        const columnsByRow = new Map<number, number[]>()
        const rowsByColumn = new Map<number, number[]>()

        for (const cellKey of componentCells) {
          const [r, c] = cellKey.split(',').map(Number)
          if (!columnsByRow.has(r)) columnsByRow.set(r, [])
          columnsByRow.get(r)!.push(c)
          if (!rowsByColumn.has(c)) rowsByColumn.set(c, [])
          rowsByColumn.get(c)!.push(r)
        }

        let bestHorizontal: string[] = []
        for (const [r, columns] of columnsByRow) {
          const run = longestConsecutiveRun(columns)
          if (run.length > bestHorizontal.length) {
            bestHorizontal = run.map(c => `${r},${c}`)
          }
        }

        let bestVertical: string[] = []
        for (const [c, rows] of rowsByColumn) {
          const run = longestConsecutiveRun(rows)
          if (run.length > bestVertical.length) {
            bestVertical = run.map(r => `${r},${c}`)
          }
        }

        groups.push({
          cells: componentCells,
          horizontal: bestHorizontal,
          vertical: bestVertical,
          type: candy.type,
        })
      }
    }
    return groups
  }

  const getSpecialAffectedCells = (
    row: number,
    column: number,
    candy: { special: SpecialType }
  ): string[] => {
    const cells: string[] = []
    if (candy.special === 'striped-horizontal') {
      for (let c = 0; c < BOARD_SIZE; c++) cells.push(`${row},${c}`)
    }
    if (candy.special === 'striped-vertical') {
      for (let r = 0; r < BOARD_SIZE; r++) cells.push(`${r},${column}`)
    }
    if (candy.special === 'wrapped') {
      for (let ro = -1; ro <= 1; ro++) {
        for (let co = -1; co <= 1; co++) {
          const tr = row + ro
          const tc = column + co
          if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE) {
            cells.push(`${tr},${tc}`)
          }
        }
      }
    }
    return cells
  }

  const expandSpecialEffects = (
    matches: Set<string>,
    currentBoard: (Candy | null)[][]
  ): Set<string> => {
    const expanded = new Set(matches)
    let changed = true
    while (changed) {
      changed = false
      for (const pos of [...expanded]) {
        const [r, c] = pos.split(',').map(Number)
        const candy = currentBoard[r]?.[c]
        if (!candy) continue
        const affected = getSpecialAffectedCells(r, c, candy)
        for (const aff of affected) {
          if (!expanded.has(aff)) {
            expanded.add(aff)
            changed = true
          }
        }
      }
    }
    return expanded
  }

  const chooseSpecialPosition = (
    groupCells: Set<string>,
    swapFirst: Pos | null,
    swapSecond: Pos | null
  ): string => {
    const candidates = [swapSecond, swapFirst]
    for (const cand of candidates) {
      if (!cand) continue
      const key = `${cand.row},${cand.column}`
      if (groupCells.has(key)) return key
    }
    return [...groupCells][Math.floor(groupCells.size / 2)]
  }

  const determineSpecialCreates = (
    groups: ReturnType<typeof findMatchGroups>,
    swapFirst: Pos | null,
    swapSecond: Pos | null,
    currentBoard: (Candy | null)[][]
  ) => {
    const creates: { row: number; column: number; special: SpecialType; type: number }[] = []

    for (const group of groups) {
      const size = group.cells.size
      const hasHorizontal = group.horizontal.length >= 3
      const hasVertical = group.vertical.length >= 3

      if (hasHorizontal && hasVertical) {
        const posStr = chooseSpecialPosition(group.cells, swapFirst, swapSecond)
        const [row, column] = posStr.split(',').map(Number)
        const candy = currentBoard[row]?.[column]
        creates.push({
          row,
          column,
          special: 'wrapped',
          type: candy?.type ?? group.type,
        })
        continue
      }

      if (size >= 5) {
        const posStr = chooseSpecialPosition(group.cells, swapFirst, swapSecond)
        const [row, column] = posStr.split(',').map(Number)
        creates.push({
          row,
          column,
          special: 'color-bomb',
          type: -1, // type-agnostic
        })
        continue
      }

      if (group.horizontal.length >= 4) {
        const posStr = chooseSpecialPosition(group.cells, swapFirst, swapSecond)
        const [row, column] = posStr.split(',').map(Number)
        creates.push({
          row,
          column,
          special: 'striped-horizontal',
          type: group.type,
        })
        continue
      }

      if (group.vertical.length >= 4) {
        const posStr = chooseSpecialPosition(group.cells, swapFirst, swapSecond)
        const [row, column] = posStr.split(',').map(Number)
        creates.push({
          row,
          column,
          special: 'striped-vertical',
          type: group.type,
        })
      }
    }
    return creates
  }

  const getSpecialCombination = (first: Pos, second: Pos, b: (Candy | null)[][]) => {
    const c1 = b[first.row][first.column]
    const c2 = b[second.row][second.column]
    if (!c1 || !c2) return null

    const s1 = c1.special
    const s2 = c2.special

    if (s1 === 'color-bomb' && s2 === 'color-bomb') return 'color-color'
    if (
      (s1 === 'color-bomb' && s2 === null) ||
      (s2 === 'color-bomb' && s1 === null)
    ) {
      return 'color-normal'
    }
    if (s1 === 'color-bomb' || s2 === 'color-bomb') return 'color-special'
    if (isStriped(c1) && isStriped(c2)) return 'striped-striped'
    if ((isStriped(c1) && s2 === 'wrapped') || (s1 === 'wrapped' && isStriped(c2))) {
      return 'striped-wrapped'
    }
    if (s1 === 'wrapped' && s2 === 'wrapped') return 'wrapped-wrapped'
    return null
  }

  const collapseAndFillBoard = (b: (Candy | null)[][]): (Candy | null)[][] => {
    const newB = cloneBoard(b)

    // Collapse downwards
    for (let col = 0; col < BOARD_SIZE; col++) {
      const remaining: (Candy | null)[] = []
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        if (newB[row][col]) {
          remaining.push(newB[row][col])
        }
      }
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        const idx = BOARD_SIZE - 1 - row
        newB[row][col] = remaining[idx] ?? null
      }
    }

    // Fill empty spaces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!newB[r][c]) {
          newB[r][c] = createCandy()
        }
      }
    }

    return newB
  }

  const testSwap = (first: Pos, second: Pos, b: (Candy | null)[][]): boolean => {
    if (getSpecialCombination(first, second, b)) return true

    // Simulasikan swap
    const tempB = cloneBoard(b)
    const t = tempB[first.row][first.column]
    tempB[first.row][first.column] = tempB[second.row][second.column]
    tempB[second.row][second.column] = t

    const matches = findMatchesOnBoard(tempB)
    return matches.size > 0
  }

  const hasPossibleMoveOnBoard = (b: (Candy | null)[][]): boolean => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c + 1 < BOARD_SIZE && testSwap({ row: r, column: c }, { row: r, column: c + 1 }, b)) {
          return true
        }
        if (r + 1 < BOARD_SIZE && testSwap({ row: r, column: c }, { row: r + 1, column: c }, b)) {
          return true
        }
      }
    }
    return false
  }

  const findPossibleMoveOnBoard = (b: (Candy | null)[][]): { first: Pos; second: Pos } | null => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c + 1 < BOARD_SIZE) {
          const p1 = { row: r, column: c }
          const p2 = { row: r, column: c + 1 }
          if (testSwap(p1, p2, b)) return { first: p1, second: p2 }
        }
        if (r + 1 < BOARD_SIZE) {
          const p1 = { row: r, column: c }
          const p2 = { row: r + 1, column: c }
          if (testSwap(p1, p2, b)) return { first: p1, second: p2 }
        }
      }
    }
    return null
  }

  const createsStartingMatch = (r: number, c: number, type: number, b: (Candy | null)[][]) => {
    const horizontalMatch =
      c >= 2 && b[r][c - 1]?.type === type && b[r][c - 2]?.type === type
    const verticalMatch =
      r >= 2 && b[r - 1][c]?.type === type && b[r - 2][c]?.type === type
    return horizontalMatch || verticalMatch
  }

  const generateInitialBoard = (): (Candy | null)[][] => {
    let attempts = 0
    let b: (Candy | null)[][] = []

    do {
      b = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null))

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          let type: number
          do {
            type = randomCandy()
          } while (createsStartingMatch(r, c, type, b))
          b[r][c] = createCandy(type)
        }
      }
      attempts++
    } while (!hasPossibleMoveOnBoard(b) && attempts < 100)

    return b
  }

  // ==========================================================================
  // HINT LOGIC
  // ==========================================================================

  const clearHint = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    if (hintClearTimerRef.current) clearTimeout(hintClearTimerRef.current)
    hintTimerRef.current = null
    hintClearTimerRef.current = null
    setIdleHintCells([])
  }, [])

  const startHintTimer = useCallback(() => {
    clearHint()
    if (gameOverRef.current || gameLockedRef.current) return

    hintTimerRef.current = setTimeout(() => {
      const pm = findPossibleMoveOnBoard(boardRef.current)
      if (!pm) return
      setIdleHintCells([pm.first, pm.second])

      hintClearTimerRef.current = setTimeout(() => {
        setIdleHintCells([])
      }, 1500)
    }, HINT_DELAY)
  }, [clearHint])

  // ==========================================================================
  // RESOLVE MATCHES & SPECIAL COMBOS ASYNCHRONOUS LOOP
  // ==========================================================================

  const triggerPopVisuals = (cells: Set<string>, curBoard: (Candy | null)[][]) => {
    setPoppingCells(new Set(cells))
    if (boardContainerRef.current && particleLayerRef.current) {
      const layerRect = particleLayerRef.current.getBoundingClientRect()
      cells.forEach(pos => {
        const [r, c] = pos.split(',').map(Number)
        const el = boardContainerRef.current?.querySelector(`[data-cell="${r}-${c}"]`)
        if (el) {
          const rect = el.getBoundingClientRect()
          spawnPopEffect(curBoard[r]?.[c] ?? null, rect, layerRect)
        }
      })
    }
  }

  const resolveSpecialCombination = async (
    first: Pos,
    second: Pos,
    comboType: string,
    currentBoard: (Candy | null)[][]
  ): Promise<(Candy | null)[][]> => {
    const cells = new Set<string>()

    if (comboType === 'color-color') {
      spawnBoardFlash()
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          cells.add(`${r},${c}`)
        }
      }
    } else if (comboType === 'color-normal') {
      const normalPos =
        currentBoard[first.row][first.column]?.special === 'color-bomb' ? second : first
      const targetType = currentBoard[normalPos.row][normalPos.column]?.type

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const candy = currentBoard[r][c]
          if (candy && candy.type === targetType && candy.special !== 'color-bomb') {
            cells.add(`${r},${c}`)
          }
        }
      }
      cells.add(`${first.row},${first.column}`)
      cells.add(`${second.row},${second.column}`)
    } else if (comboType === 'color-special') {
      const specialPos =
        currentBoard[first.row][first.column]?.special === 'color-bomb' ? second : first
      const bombPos = specialPos === second ? first : second
      const targetCandy = currentBoard[specialPos.row][specialPos.column]
      const targetType = targetCandy?.type
      const targetSpecial = targetCandy?.special ?? null

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const candy = currentBoard[r][c]
          if (candy && candy.type === targetType && candy.special !== 'color-bomb') {
            cells.add(`${r},${c}`)
            const affected = getSpecialAffectedCells(r, c, { special: targetSpecial })
            for (const aff of affected) cells.add(aff)
          }
        }
      }
      cells.add(`${bombPos.row},${bombPos.column}`)
    } else if (comboType === 'striped-striped') {
      for (let cur = 0; cur < BOARD_SIZE; cur++) {
        cells.add(`${first.row},${cur}`)
        cells.add(`${cur},${first.column}`)
        cells.add(`${second.row},${cur}`)
        cells.add(`${cur},${second.column}`)
      }
    } else if (comboType === 'striped-wrapped') {
      for (let ro = -1; ro <= 1; ro++) {
        for (let co = -1; co <= 1; co++) {
          const r = first.row + ro
          const c = first.column + co
          if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            for (let cur = 0; cur < BOARD_SIZE; cur++) {
              cells.add(`${r},${cur}`)
              cells.add(`${cur},${c}`)
            }
          }
        }
      }
    } else if (comboType === 'wrapped-wrapped') {
      for (let ro = -2; ro <= 2; ro++) {
        for (let co = -2; co <= 2; co++) {
          const r = first.row + ro
          const c = first.column + co
          if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            cells.add(`${r},${c}`)
          }
        }
      }
    }

    const specialGained = cells.size * SCORE_PER_CANDY * 2
    setScore(s => s + specialGained)
    showScorePopup(specialGained, cells)

    triggerPopVisuals(cells, currentBoard)
    await wait(POP_DELAY)

    // Hapus cell
    const updated = cloneBoard(currentBoard)
    cells.forEach(pos => {
      const [r, c] = pos.split(',').map(Number)
      updated[r][c] = null
    })

    setPoppingCells(new Set())

    // Collapse dan refill
    const filledBoard = collapseAndFillBoard(updated)
    setBoard(filledBoard)
    boardRef.current = filledBoard

    // Trigger efek candy-land pada baris yang jatuh
    const landedSet = new Set<string>()
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (updated[r][c] === null) {
          landedSet.add(`${r},${c}`)
        }
      }
    }
    setLandingCandies(landedSet)
    setTimeout(() => setLandingCandies(new Set()), 350)

    await wait(FALL_DELAY)

    const matches = findMatchesOnBoard(filledBoard)
    if (matches.size > 0) {
      return await resolveMatchesLoop(matches, first, second, filledBoard)
    }

    return filledBoard
  }

  const resolveMatchesLoop = async (
    initialMatches: Set<string>,
    swapFirst: Pos | null,
    swapSecond: Pos | null,
    initialBoardState: (Candy | null)[][]
  ): Promise<(Candy | null)[][]> => {
    let combo = 0
    let matches = initialMatches
    let curBoard = initialBoardState

    while (matches.size > 0) {
      combo++
      const groups = findMatchGroups(curBoard)
      const specialCreates = determineSpecialCreates(groups, swapFirst, swapSecond, curBoard)
      const expanded = expandSpecialEffects(matches, curBoard)

      const comboMultiplier = 1 + (combo - 1) * 0.5
      const gained = Math.round(expanded.size * SCORE_PER_CANDY * comboMultiplier)

      setScore(s => s + gained)
      setMessage(combo > 1 ? `COMBO x${combo}` : `Match! +${gained}`)

      if (combo > 1) {
        showComboPopup(combo)
      }
      showScorePopup(gained, expanded)

      triggerPopVisuals(expanded, curBoard)
      await wait(POP_DELAY)

      // Hapus matches
      const updated = cloneBoard(curBoard)
      expanded.forEach(pos => {
        const [r, c] = pos.split(',').map(Number)
        updated[r][c] = null
      })

      // Spawn special candies yang tercipta
      for (const sp of specialCreates) {
        if (expanded.has(`${sp.row},${sp.column}`)) {
          updated[sp.row][sp.column] = {
            id: getNextId(),
            type: sp.type,
            special: sp.special,
            justCreated: true,
          }
        }
      }

      setPoppingCells(new Set())

      // Collapse and refill
      curBoard = collapseAndFillBoard(updated)
      setBoard(curBoard)
      boardRef.current = curBoard

      // Trigger efek candy-land
      const landedSet = new Set<string>()
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (updated[r][c] === null) {
            landedSet.add(`${r},${c}`)
          }
        }
      }
      setLandingCandies(landedSet)
      setTimeout(() => setLandingCandies(new Set()), 350)

      await wait(FALL_DELAY)

      matches = findMatchesOnBoard(curBoard)
    }

    return curBoard
  }

  const finishMove = (finalBoard: (Candy | null)[][]) => {
    setSelectedCandy(null)

    const currentScore = scoreRef.current
    const currentMoves = movesRef.current
    const currentMode = gameModeRef.current

    if (currentMode === 'target' && currentScore >= TARGET_SCORE) {
      setGameWon(true)
      setGameOver(true)
      gameLockedRef.current = true
      setMessage('Target tercapai! Kamu menang.')
      return
    }

    if (currentMoves <= 0) {
      setGameWon(false)
      setGameOver(true)
      gameLockedRef.current = true
      setMessage('Langkah habis.')
      return
    }

    if (!hasPossibleMoveOnBoard(finalBoard)) {
      setMessage('Tidak ada kombinasi tersisa. Mengacak papan...')
      // Shuffle board
      let flat = finalBoard.flat().filter(Boolean) as Candy[]
      let shuffled: (Candy | null)[][] = []
      let attempts = 0
      do {
        flat = [...flat].sort(() => Math.random() - 0.5)
        let idx = 0
        shuffled = Array(BOARD_SIZE)
          .fill(null)
          .map(() => Array(BOARD_SIZE).fill(null))
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            shuffled[r][c] = flat[idx++] ?? createCandy()
          }
        }
        attempts++
      } while (
        (findMatchesOnBoard(shuffled).size > 0 || !hasPossibleMoveOnBoard(shuffled)) &&
        attempts < 100
      )

      setBoard(shuffled)
      boardRef.current = shuffled
      gameLockedRef.current = false
      startHintTimer()
      return
    }

    setMessage('Nice! Cari kombinasi berikutnya.')
    gameLockedRef.current = false
    startHintTimer()
  }

  // ==========================================================================
  // MOVE EXECUTION (CLICK / DRAG)
  // ==========================================================================

  const performMove = async (first: Pos, second: Pos) => {
    if (gameLockedRef.current || gameOverRef.current) return
    gameLockedRef.current = true
    clearHint()

    // 1. Swap sementara di state & ref
    const swapped = cloneBoard(boardRef.current)
    const temp = swapped[first.row][first.column]
    swapped[first.row][first.column] = swapped[second.row][second.column]
    swapped[second.row][second.column] = temp

    setBoard(swapped)
    boardRef.current = swapped

    await wait(180) // Durasi animasi swap

    // 2. Cek kombinasi spesial
    const specialCombo = getSpecialCombination(first, second, swapped)
    if (specialCombo) {
      setMoves(m => m - 1)
      const afterCombo = await resolveSpecialCombination(first, second, specialCombo, swapped)
      finishMove(afterCombo)
      return
    }

    // 3. Cek apakah swap menghasilkan matches biasa
    const matches = findMatchesOnBoard(swapped)
    if (matches.size === 0) {
      // Revert swap
      const reverted = cloneBoard(swapped)
      const t = reverted[first.row][first.column]
      reverted[first.row][first.column] = reverted[second.row][second.column]
      reverted[second.row][second.column] = t

      setBoard(reverted)
      boardRef.current = reverted
      setMessage('Swap itu tidak menghasilkan match.')

      await wait(180)
      gameLockedRef.current = false
      startHintTimer()
      return
    }

    // 4. Match valid! Kurangi langkah dan selesaikan reaksi berantai
    setMoves(m => m - 1)
    const afterMatches = await resolveMatchesLoop(matches, first, second, swapped)
    finishMove(afterMatches)
  }

  // ==========================================================================
  // CLICK HANDLER
  // ==========================================================================

  const handleCandyClick = (r: number, c: number) => {
    if (gameLockedRef.current || gameOverRef.current || movesRef.current <= 0) return
    clearHint()

    if (!selectedCandy) {
      setSelectedCandy({ row: r, column: c })
      return
    }

    if (selectedCandy.row === r && selectedCandy.column === c) {
      setSelectedCandy(null)
      return
    }

    const currentCandy = { row: r, column: c }
    if (!isAdjacent(selectedCandy, currentCandy)) {
      setSelectedCandy(currentCandy)
      return
    }

    const first = selectedCandy
    setSelectedCandy(null)
    performMove(first, currentCandy)
  }

  // ==========================================================================
  // DRAG AND DROP HANDLERS (HTML5)
  // ==========================================================================

  const handleDragStart = (r: number, c: number) => {
    if (gameLockedRef.current || gameOverRef.current) return
    squareBeingDragged.current = { row: r, column: c }
    clearHint()
  }

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, r: number, c: number) => {
    e.preventDefault()
    squareBeingReplaced.current = { row: r, column: c }
  }

  const handleDragEnter = (r: number, c: number) => {
    setDragOverPos({ row: r, column: c })
  }

  const handleDragLeave = () => {
    setDragOverPos(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragOverPos(null)

    const from = squareBeingDragged.current
    const to = squareBeingReplaced.current

    squareBeingDragged.current = null
    squareBeingReplaced.current = null

    if (!from || !to) return
    if (from.row === to.row && from.column === to.column) return

    // Validasi permen yang bersebelahan
    if (!isAdjacent(from, to)) {
      setMessage('❌ Tidak valid! Hanya boleh ditukar dengan pion yang bersebelahan.')
      return
    }

    performMove(from, to)
  }

  const handleDragEnd = () => {
    squareBeingDragged.current = null
    squareBeingReplaced.current = null
    setDragOverPos(null)
  }

  // ==========================================================================
  // RESTART & GAME CONTROLS
  // ==========================================================================

  const restartGame = useCallback(() => {
    clearHint()
    setScore(0)
    setMoves(STARTING_MOVES)
    setSelectedCandy(null)
    setGameOver(false)
    setGameWon(false)
    setPoppingCells(new Set())
    gameLockedRef.current = false
    gameOverRef.current = false

    const newBoard = generateInitialBoard()
    setBoard(newBoard)
    boardRef.current = newBoard

    setMessage('Pilih atau drag dua permen yang bersebelahan.')
    startHintTimer()
  }, [clearHint, startHintTimer])

  const changeGameMode = (mode: 'target' | 'unlimited') => {
    if (gameMode === mode) return
    setGameMode(mode)
    restartGame()
  }

  // Mount effect
  useEffect(() => {
    restartGame()
    return () => clearHint()
  }, [restartGame, clearHint])

  // ==========================================================================
  // RENDER UI
  // ==========================================================================

  return (
    <main className="game relative w-[min(94vw,520px)] mx-auto py-6" id="game">
      {/* ================================================================= */}
      {/* HEADER                                                            */}
      {/* ================================================================= */}
      <header className="header flex justify-between items-center mb-5">
        <div className="brand min-w-0">
          <p className="label m-0 mb-1.5 text-[var(--yellow)] text-[10px] font-[850] tracking-[0.2em] leading-none uppercase">
            SWEET GRID
          </p>
          <h1 className="m-0 text-[var(--text)] text-[clamp(27px,7vw,39px)] font-[800] leading-[0.98] tracking-[-0.055em]">
            Match. Pop. Repeat.
          </h1>
        </div>

        <div className="header-actions flex items-center ml-4">
          <button
            id="restartBtn"
            className="restart-btn"
            type="button"
            aria-label="Mulai ulang permainan"
            title="Mulai ulang"
            onClick={restartGame}
          >
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MODE SELECT (Kapsul Tab)                                          */}
      {/* ================================================================= */}
      <div
        className="mode-select flex p-1 bg-slate-900/80 border border-slate-700/60 rounded-full mb-3 shadow-inner"
        role="group"
        aria-label="Mode permainan"
      >
        <button
          id="modeTargetBtn"
          className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
            gameMode === 'target'
              ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
          type="button"
          aria-pressed={gameMode === 'target'}
          onClick={() => changeGameMode('target')}
        >
          Target Skor
        </button>

        <button
          id="modeUnlimitedBtn"
          className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
            gameMode === 'unlimited'
              ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
          type="button"
          aria-pressed={gameMode === 'unlimited'}
          onClick={() => changeGameMode('unlimited')}
        >
          Tanpa Batas
        </button>
      </div>

      {/* ================================================================= */}
      {/* GAME STATS (Grid 3 Kolom Rapi)                                   */}
      {/* ================================================================= */}
      <section
        className="stats grid grid-cols-3 gap-2.5 mb-3"
        aria-label="Informasi permainan"
      >
        <div className="stat-card flex flex-col items-center justify-center p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-md">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
            SKOR
          </span>
          <strong id="score" className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
            {score}
          </strong>
        </div>

        <div className="stat-card flex flex-col items-center justify-center p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-md">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
            LANGKAH
          </span>
          <strong id="moves" className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {moves}
          </strong>
        </div>

        <div className="stat-card flex flex-col items-center justify-center p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-md">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
            TARGET
          </span>
          <strong id="target" className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {gameMode === 'unlimited' ? '∞' : TARGET_SCORE}
          </strong>
        </div>
      </section>

      {/* ================================================================= */}
      {/* GAME AREA                                                         */}
      {/* ================================================================= */}
      <section className="game-area relative flex justify-center" aria-label="Area permainan">
        <div
          ref={boardContainerRef}
          className="board-container relative w-[min(94vw,420px)] aspect-square p-2.5 sm:p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden"
        >
          <div
            id="board"
            className="board grid grid-cols-8 grid-rows-8 gap-1 sm:gap-1.5 w-full h-full touch-none select-none"
            role="grid"
            aria-label="Papan permainan Sweet Grid"
            aria-rowcount={8}
            aria-colcount={8}
          >
            {board.map((row, r) =>
              row.map((candyData, c) => {
                if (!candyData) {
                  return (
                    <div
                      key={`empty-${r}-${c}`}
                      data-cell={`${r}-${c}`}
                      className="w-full h-full aspect-square opacity-0 pointer-events-none"
                    />
                  )
                }

                const pastel = PASTEL_CANDIES[candyData.type] ?? PASTEL_CANDIES[0]
                const isSelected = selectedCandy?.row === r && selectedCandy?.column === c
                const isHint = idleHintCells.some(h => h.row === r && h.column === c)
                const isPopping = poppingCells.has(`${r},${c}`)
                const isDragOver = dragOverPos?.row === r && dragOverPos?.column === c

                let specialOverlay = null
                if (candyData.special === 'color-bomb') {
                  specialOverlay = (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-sky-500 animate-pulse flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-lg animate-ping" />
                    </div>
                  )
                } else if (candyData.special === 'striped-horizontal') {
                  specialOverlay = (
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-white/70 shadow-sm pointer-events-none" />
                  )
                } else if (candyData.special === 'striped-vertical') {
                  specialOverlay = (
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white/70 shadow-sm pointer-events-none" />
                  )
                } else if (candyData.special === 'wrapped') {
                  specialOverlay = (
                    <div className="absolute inset-1 border-2 border-white/80 rounded-lg pointer-events-none" />
                  )
                }

                const isLanding = landingCandies.has(`${r},${c}`)

                return (
                  <button
                    key={candyData.id}
                    data-cell={`${r}-${c}`}
                    type="button"
                    role="gridcell"
                    aria-rowindex={r + 1}
                    aria-colindex={c + 1}
                    draggable={true}
                    onDragStart={() => handleDragStart(r, c)}
                    onDragOver={e => handleDragOver(e, r, c)}
                    onDragEnter={() => handleDragEnter(r, c)}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleCandyClick(r, c)}
                    className={[
                      'relative w-full h-full cursor-pointer hover:scale-95 transition-transform',
                      'rounded-xl shadow-sm border-b-4',
                      pastel.bg,
                      pastel.border,
                      isSelected ? 'ring-4 ring-white scale-90 z-20' : '',
                      isHint ? 'ring-2 ring-amber-300 animate-bounce' : '',
                      isPopping ? 'pop' : '',
                      isLanding ? 'candy-land' : '',
                      isDragOver ? 'brightness-125 scale-105 z-10' : '',
                      candyData.justCreated ? 'special-born' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={createCandyLabel(r, c, candyData)}
                  >
                    {/* Efek kilauan cahaya (glossy) di bagian atas pion */}
                    <div className="absolute inset-x-1 top-0.5 h-1/2 rounded-t-lg bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

                    {/* Titik highlight glossy tambahan di sudut kiri atas */}
                    <div className="absolute top-1 left-1.5 w-2 h-1 rounded-full bg-white/60 pointer-events-none" />

                    {/* Overlay jika ada permen spesial */}
                    {specialOverlay}
                  </button>
                )
              })
            )}
          </div>

          <div
            ref={particleLayerRef}
            id="particleLayer"
            className="particle-layer pointer-events-none absolute inset-0 z-10 overflow-hidden"
            aria-hidden="true"
          />
        </div>
      </section>

      {/* ================================================================= */}
      {/* GAME MESSAGE / FEEDBACK                                           */}
      {/* ================================================================= */}
      <div className="game-feedback min-h-[38px] flex items-center justify-center">
        <p id="message" className="message text-slate-400 text-xs sm:text-sm text-center font-medium mt-2" role="status" aria-live="polite">
          {message}
        </p>
      </div>

      {/* Screen-reader live region dari HTML/JS asli */}
      <div id="gameStatus" className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>

      {/* ================================================================= */}
      {/* GAME OVER / RESULT OVERLAY                                        */}
      {/* ================================================================= */}
      {gameOver && (
        <section id="gameOverlay" className="game-overlay" aria-hidden="false">
          <div className="game-overlay-card">
            <p className="label">SWEET GRID</p>

            <h2 id="overlayTitle">
              {gameWon
                ? 'Target tercapai!'
                : gameMode === 'unlimited'
                ? 'Langkah habis'
                : 'Langkah habis'}
            </h2>

            <p id="overlayMessage">
              {gameWon
                ? 'Kamu berhasil melewati target skor!'
                : gameMode === 'unlimited'
                ? 'Mode Tanpa Batas tidak punya target. Coba kalahkan skor ini di percobaan berikutnya.'
                : 'Coba lagi dan pecahkan skor terbaikmu.'}
            </p>

            <div className="overlay-score">
              <span>SKOR</span>
              <strong id="finalScore">{score}</strong>
            </div>

            <button
              id="overlayRestartBtn"
              className="overlay-restart-btn"
              type="button"
              onClick={restartGame}
            >
              Main Lagi
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
