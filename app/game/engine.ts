export const BOARD_SIZE = 8
export const CANDY_TYPES = 6

export const LEVELS = [
  { name: 'Kebun Gula', target: 1000, moves: 30 },
  { name: 'Sungai Karamel', target: 1600, moves: 28 },
  { name: 'Bukit Marshmallow', target: 2200, moves: 26 },
  { name: 'Istana Permen', target: 3000, moves: 24 },
]
export const SCORE_PER_CANDY = 10


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

export interface Pos {
  row: number
  column: number
}

export type Board = (Candy | null)[][]

let candyIdCounter = 0
function getNextId() {
  return `c_${Date.now()}_${++candyIdCounter}`
}

function randomCandy(): number {
  return Math.floor(Math.random() * CANDY_TYPES)
}

export function createCandy(type = randomCandy(), special: SpecialType = null): Candy {
  return {
    id: getNextId(),
    type,
    special,
  }
}

export function cloneBoard(b: (Candy | null)[][]): (Candy | null)[][] {
  return b.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

export function isAdjacent(first: Pos, second: Pos): boolean {
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

export const findMatchesOnBoard = (currentBoard: (Candy | null)[][]): Set<string> => {
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

export const getHorizontalRun = (row: number, column: number, b: (Candy | null)[][]): string[] => {
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

export const getVerticalRun = (row: number, column: number, b: (Candy | null)[][]): string[] => {
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

export const getConsecutiveRuns = (numbers: number[]): number[][] => {
  const sorted = [...numbers].sort((a, b) => a - b)
  const runs: number[][] = []
  let current: number[] = []

  for (const num of sorted) {
    const previous = current[current.length - 1]
    if (current.length === 0 || num === previous + 1) {
      current.push(num)
    } else {
      if (current.length >= 3) runs.push(current)
      current = [num]
    }
  }
  if (current.length >= 3) runs.push(current)
  return runs
}

export const findMatchGroups = (b: (Candy | null)[][]) => {
  const groups: {
    cells: Set<string>
    horizontal: string[]
    vertical: string[]
    horizontalRuns: string[][]
    verticalRuns: string[][]
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

      const horizontalRuns: string[][] = []
      for (const [r, columns] of columnsByRow) {
        for (const run of getConsecutiveRuns(columns)) {
          horizontalRuns.push(run.map(c => `${r},${c}`))
        }
      }

      const verticalRuns: string[][] = []
      for (const [c, rows] of rowsByColumn) {
        for (const run of getConsecutiveRuns(rows)) {
          verticalRuns.push(run.map(r => `${r},${c}`))
        }
      }

      groups.push({
        cells: componentCells,
        horizontal:
          horizontalRuns.reduce(
            (longest, run) => (run.length > longest.length ? run : longest),
            [] as string[]
          ),
        vertical:
          verticalRuns.reduce(
            (longest, run) => (run.length > longest.length ? run : longest),
            [] as string[]
          ),
        horizontalRuns,
        verticalRuns,
        type: candy.type,
      })
    }
  }
  return groups
}

export const getSpecialAffectedCells = (
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

export const expandSpecialEffects = (
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

export const chooseSpecialPosition = (
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

export const determineSpecialCreates = (
  groups: ReturnType<typeof findMatchGroups>,
  swapFirst: Pos | null,
  swapSecond: Pos | null,
  currentBoard: (Candy | null)[][]
) => {
  const creates: { row: number; column: number; special: SpecialType; type: number }[] = []

  for (const group of groups) {
    const longestFiveRun = [...group.horizontalRuns, ...group.verticalRuns]
      .filter(run => run.length >= 5)
      .sort((first, second) => second.length - first.length)[0]

    if (longestFiveRun) {
      const posStr = longestFiveRun[Math.floor((longestFiveRun.length - 1) / 2)]
      const [row, column] = posStr.split(',').map(Number)
      creates.push({
        row,
        column,
        special: 'color-bomb',
        type: -1,
      })
      continue
    }

    const intersection = group.horizontalRuns
      .flatMap(run => run)
      .find(cell => group.verticalRuns.some(run => run.includes(cell)))

    if (intersection) {
      const [row, column] = intersection.split(',').map(Number)
      const candy = currentBoard[row]?.[column]
      creates.push({
        row,
        column,
        special: 'wrapped',
        type: candy?.type ?? group.type,
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

export const getSpecialCombination = (first: Pos, second: Pos, b: (Candy | null)[][]) => {
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

export const collapseAndFillBoard = (b: (Candy | null)[][], makeCandy: () => Candy = createCandy): (Candy | null)[][] => {
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
        newB[r][c] = makeCandy()
      }
    }
  }

  return newB
}

export const testSwap = (first: Pos, second: Pos, b: (Candy | null)[][]): boolean => {
  if (getSpecialCombination(first, second, b)) return true

  // Simulasikan swap
  const tempB = cloneBoard(b)
  const t = tempB[first.row][first.column]
  tempB[first.row][first.column] = tempB[second.row][second.column]
  tempB[second.row][second.column] = t

  const matches = findMatchesOnBoard(tempB)
  return matches.size > 0
}

export const hasPossibleMoveOnBoard = (b: (Candy | null)[][]): boolean => {
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

export const findPossibleMoveOnBoard = (b: (Candy | null)[][]): { first: Pos; second: Pos } | null => {
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

export const createsStartingMatch = (r: number, c: number, type: number, b: (Candy | null)[][]) => {
  const horizontalMatch =
    c >= 2 && b[r][c - 1]?.type === type && b[r][c - 2]?.type === type
  const verticalMatch =
    r >= 2 && b[r - 1][c]?.type === type && b[r - 2][c]?.type === type
  return horizontalMatch || verticalMatch
}

export const generateInitialBoard = (): (Candy | null)[][] => {
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

export function getCombinationCells(first: Pos, second: Pos, comboType: string, currentBoard: Board): Set<string> {
  const cells = new Set<string>()

  if (comboType === 'color-color') {
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
    const expanded = expandSpecialEffects(cells, currentBoard)
    cells.clear()
    expanded.forEach(cell => cells.add(cell))
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
    const expanded = expandSpecialEffects(cells, currentBoard)
    cells.clear()
    expanded.forEach(cell => cells.add(cell))
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

  return cells
}
