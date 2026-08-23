import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
const AI_TIMEOUT_MS = 25_000

const requestSchema = z.object({
  text: z.string().trim().min(1).max(15_000),
})

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: unknown } }>
  model?: unknown
  error?: {
    code?: unknown
    message?: unknown
    type?: unknown
  }
}

function groqErrorCode(data: GroqChatResponse | null) {
  return typeof data?.error?.code === 'string'
    ? data.error.code
    : typeof data?.error?.type === 'string'
      ? data.error.type
      : undefined
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.post('/ai/json', { preHandler: requireAuth }, async (request, reply) => {
    const apiKey = config.GROQ_GRADER_API_KEY
    if (!apiKey) {
      return reply.code(503).send({
        code: 'AI_GRADER_NOT_CONFIGURED',
        message: 'Groq AI Grader chưa được cấu hình trên backend.',
        requestId: request.id,
      })
    }

    const parsed = requestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'INVALID_AI_REQUEST',
        message: 'Nội dung yêu cầu AI không hợp lệ.',
        requestId: request.id,
      })
    }

    let response: Response
    try {
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.GROQ_GRADER_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Bạn là trợ lý giáo dục tiếng Hàn. Luôn tuân thủ yêu cầu đầu ra JSON và không thêm markdown.',
            },
            { role: 'user', content: parsed.data.text },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_completion_tokens: 2_048,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      })
    } catch (error) {
      request.log.error({ err: error }, 'Groq AI Grader request failed')
      return reply.code(504).send({
        code: 'AI_GRADER_TIMEOUT',
        message: 'Groq AI Grader phản hồi quá chậm. Vui lòng thử lại.',
        requestId: request.id,
      })
    }

    const data = await response.json().catch(() => null) as GroqChatResponse | null
    if (!response.ok) {
      request.log.error({ groqStatus: response.status, groqError: data?.error }, 'Groq AI Grader rejected request')

      if (response.status === 429) {
        return reply.code(429).send({
          code: 'AI_GRADER_RATE_LIMIT',
          message: 'Groq AI Grader đã chạm giới hạn lượt dùng. Vui lòng đợi rồi thử lại.',
          upstreamStatus: response.status,
          upstreamCode: groqErrorCode(data),
          requestId: request.id,
        })
      }

      if (response.status === 401 || response.status === 403) {
        return reply.code(502).send({
          code: 'AI_GRADER_CREDENTIALS_REJECTED',
          message: 'Groq không chấp nhận API key của AI Grader.',
          upstreamStatus: response.status,
          upstreamCode: groqErrorCode(data),
          requestId: request.id,
        })
      }

      return reply.code(502).send({
        code: 'AI_GRADER_UPSTREAM_ERROR',
        message: 'Groq AI Grader tạm thời không xử lý được yêu cầu.',
        upstreamStatus: response.status,
        upstreamCode: groqErrorCode(data),
        requestId: request.id,
      })
    }

    const result = data?.choices?.[0]?.message?.content
    if (typeof result !== 'string' || !result.trim()) {
      request.log.error({ groqResponse: data }, 'Groq AI Grader returned an empty response')
      return reply.code(502).send({
        code: 'AI_GRADER_INVALID_RESPONSE',
        message: 'Groq AI Grader trả về kết quả không hợp lệ.',
        requestId: request.id,
      })
    }

    return {
      result: result.trim(),
      model: typeof data?.model === 'string' ? data.model : config.GROQ_GRADER_MODEL,
    }
  })
}
