import multipart from '@fastify/multipart'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'

const MAX_RECORDING_BYTES = 20 * 1024 * 1024
const TRANSCRIPTION_TIMEOUT_MS = 60_000

type SpeechToTextResponse = {
  text?: unknown
  transcript?: unknown
  detail?: unknown
  message?: unknown
}

async function transcribeRecording(content: Buffer, mimetype: string, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(content)], { type: mimetype }), filename)

  const response = await fetch(config.SPEECH_TO_TEXT_URL, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
  })
  const data = await response.json().catch(() => null) as SpeechToTextResponse | null

  if (!response.ok) {
    const providerMessage = typeof data?.detail === 'string'
      ? data.detail
      : typeof data?.message === 'string' ? data.message : ''
    const error = new Error(providerMessage || `Speech-to-text failed with HTTP ${response.status}`)
    Object.assign(error, { statusCode: 502, cause: data })
    throw error
  }

  const transcript = typeof data?.text === 'string' ? data.text : data?.transcript
  return typeof transcript === 'string' ? transcript.trim() : ''
}

export const shadowingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { files: 1, fileSize: MAX_RECORDING_BYTES, fields: 2 },
  })

  app.post('/shadowing/transcribe', { preHandler: requireAuth }, async (request, reply) => {
    const part = await request.file()
    if (!part) {
      return reply.code(400).send({ code: 'AUDIO_REQUIRED', message: 'Thiếu file ghi âm.', requestId: request.id })
    }
    if (!part.mimetype.startsWith('audio/')) {
      return reply.code(415).send({ code: 'INVALID_AUDIO', message: 'Tệp tải lên không phải âm thanh.', requestId: request.id })
    }

    const content = await part.toBuffer()
    if (!content.length) {
      return reply.code(400).send({ code: 'EMPTY_AUDIO', message: 'File ghi âm không có dữ liệu.', requestId: request.id })
    }

    const transcript = await transcribeRecording(
      content,
      part.mimetype,
      part.filename || 'shadowing.webm',
    )

    if (!transcript) {
      return reply.code(422).send({
        code: 'SPEECH_NOT_RECOGNIZED',
        message: 'Không nhận diện được lời nói trong file ghi âm. Hãy nói rõ và gần micro hơn.',
        requestId: request.id,
      })
    }

    return { transcript, provider: 'speech-to-text-hy3k' }
  })
}
