import { useRef, useState, useCallback, useEffect } from 'react'

const AUTO_STOP_MS = 15_000

export function useAlertSound() {
  const audioRef  = useRef(null)
  const timerRef  = useRef(null)
  const mutedRef  = useRef(false)
  const [muted,   setMuted]   = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => { mutedRef.current = muted }, [muted])

  const stop = useCallback(() => {
    clearTimeout(timerRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlaying(false)
  }, [])

  const play = useCallback((soundFile) => {
    if (mutedRef.current) return
    stop()
    const audio = new Audio(soundFile)
    audioRef.current = audio
    audio.onended = () => { clearTimeout(timerRef.current); setPlaying(false) }
    audio.play().catch(() => {})
    setPlaying(true)
    timerRef.current = setTimeout(stop, AUTO_STOP_MS)
  }, [stop])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (!m) stop()
      return !m
    })
  }, [stop])

  return { play, stop, muted, toggleMute, playing }
}
