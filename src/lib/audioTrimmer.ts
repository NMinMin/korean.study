export type DecodedAudioInfo = {
  buffer: AudioBuffer
  duration: number
  peaks: number[]
}

function getAudioContextClass(): typeof AudioContext {
  const win = window as Window & { webkitAudioContext?: typeof AudioContext }
  const Ctor = window.AudioContext || win.webkitAudioContext
  if (!Ctor) throw new Error('Trình duyệt không hỗ trợ xử lý âm thanh (Web Audio API).')
  return Ctor
}

export async function decodeAudioSource(source: File | string, numPeaks = 96): Promise<DecodedAudioInfo> {
  let arrayBuffer: ArrayBuffer
  if (typeof source === 'string') {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Không thể tải file âm thanh (${response.status}).`)
    arrayBuffer = await response.arrayBuffer()
  } else {
    arrayBuffer = await source.arrayBuffer()
  }

  const AudioCtx = getAudioContextClass()
  const context = new AudioCtx()
  try {
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0))
    const peaks = computeWaveformPeaks(buffer, numPeaks)
    return { buffer, duration: buffer.duration, peaks }
  } finally {
    await context.close().catch(() => undefined)
  }
}

function computeWaveformPeaks(buffer: AudioBuffer, numPeaks: number): number[] {
  const totalSamples = buffer.length
  const channels = Math.max(1, buffer.numberOfChannels)
  const blockSize = Math.max(1, Math.floor(totalSamples / numPeaks))
  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index))
  const rawPeaks: number[] = []

  for (let i = 0; i < numPeaks; i += 1) {
    const start = i * blockSize
    const end = Math.min(totalSamples, start + blockSize)
    let maxVal = 0
    const step = Math.max(1, Math.floor((end - start) / 40))
    for (let s = start; s < end; s += step) {
      let sum = 0
      for (let c = 0; c < channels; c += 1) {
        sum += Math.abs(channelData[c][s] || 0)
      }
      const avg = sum / channels
      if (avg > maxVal) maxVal = avg
    }
    rawPeaks.push(maxVal)
  }

  const maxPeak = Math.max(0.001, ...rawPeaks)
  return rawPeaks.map((peak) => Math.max(0.08, Math.min(1, peak / maxPeak)))
}

export function trimAudioBufferToWavFile(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  baseName = 'audio',
): File {
  const duration = buffer.duration
  const safeStart = Math.max(0, Math.min(startSec, Math.max(0, duration - 0.1)))
  const safeEnd = Math.max(safeStart + 0.1, Math.min(endSec, duration))

  const startFrame = Math.floor(safeStart * buffer.sampleRate)
  const endFrame = Math.min(buffer.length, Math.ceil(safeEnd * buffer.sampleRate))
  const sliceLength = Math.max(1, endFrame - startFrame)
  const channels = Math.max(1, buffer.numberOfChannels)

  const mono = new Float32Array(sliceLength)
  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < sliceLength; i += 1) {
      mono[i] += data[startFrame + i] / channels
    }
  }

  const targetRate = buffer.sampleRate > 22050 ? 22050 : buffer.sampleRate
  const resampled = targetRate === buffer.sampleRate ? mono : resampleLinear(mono, buffer.sampleRate, targetRate)
  const wavBuffer = encodeMonoWav16(resampled, targetRate)

  const cleanName = baseName.replace(/\.[^/.]+$/, '').replace(/[^\w.-]+/g, '_') || 'audio'
  return new File([wavBuffer], `${cleanName}-trimmed.wav`, { type: 'audio/wav' })
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i += 1) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(input.length - 1, left + 1)
    const frac = pos - left
    output[i] = input[left] * (1 - frac) + input[right] * frac
  }
  return output
}

function encodeMonoWav16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataLength = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return buffer
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`
}
