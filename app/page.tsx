'use client'

import { useState, useRef } from 'react'

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------

const GRID_SIZE = 8
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE // 64 elemen

const CANDY_COLORS = [
  { id: 0, bg: 'bg-red-500',    ring: 'ring-red-300',    label: '🍎' },
  { id: 1, bg: 'bg-blue-500',   ring: 'ring-blue-300',   label: '🫐' },
  { id: 2, bg: 'bg-yellow-400', ring: 'ring-yellow-200', label: '🍋' },
  { id: 3, bg: 'bg-green-500',  ring: 'ring-green-300',  label: '🍀' },
  { id: 4, bg: 'bg-purple-500', ring: 'ring-purple-300', label: '🍇' },
  { id: 5, bg: 'bg-orange-400', ring: 'ring-orange-300', label: '🍊' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Buat array 1D 64 elemen dengan warna candy acak */
function createGrid(): number[] {
  return Array.from({ length: TOTAL_CELLS }, () =>
    Math.floor(Math.random() * CANDY_COLORS.length)
  )
}

/**
 * Validasi apakah dua indeks bertetangga secara langsung
 * (atas/bawah/kiri/kanan — tanpa diagonal, tanpa melompat).
 */
function isAdjacent(a: number, b: number): boolean {
  const rowA = Math.floor(a / GRID_SIZE)
  const rowB = Math.floor(b / GRID_SIZE)
  const colA = a % GRID_SIZE
  const colB = b % GRID_SIZE

  const sameRow = rowA === rowB
  const sameCol = colA === colB
  const rowDiff = Math.abs(rowA - rowB)
  const colDiff = Math.abs(colA - colB)

  // Kiri / kanan: baris sama, kolom bersebelahan
  if (sameRow && colDiff === 1) return true
  // Atas / bawah: kolom sama, baris bersebelahan
  if (sameCol && rowDiff === 1) return true

  return false
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

export default function Home() {
  // --- State ---
  /** Array 1D 64 elemen yang merepresentasikan grid 8×8 */
  const [grid, setGrid] = useState<number[]>(createGrid)

  /** Indeks pion yang sedang di-drag */
  const squareBeingDragged = useRef<number | null>(null)

  /** Indeks pion target (drop destination) */
  const squareBeingReplaced = useRef<number | null>(null)

  /** Untuk keperluan visual: mana yang sedang di-drag / di-hover */
  const [draggingIdx, setDraggingIdx]   = useState<number | null>(null)
  const [dragOverIdx,  setDragOverIdx]  = useState<number | null>(null)
  const [invalidIdx,   setInvalidIdx]   = useState<number | null>(null)

  // --- Feedback pesan terakhir ---
  const [lastMsg, setLastMsg] = useState<string>('Drag & drop candy untuk menukar posisi')

  // --- Handlers ---

  function handleDragStart(index: number) {
    squareBeingDragged.current = index
    setDraggingIdx(index)
    setInvalidIdx(null)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault() // wajib agar onDrop bisa terpicu
    squareBeingReplaced.current = index
  }

  function handleDragEnter(index: number) {
    setDragOverIdx(index)
  }

  function handleDragLeave() {
    setDragOverIdx(null)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()

    const from = squareBeingDragged.current
    const to   = squareBeingReplaced.current

    // Reset visual states
    setDraggingIdx(null)
    setDragOverIdx(null)

    // Guard: indeks harus valid dan berbeda
    if (from === null || to === null || from === to) return

    // Validasi: hanya boleh menukar dengan pion yang benar-benar bertetangga
    if (!isAdjacent(from, to)) {
      setInvalidIdx(to)
      setLastMsg(`❌ Tidak valid! Hanya bisa tukar dengan pion atas/bawah/kiri/kanan.`)
      setTimeout(() => setInvalidIdx(null), 600)
      squareBeingDragged.current  = null
      squareBeingReplaced.current = null
      return
    }

    // Tukar posisi kedua pion di dalam array state
    setGrid(prev => {
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })

    const rowFrom = Math.floor(from / GRID_SIZE)
    const colFrom = from % GRID_SIZE
    const rowTo   = Math.floor(to / GRID_SIZE)
    const colTo   = to % GRID_SIZE
    setLastMsg(
      `✅ Tukar [${rowFrom},${colFrom}] ↔ [${rowTo},${colTo}]`
    )

    squareBeingDragged.current  = null
    squareBeingReplaced.current = null
  }

  function handleDragEnd() {
    // Fallback: bersihkan state jika drag berakhir tanpa drop valid
    squareBeingDragged.current  = null
    squareBeingReplaced.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 select-none">

      <h1 className="text-3xl font-bold text-white tracking-widest uppercase">
        Sweet Game
      </h1>

      {/* ── Grid 8×8 ── */}
      <div className="grid grid-cols-8 gap-1 p-4 bg-gray-800 rounded-2xl shadow-2xl shadow-black/60">
        {grid.map((colorId, index) => {
          const candy      = CANDY_COLORS[colorId]
          const isDragging = draggingIdx === index
          const isDragOver = dragOverIdx === index
          const isInvalid  = invalidIdx  === index

          return (
            <div
              key={index}
              draggable={true}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              title={`row ${Math.floor(index / GRID_SIZE)}, col ${index % GRID_SIZE} (idx: ${index})`}
              className={[
                // Base
                candy.bg,
                'w-12 h-12 rounded-lg',
                'flex items-center justify-center text-xl',
                'shadow-md cursor-grab active:cursor-grabbing',
                'transition-all duration-150',
                // State visual
                isDragging ? 'opacity-30 scale-90'                              : '',
                isDragOver ? `ring-4 ring-white scale-110 brightness-125`       : '',
                isInvalid  ? 'ring-4 ring-red-500 animate-pulse'                : '',
                !isDragging && !isDragOver && !isInvalid
                  ? 'hover:scale-110 hover:brightness-125'
                  : '',
              ].join(' ')}
            >
              {candy.label}
            </div>
          )
        })}
      </div>

      {/* ── Status bar ── */}
      <p className="text-gray-400 text-sm font-mono min-h-[1.25rem]">
        {lastMsg}
      </p>

      {/* ── Info ── */}
      <p className="text-gray-600 text-xs">
        8 × 8 grid · {TOTAL_CELLS} cells · {CANDY_COLORS.length} candy types
      </p>
    </main>
  )
}
