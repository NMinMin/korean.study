import multipart from '@fastify/multipart'
import { v2 as speechV2 } from '@google-cloud/speech'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'

const MAX_RECORDING_BYTES = 20 * 1024 * 1024

function createSpeechClient() {
  if (!config.GOOGLE_CLOUD_PROJECT_ID || !config.GOOGLE_APPLICATION_CREDENTIALS_JSON) return null
  const credentials = JSON.parse(config.GOOGLE_APPLICATION_CREDENTIALS_JSON) as {
    client_email?: string
    private_key?: string
  }
  return new speechV2.SpeechClient({
    projectId: config.GOOGLE_CLOUD_PROJECT_ID,
    credentials,
  })
}

export const shadowingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { files: 1, fileSize: MAX_RECORDING_BYTES, fields: 2 },
  })

  app.post('/shadowing/transcribe', { preHandler: requireAuth }, async (request, reply) => {
    let client: speechV2.SpeechClient | null
    try {
      client = createSpeechClient()
    } catch {
      client = null
    }
    if (!client || !config.GOOGLE_CLOUD_PROJECT_ID) {
      return reply.code(503).send({
        code: 'SPEECH_NOT_CONFIGURED',
        message: 'Google Speech-to-Text chưa được cấu hình trên backend.',
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

    const [response] = await client.recognize({
      recognizer: `projects/${config.GOOGLE_CLOUD_PROJECT_ID}/locations/global/recognizers/_`,
      config: {
        autoDecodingConfig: {},
        languageCodes: ['ko-KR'],
        model: 'short',
        features: { enableAutomaticPunctuation: true },
      },
      content,
    })
    const alternatives = (response.results ?? [])
      .map((result) => result.alternatives?.[0])
      .filter((alternative): alternative is NonNullable<typeof alternative> => Boolean(alternative?.transcript))
    const transcript = alternatives.map((alternative) => alternative.transcript).join(' ').trim()
    const confidence = alternatives.length
      ? alternatives.reduce((sum, alternative) => sum + Number(alternative.confidence || 0), 0) / alternatives.length
      : 0

    return { transcript, confidence, provider: 'google-cloud-speech-v2' }
  })
}
