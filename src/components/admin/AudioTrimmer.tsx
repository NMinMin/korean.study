import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Play, Scissors, Square, X } from 'lucide-react'
import { decodeAudioSource, formatAudioTime, trimAudioBufferToWavFile, type DecodedAudioInfo } from '../../lib/audioTrimmer'

type Props = {
  source: File | string
  fileName: string
  onApplyTrim: (trimmedFile: File, startSec: number, endSec: number) => void
  onCancel: () => void
}

const MIN_GAP_SECONDS = 0.1

export default function AudioTrimmer({ source, fileName, onApplyTrim, onCancel }: Props) {
  const [info, setInfo] = useState<DecodedAudioInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null)

  const waveRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const boundsRef = useRef({ startSec: 0, endSec: 0 })
  boundsRef.current = { startSec, endSec }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setPlaying(false)

    decodeAudioSource(source)
      .then((decoded) => {
        if (!active) return
        setInfo(decoded)
        setStartSec(0)
        setEndSec(Number(decoded.duration.toFixed(2)))
        setPlayhead(0)
      })
      .catch((cause) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Không thể đọc dữ liệu sóng âm từ file này.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [source])

  useEffect(() => {
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source)
    const audio = new Audio(objectUrl || (source as string))
    audio.preload = 'auto'
    audioRef.current = audio

    const stopPlayback = () => {
      setPlaying(false)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    audio.addEventListener('ended', stopPlayback)
    audio.addEventListener('pause', stopPlayback)

    return () => {
      stopPlayback()
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [source])

  const stopPreview = () => {
    const audio = audioRef.current
    if (audio && !audio.paused) audio.pause()
    setPlaying(false)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const togglePlaySelection = async () => {
    const audio = audioRef.current
    if (!audio || !info) return
    if (playing) {
      stopPreview()
      return
    }
    const startFrom = playhead >= startSec && playhead < endSec - 0.05 ? playhead : startSec
    audio.currentTime = startFrom
    setPlayhead(startFrom)
    try {
      await audio.play()
      setPlaying(true)
      const tick = () => {
        if (!audioRef.current || audioRef.current.paused) return
        const current = audioRef.current.currentTime
        if (current >= boundsRef.current.endSec) {
          audioRef.current.pause()
          audioRef.current.currentTime = boundsRef.current.startSec
          setPlayhead(boundsRef.current.startSec)
          setPlaying(false)
          return
        }
        setPlayhead(current)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setError('Không thể phát đoạn âm thanh này.')
    }
  }

  const clientXToSeconds = (clientX: number) => {
    const rect = waveRef.current?.getBoundingClientRect()
    if (!rect || !info || rect.width <= 0) return 0
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Number((ratio * info.duration).toFixed(2))
  }

  const updateStart = (next: number) => {
    if (!info) return
    const clamped = Math.max(0, Math.min(next, endSec - MIN_GAP_SECONDS))
    setStartSec(Number(clamped.toFixed(2)))
    if (playhead < clamped) setPlayhead(clamped)
  }

  const updateEnd = (next: number) => {
    if (!info) return
    const clamped = Math.min(info.duration, Math.max(next, startSec + MIN_GAP_SECONDS))
    setEndSec(Number(clamped.toFixed(2)))
    if (playhead > clamped) setPlayhead(clamped)
  }

  const handleApply = () => {
    if (!info) return
    stopPreview()
    const trimmedFile = trimAudioBufferToWavFile(info.buffer, startSec, endSec, fileName || 'audio')
    onApplyTrim(trimmedFile, startSec, endSec)
  }

  if (loading) {
    return (
      <div className="admin-trimmer admin-trimmer-state">
        <LoaderCircle className="spin" size={18} />
        <span>Đang phân tích sóng âm…</span>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="admin-trimmer admin-trimmer-state is-error">
        <span>{error || 'Không thể mở trình cắt file nghe.'}</span>
        <button type="button" className="admin-cancel" onClick={onCancel}>Đóng</button>
      </div>
    )
  }

  const duration = Math.max(0.1, info.duration)
  const startPct = (startSec / duration) * 100
  const endPct = (endSec / duration) * 100
  const playheadPct = Math.max(0, Math.min(100, (playhead / duration) * 100))
  const selectedDuration = Math.max(0, endSec - startSec)

  return (
    <div className="admin-trimmer">
      <div className="admin-trimmer-head">
        <strong>Cắt đoạn nghe</strong>
        <span>{formatAudioTime(selectedDuration)} / {formatAudioTime(duration)}</span>
        <button type="button" onClick={() => { stopPreview(); onCancel() }} aria-label="Đóng trình cắt">
          <X size={14} />
        </button>
      </div>

      <div
        ref={waveRef}
        className="admin-trimmer-wave"
        onClick={(event) => {
          if (draggingHandle) return
          const targetSec = clientXToSeconds(event.clientX)
          setPlayhead(targetSec)
          if (audioRef.current) audioRef.current.currentTime = targetSec
        }}
      >
        <div className="admin-trimmer-bars" aria-hidden="true">
          {info.peaks.map((peak, index) => {
            const barPct = ((index + 0.5) / info.peaks.length) * 100
            const inRange = barPct >= startPct && barPct <= endPct
            return (
              <span
                key={index}
                className={`admin-trimmer-bar${inRange ? ' is-active' : ''}`}
                style={{ height: `${Math.round(peak * 100)}%` }}
              />
            )
          })}
        </div>

        <div className="admin-trimmer-mask is-left" style={{ width: `${startPct}%` }} />
        <div className="admin-trimmer-mask is-right" style={{ width: `${100 - endPct}%` }} />

        <div className="admin-trimmer-selection" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}>
          <button
            type="button"
            className="admin-trimmer-handle is-start"
            aria-label="Điểm bắt đầu"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              setDraggingHandle('start')
            }}
            onPointerMove={(event) => {
              if (draggingHandle !== 'start') return
              updateStart(clientXToSeconds(event.clientX))
            }}
            onPointerUp={(event) => {
              if (draggingHandle === 'start') {
                event.currentTarget.releasePointerCapture(event.pointerId)
                setDraggingHandle(null)
              }
            }}
          />
          <button
            type="button"
            className="admin-trimmer-handle is-end"
            aria-label="Điểm kết thúc"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              setDraggingHandle('end')
            }}
            onPointerMove={(event) => {
              if (draggingHandle !== 'end') return
              updateEnd(clientXToSeconds(event.clientX))
            }}
            onPointerUp={(event) => {
              if (draggingHandle === 'end') {
                event.currentTarget.releasePointerCapture(event.pointerId)
                setDraggingHandle(null)
              }
            }}
          />
        </div>

        <div className="admin-trimmer-playhead" style={{ left: `${playheadPct}%` }} />
      </div>

      <div className="admin-trimmer-controls">
        <button type="button" className="admin-trimmer-play" onClick={() => void togglePlaySelection()}>
          {playing ? <Square size={13} /> : <Play size={13} />}
          <span>{playing ? 'Dừng' : 'Nghe đoạn chọn'}</span>
        </button>
        <span className="admin-trimmer-clock">Kim: {formatAudioTime(playhead)}</span>
      </div>

      <div className="admin-trimmer-times">
        <label>
          <span>Bắt đầu ({formatAudioTime(startSec)})</span>
          <div className="admin-trimmer-time-input">
            <input
              type="number"
              min={0}
              max={Math.max(0, endSec - MIN_GAP_SECONDS)}
              step="0.1"
              value={startSec}
              onChange={(event) => updateStart(Number(event.target.value) || 0)}
            />
            <button type="button" title="Đặt điểm bắt đầu tại vị trí kim hiện tại" onClick={() => updateStart(playhead)}>
              Tại kim
            </button>
          </div>
        </label>
        <label>
          <span>Kết thúc ({formatAudioTime(endSec)})</span>
          <div className="admin-trimmer-time-input">
            <input
              type="number"
              min={Math.min(duration, startSec + MIN_GAP_SECONDS)}
              max={duration}
              step="0.1"
              value={endSec}
              onChange={(event) => updateEnd(Number(event.target.value) || 0)}
            />
            <button type="button" title="Đặt điểm kết thúc tại vị trí kim hiện tại" onClick={() => updateEnd(playhead)}>
              Tại kim
            </button>
          </div>
        </label>
      </div>

      <div className="admin-trimmer-footer">
        <button type="button" className="admin-cancel" onClick={() => { stopPreview(); onCancel() }}>
          Hủy
        </button>
        <button type="button" className="admin-primary" onClick={handleApply}>
          <Scissors size={14} /> Áp dụng cắt
        </button>
      </div>
    </div>
  )
}
