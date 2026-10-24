'use client'

import React, { useEffect, useRef } from 'react'
import { BOARD_SIZE, LEVELS } from './game/engine'
import type { Candy, Pos } from './game/engine'
import { isBusy } from './game/reducer'
import { useGameController } from './game/use-game-controller'
import { useGameAnimations } from './game/use-game-animations'
import { useGameAudio } from './use-game-audio'

// ============================================================================
// KONSTANTA & TIPE DATA
// ============================================================================

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

function createCandyLabel(row: number, column: number, candy: Candy | null): string {
  const position = `Permen baris ${row + 1}, kolom ${column + 1}`
  if (!candy) return position
  if (candy.special === 'color-bomb') return `${position}, bom warna`
  if (candy.special === 'striped-horizontal') return `${position}, permen bergaris horizontal`
  if (candy.special === 'striped-vertical') return `${position}, permen bergaris vertikal`
  if (candy.special === 'wrapped') return `${position}, bom area 3x3`
  return `${position}, warna ${PASTEL_CANDIES[candy.type]?.name ?? candy.type}`
}

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================

function VictoryModal({
  score,
  onRestart,
  won,
  onNext,
}: {
  score: number
  won: boolean
  onNext?: () => void
  onRestart: () => void
}) {
  return (
    <section
      id="gameOverlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlayTitle"
    >
      <div className="w-full max-w-sm rounded-3xl border border-amber-300/30 bg-slate-950 p-7 text-center shadow-2xl">
        <p className="mb-3 text-xs font-extrabold tracking-[0.25em] text-amber-300">
          SWEET GRID
        </p>
        <h2 id="overlayTitle" className="text-3xl font-black text-white">
          {won ? 'Manis! Level selesai!' : 'Langkah habis'}
        </h2>
        <div className="my-6 rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-4">
          <span className="block text-xs font-extrabold tracking-widest text-slate-400">
            SKOR AKHIR
          </span>
          <strong id="finalScore" className="mt-1 block text-4xl font-black text-amber-300">
            {score}
          </strong>
        </div>
        <button
          id="overlayRestartBtn"
          className="w-full rounded-xl bg-amber-400 px-5 py-3 font-extrabold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          type="button"
          onClick={onRestart}
        >
          {won ? 'Main Lagi' : 'Coba Lagi'}
        </button>
        {won && onNext && <button type="button" onClick={onNext} className="mt-3 w-full rounded-xl bg-pink-500 px-5 py-3 font-extrabold text-white">Level Berikutnya ?</button>}
        {won && !onNext && <p className="mt-4 text-sm text-amber-200">Semua level selesai. Hebat!</p>}
      </div>
    </section>
  )
}

export default function SweetGridGame() {
  const { state, dispatch, restartGame: resetGame } = useGameController()
  const {
    board, score, moves, level, gameMode, message, selectedCandy,
    idleHintCells, poppingCells, dragOverPos,
  } = state
  const busy = isBusy(state)
  const gameOver = state.phase === 'won' || state.phase === 'lost'
  const gameWon = state.phase === 'won'
  const gridShaking = state.phase === 'popping' && state.detonatesSpecial
  const levelConfig = LEVELS[level]
  const { isMuted, playSound, toggleMuted, unlockAudio } = useGameAudio()
  const boardContainerRef = useRef<HTMLDivElement | null>(null)
  const particleLayerRef = useRef<HTMLDivElement | null>(null)
  const squareBeingDragged = useRef<Pos | null>(null)
  const touchStartRef = useRef<{ row: number; column: number; x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)
  const visualStepRef = useRef('')
  useGameAnimations(state, boardContainerRef, dispatch)

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

  // Visual side effects follow committed reducer steps; they never update game state.
  useEffect(() => {
    particleLayerRef.current?.replaceChildren()
    squareBeingDragged.current = null
    touchStartRef.current = null
    suppressClickRef.current = false
  }, [state.session])

  useEffect(() => {
    const key = `${state.session}:${state.revision}`
    if (visualStepRef.current === key) return
    visualStepRef.current = key
    if (state.phase === 'swapping') playSound('swap')
    if (state.phase === 'won') playSound('win')
    if (state.phase !== 'popping') return
    if (state.combo > 0) playSound('pop', { playbackRate: Math.min(1 + (state.combo - 1) * 0.08, 1.32) })
    if (state.detonatesSpecial) playSound('explode')
    if (state.combo > 1) showComboPopup(state.combo)
    showScorePopup(state.gained, state.poppingCells)
    if ([...state.poppingCells].some(key => {
      const [r, c] = key.split(',').map(Number)
      return state.board[r][c]?.special === 'color-bomb'
    })) spawnBoardFlash()
    const container = boardContainerRef.current
    const layer = particleLayerRef.current
    if (container && layer) {
      const layerRect = layer.getBoundingClientRect()
      // Batch all reads before particles write to the DOM.
      const bursts = [...state.poppingCells].map(key => {
        const [r, c] = key.split(',').map(Number)
        const element = container.querySelector(`[data-cell="${r}-${c}"]`)
        return element ? { candy: state.board[r][c], rect: element.getBoundingClientRect() } : null
      })
      bursts.forEach(burst => { if (burst) spawnPopEffect(burst.candy, burst.rect, layerRect) })
    }
    // Particle helpers only consume the step captured here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session, state.revision, state.phase, playSound])

  const performMove = (first: Pos, second: Pos) => {
    unlockAudio()
    dispatch({ type: 'swap', first, second })
  }
  const handleCandyClick = (row: number, column: number) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    unlockAudio()
    dispatch({ type: 'click', position: { row, column } })
  }
  const handleDragStart = (row: number, column: number) => {
    if (busy || gameOver) return
    unlockAudio()
    squareBeingDragged.current = { row, column }
    dispatch({ type: 'clear-hint' })
  }
  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>, row: number, column: number) => {
    event.preventDefault()
    dispatch({ type: 'drag-over', position: { row, column } })
  }
  const handleDragEnter = (row: number, column: number) => dispatch({ type: 'drag-over', position: { row, column } })
  const handleDragLeave = () => dispatch({ type: 'drag-over', position: null })
  const handleDrop = (event: React.DragEvent<HTMLButtonElement>, row: number, column: number) => {
    event.preventDefault()
    const first = squareBeingDragged.current
    squareBeingDragged.current = null
    dispatch({ type: 'drag-over', position: null })
    if (first) performMove(first, { row, column })
  }
  const handleDragEnd = () => {
    squareBeingDragged.current = null
    dispatch({ type: 'drag-over', position: null })
  }
  const restartGame = (nextLevel = level) => resetGame(nextLevel, gameMode)
  const changeGameMode = (mode: 'target' | 'unlimited') => {
    if (mode !== gameMode && !busy) resetGame(level, mode)
  }

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
            disabled={busy}
            onClick={() => restartGame()}
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
          disabled={busy}
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
          disabled={busy}
          onClick={() => changeGameMode('unlimited')}
        >
          Tanpa Batas
        </button>
      </div>

      {/* ================================================================= */}
      {/* GAME STATS (Grid 3 Kolom Rapi)                                   */}
      {/* ================================================================= */}
      <section
        className="stats grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2.5 mb-3"
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
            {gameMode === 'unlimited' ? '?' : moves}
          </strong>
        </div>

        <div className="stat-card flex flex-col items-center justify-center p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-md">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
            TARGET
          </span>
          <strong id="target" className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {gameMode === 'unlimited' ? '∞' : levelConfig.target}
          </strong>
        </div>

        <button
          className="flex h-full min-h-12 w-12 items-center justify-center self-stretch rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300 shadow-md transition-colors hover:border-amber-300/50 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          type="button"
          aria-label={isMuted ? 'Nyalakan suara' : 'Matikan suara'}
          aria-pressed={isMuted}
          title={isMuted ? 'Nyalakan suara' : 'Matikan suara'}
          onClick={toggleMuted}
        >
          {isMuted ? (
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="m17 9 5 6m0-6-5 6" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" />
            </svg>
          )}
        </button>
      </section>

      {/* ================================================================= */}
      {/* GAME AREA                                                         */}
      {/* ================================================================= */}
      <section className="level-progress" aria-label="Progres level">
        <div className="flex items-center justify-between gap-3">
          <span>{gameMode === 'target' ? `Level ${level + 1} ? ${levelConfig.name}` : 'Mode santai ? Tanpa batas'}</span>
          <span>{gameMode === 'target' ? `${Math.min(100, Math.floor(score / levelConfig.target * 100))}%` : `${score} poin`}</span>
        </div>
        {gameMode === 'target' && <progress value={Math.min(score, levelConfig.target)} max={levelConfig.target} aria-label="Target skor" />}
        <p>{message}</p>
      </section>
      <section className="game-area relative flex justify-center" aria-label="Area permainan">
        <div
          ref={boardContainerRef}
          className={`board-container relative w-[min(94vw,420px)] aspect-square p-2.5 sm:p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden ${
            gridShaking ? 'animate-grid-shake' : ''
          }`}
        >
          <div
            id="board"
            className="board grid grid-cols-8 grid-rows-8 gap-1 sm:gap-1.5 w-full h-full touch-none select-none"
            role="grid"
            aria-label="Papan permainan Sweet Grid"
            aria-busy={busy}
            data-phase={state.phase}
            data-revision={state.revision}
            aria-rowcount={8}
            aria-colcount={8}
          >
            {board.flatMap((row, r) =>
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
                    <div className="candy-color-bomb-overlay absolute inset-0 rounded-xl flex items-center justify-center">
                      <span className="relative z-10 text-2xl leading-none drop-shadow-[0_0_7px_rgba(255,255,255,0.95)] animate-pulse">
                        🌟
                      </span>
                    </div>
                  )
                } else if (candyData.special === 'striped-horizontal') {
                  specialOverlay = (
                    <>
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-white/70 shadow-sm pointer-events-none" />
                      <span className="absolute inset-0 flex items-center justify-center text-lg leading-none text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.95)] animate-pulse pointer-events-none">
                        ↔️
                      </span>
                    </>
                  )
                } else if (candyData.special === 'striped-vertical') {
                  specialOverlay = (
                    <>
                      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white/70 shadow-sm pointer-events-none" />
                      <span className="absolute inset-0 flex items-center justify-center text-lg leading-none text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.95)] animate-pulse pointer-events-none">
                        ↕️
                      </span>
                    </>
                  )
                } else if (candyData.special === 'wrapped') {
                  specialOverlay = (
                    <>
                      <div className="absolute inset-1 border-2 border-white/80 rounded-lg pointer-events-none" />
                      <span className="absolute inset-0 flex items-center justify-center text-xl leading-none drop-shadow-[0_0_6px_rgba(255,255,255,0.95)] animate-pulse pointer-events-none">
                        💣
                      </span>
                    </>
                  )
                }


                return (
                  <div key={candyData.id} data-motion-id={candyData.id} data-column={c} className="candy-motion relative h-full w-full">
                  <button
                    data-cell={`${r}-${c}`}
                    data-popping={isPopping}
                    type="button"
                    role="gridcell"
                    aria-rowindex={r + 1}
                    aria-colindex={c + 1}
                    draggable={true}
                    aria-selected={isSelected}
                    onTouchStart={e => {
                      if (busy || gameOver) return
                      unlockAudio()
                      suppressClickRef.current = false
                      const touch = e.touches[0]
                      touchStartRef.current = { row: r, column: c, x: touch.clientX, y: touch.clientY }
                    }}
                    onTouchCancel={() => { touchStartRef.current = null }}
                    onTouchEnd={e => {
                      const start = touchStartRef.current
                      touchStartRef.current = null
                      if (!start) return
                      const touch = e.changedTouches[0]
                      const dx = touch.clientX - start.x
                      const dy = touch.clientY - start.y
                      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
                      e.preventDefault()
                      suppressClickRef.current = true
                      const to = { row: start.row + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0), column: start.column + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0) }
                      if (to.row >= 0 && to.row < BOARD_SIZE && to.column >= 0 && to.column < BOARD_SIZE) {
                        void performMove(start, to)
                      }
                    }}
                    onDragStart={() => handleDragStart(r, c)}
                    onDragOver={e => handleDragOver(e, r, c)}
                    onDragEnter={() => handleDragEnter(r, c)}
                    onDragLeave={handleDragLeave}
                    onDrop={event => handleDrop(event, r, c)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleCandyClick(r, c)}
                    className={[
                      `sweet-piece sweet-shape-${candyData.special === 'color-bomb' ? 'bomb' : candyData.type} relative w-full h-full cursor-pointer hover:scale-95 transition-transform`,
                      'rounded-xl shadow-sm border-b-4',
                      pastel.bg,
                      pastel.border,
                      isSelected ? 'ring-4 ring-white scale-90 z-20' : '',
                      isHint ? 'ring-2 ring-amber-300 animate-bounce' : '',


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
                  </div>
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

      {/* Screen-reader live region dari HTML/JS asli */}
      <div id="gameStatus" className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>

      {gameOver && <VictoryModal score={score} won={gameWon} onRestart={() => restartGame()} onNext={level < LEVELS.length - 1 ? () => restartGame(level + 1) : undefined} />}
    </main>
  )
}
