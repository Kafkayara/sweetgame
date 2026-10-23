'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SoundEffect = 'swap' | 'pop' | 'explode' | 'win'
interface PlaySoundOptions { playbackRate?: number; volume?: number }

// Small synthesized candy sounds: no network requests or missing audio assets.
export function useGameAudio() {
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)
  const contextRef = useRef<AudioContext | null>(null)
  const voicesRef = useRef(new Set<OscillatorNode>())

  useEffect(() => () => {
    void contextRef.current?.close().catch(() => {})
    contextRef.current = null
    voicesRef.current.clear()
  }, [])

  const playSound = useCallback((sound: SoundEffect, options: PlaySoundOptions = {}) => {
    if (isMutedRef.current || typeof window === 'undefined' || !window.AudioContext) return
    try {
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      const schedule = () => {
        if (isMutedRef.current || context.state !== 'running') return
        const rate = Math.max(0.5, Math.min(2, options.playbackRate ?? 1))
        const volume = Math.max(0, Math.min(1, options.volume ?? 0.7))
        const notes = sound === 'win' ? [523.25, 659.25, 783.99, 1046.5]
          : sound === 'pop' ? [784, 1046.5, 1318.5]
          : sound === 'explode' ? [130, 196, 98] : [460]
        notes.forEach((frequency, index) => {
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          const start = context.currentTime + index * (sound === 'win' ? 0.11 : 0.035)
          const duration = (sound === 'explode' ? 0.28 : sound === 'swap' ? 0.09 : 0.16) / rate
          oscillator.type = sound === 'explode' ? 'triangle' : 'sine'
          oscillator.frequency.setValueAtTime(frequency * rate, start)
          oscillator.frequency.exponentialRampToValueAtTime(frequency * rate * (sound === 'explode' ? 0.25 : 1.35), start + duration)
          gain.gain.setValueAtTime(0, start)
          gain.gain.linearRampToValueAtTime(volume * 0.12, start + 0.008)
          gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
          oscillator.connect(gain)
          gain.connect(context.destination)
          voicesRef.current.add(oscillator)
          oscillator.onended = () => {
            voicesRef.current.delete(oscillator)
            oscillator.disconnect()
            gain.disconnect()
          }
          oscillator.start(start)
          oscillator.stop(start + duration + 0.02)
        })
      }
      // The first swap runs inside a user gesture and unlocks audio for cascades.
      if (context.state === 'suspended') void context.resume().then(schedule).catch(() => {})
      else schedule()
    } catch {
      // Browsers without usable audio can still play the game.
    }
  }, [])

  const toggleMuted = useCallback(() => {
    isMutedRef.current = !isMutedRef.current
    setIsMuted(isMutedRef.current)
    if (isMutedRef.current) {
      voicesRef.current.forEach(voice => { try { voice.stop() } catch {} })
    }
  }, [])

  return { isMuted, playSound, toggleMuted }
}
