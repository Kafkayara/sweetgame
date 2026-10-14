'use client'

import { useCallback, useRef, useState } from 'react'

type SoundEffect = 'swap' | 'pop' | 'explode' | 'win'

interface PlaySoundOptions {
  playbackRate?: number
  volume?: number
}

const SOUND_FILES: Record<SoundEffect, string> = {
  swap: 'swap.mp3',
  pop: 'pop.mp3',
  explode: 'explode.mp3',
  win: 'win.mp3',
}

export function useGameAudio() {
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)

  const playSound = useCallback((sound: SoundEffect, options: PlaySoundOptions = {}) => {
    if (isMutedRef.current || typeof Audio === 'undefined') return

    try {
      const audio = new Audio(`/sounds/${SOUND_FILES[sound]}`)
      audio.volume = Math.max(0, Math.min(1, options.volume ?? 0.7))
      audio.playbackRate = Math.max(0.5, Math.min(2, options.playbackRate ?? 1))
      void audio.play().catch(error => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') return
        if (error instanceof DOMException && error.name === 'NotSupportedError') return
        console.error(`Tidak dapat memutar efek suara "${sound}".`, error)
      })
    } catch (error) {
      console.error(`Tidak dapat memutar efek suara "${sound}".`, error)
    }
  }, [])

  const toggleMuted = useCallback(() => {
    const next = !isMutedRef.current
    isMutedRef.current = next
    setIsMuted(next)
  }, [])

  return { isMuted, playSound, toggleMuted }
}
