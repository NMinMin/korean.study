import multipart from '@fastify/multipart'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'

const MAX_RECORDING_BYTES = 20 * 1024 * 1024
const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const TRANSCRIPTION_TIMEOUT_MS = 30_000

type GroqTranscription = {
  text?: unknown
}

async function transcribeWithGroq(content: Buffer, mimetype: string, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(content)], { type: mimetype }), filename)
  form.append('model', config.GROQ_SPEECH_MODEL)
  form.append('language', 'ko')
  form.append('response_format', 'json')
  form.append('temperature', '0')

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
  })
  const data = await response.json().catch(() => null) as GroqTranscription | null

  if (!response.ok) {
    const error = new Error(`Groq transcription failed with HTTP ${response.status}`)
    Object.assign(error, { statusCode: 502, cause: data })
    throw error
  }

  return typeof data?.text === 'string' ? data.text.trim() : ''
}

export const shadowingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { files: 1, fileSize: MAX_RECORDING_BYTES, fields: 2 },
  })

  app.post('/shadowing/transcribe', { preHandler: requireAuth }, async (request, reply) => {
    if (!config.GROQ_API_KEY) {
      return reply.code(503).send({
        code: 'SPEECH_NOT_CONFIGURED',
        message: 'Groq Speech-to-Text chưa được cấu hình trên backend.',
        requestId: request.id,
      })
    }

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

    const transcript = await transcribeWithGroq(
      content,
      part.mimetype,
      part.filename || 'shadowing.webm',
    )

    return { transcript, provider: `groq/${config.GROQ_SPEECH_MODEL}` }
  })
}
