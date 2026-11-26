import { GoogleGenAI } from '@google/genai'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'
import { BusyError, createAdmission } from '../lib/admission.js'
import { getUserGeminiKey } from '../lib/userAiKey.js'

const AI_TIMEOUT_MS = 25_000
const acquireAi = createAdmission(6, 30, 15_000)
const CHAT_RATE_LIMIT_MAX = 12
const CHAT_RATE_LIMIT_WINDOW_MS = 60_000

const CHAT_MODELS = {
  fast: 'gemini-3.5-flash-lite',
  deep: 'gemini-4-hydrogen',
} as const

type ChatModelKey = keyof typeof CHAT_MODELS

const CHAT_MODEL_CHAINS: Record<ChatModelKey, readonly string[]> = {
  fast: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemma-4-31b-it'],
  deep: ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemma-4-31b-it'],
}

function thinkingConfigForModel(model: string): { thinking_level: 'minimal' | 'low' } | undefined {
  if (model.startsWith('gemma-')) return undefined
  return { thinking_level: model.includes('flash-lite') ? 'minimal' : 'low' }
}

const chatRateBuckets = new Map<string, number[]>()

function isChatRateLimited(userId: string) {
  const now = Date.now()
  const cutoff = now - CHAT_RATE_LIMIT_WINDOW_MS
  const recent = (chatRateBuckets.get(userId) || []).filter((ts) => ts > cutoff)
  if (recent.length >= CHAT_RATE_LIMIT_MAX) {
    chatRateBuckets.set(userId, recent)
    return true
  }
  recent.push(now)
  chatRateBuckets.set(userId, recent)
  return false
}

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  modelKey: z.enum(['fast', 'deep']).default('fast'),
  previousInteractionId: z.string().trim().min(1).max(200).optional(),
  context: z.object({
    screen: z.string().trim().max(80).optional(),
    textbookTitle: z.string().trim().max(160).optional(),
    lessonTitle: z.string().trim().max(200).optional(),
    lessonContent: z.string().trim().max(6_000).optional(),
    questionContext: z.string().trim().max(2_000).optional(),
  }).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    text: z.string().trim().min(1).max(2_000),
  })).max(8).optional(),
})

type ChatContext = z.infer<typeof chatRequestSchema>['context']
type ChatHistoryItem = NonNullable<z.infer<typeof chatRequestSchema>['history']>[number]

function buildChatSystemInstruction(context?: ChatContext) {
  const lines = [
    'Bạn là trợ lý học tiếng Hàn thân thiện, chính xác dành cho học viên người Việt trên ứng dụng Korean Study.',
    'Quy tắc trả lời:',
    '- Trả lời bằng tiếng Việt rõ ràng, ngắn gọn, dễ hiểu; ưu tiên dùng bullet hoặc các đoạn ngắn.',
    '- Khi giải thích từ vựng hoặc ngữ pháp, kèm ví dụ tiếng Hàn (Hangul) và nghĩa tiếng Việt tương ứng.',
    '- Khi học viên hỏi về câu hỏi luyện tập hoặc câu sai trong bài thi, giải thích rõ vì sao đáp án đúng là đúng, vì sao phương án khác chưa đúng, và gợi ý mẹo ghi nhớ ngắn.',
    '- Không bịa đặt quy tắc ngữ pháp hay từ vựng; nếu thiếu ngữ cảnh, hãy nói rõ phần chưa đủ thông tin.',
  ]

  if (context?.textbookTitle) lines.push(`Giáo trình hiện tại: ${context.textbookTitle}`)
  if (context?.lessonTitle) lines.push(`Bài học hiện tại: ${context.lessonTitle}`)
  if (context?.screen) lines.push(`Màn hình đang xem: ${context.screen}`)
  if (context?.lessonContent) {
    lines.push(
      `Nội dung thực tế của bài học đang mở (hãy ưu tiên bám sát danh sách từ vựng và ngữ pháp này khi học viên hỏi về bài):\n${context.lessonContent}`,
    )
  }
  if (context?.questionContext) {
    lines.push(`Ngữ cảnh câu hỏi đính kèm:\n${context.questionContext}`)
  }

  return lines.join('\n')
}

function buildChatInput(message: string, history?: ChatHistoryItem[], useHistoryFallback = true) {
  if (!useHistoryFallback || !history?.length) return message
  const transcript = history
    .map((item) => `${item.role === 'user' ? 'Học viên' : 'Trợ lý'}: ${item.text}`)
    .join('\n')
  return `Lịch sử trò chuyện gần đây:\n${transcript}\n\nCâu hỏi hiện tại của học viên:\n${message}`
}

function extractErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const record = error as { status?: unknown; statusCode?: unknown; code?: unknown }
  if (typeof record.status === 'number') return record.status
  if (typeof record.statusCode === 'number') return record.statusCode
  if (typeof record.code === 'number') return record.code
  return undefined
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return ''
}

function isRateLimitError(error: unknown) {
  const status = extractErrorStatus(error)
  if (status === 429) return true
  const msg = extractErrorMessage(error).toUpperCase()
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('RATE_LIMIT') || msg.includes('QUOTA')
}

function isTransientOverloadError(error: unknown) {
  if (isRateLimitError(error)) return true
  const status = extractErrorStatus(error)
  if (status === 503) return true
  const msg = (typeof error === 'string' ? error : extractErrorMessage(error)).toUpperCase()
  return (
    msg.includes('503')
    || msg.includes('UNAVAILABLE')
    || msg.includes('HIGH DEMAND')
    || msg.includes('OVERLOADED')
    || msg.includes('TEMPORARILY UNAVAILABLE')
  )
}

function isInvalidInteractionError(error: unknown) {
  const status = extractErrorStatus(error)
  if (status === 400 || status === 404) return true
  const msg = extractErrorMessage(error).toLowerCase()
  return msg.includes('interaction') && (msg.includes('not found') || msg.includes('expired') || msg.includes('invalid'))
}

function isInvalidApiKeyError(error: unknown) {
  const status = extractErrorStatus(error)
  const msg = extractErrorMessage(error).toLowerCase()
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid') || msg.includes('invalid api key')) {
    return true
  }
  return (status === 401 || status === 403) && (msg.includes('api key') || msg.includes('permission') || msg.includes('unauthenticated'))
}

function writeSseEvent(raw: NodeJS.WritableStream, event: string, data: unknown) {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

const requestSchema = z.object({
  text: z.string().trim().min(1).max(30_000),
  temperature: z.number().min(0).max(1).optional(),
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
    const parsed = requestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'INVALID_AI_REQUEST',
        message: 'Nội dung yêu cầu AI không hợp lệ.',
        requestId: request.id,
      })
    }

    let release: () => void
    try { release = await acquireAi() }
    catch (error) {
      if (!(error instanceof BusyError)) throw error
      return reply.header('Retry-After', '10').code(503).send({ code: 'AI_BUSY', message: error.message, requestId: request.id })
    }
    try {
    let response: Response
    try {
      response = await fetch(config.GROQ_GRADER_URL, {
        method: 'POST',
        headers: {
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
          temperature: parsed.data.temperature ?? 0.2,
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
          message: 'Dịch vụ Groq Worker từ chối yêu cầu AI.',
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
    } finally { release() }
  })

  app.post('/ai/chat', { preHandler: requireAuth }, async (request, reply) => {
    let userApiKey: string | null = null
    try {
      userApiKey = await getUserGeminiKey(request.userId)
    } catch (error) {
      request.log.error({ err: error }, 'Failed to load user Gemini API key')
      return reply.code(500).send({
        code: 'AI_KEY_READ_FAILED',
        message: 'Không thể kiểm tra Gemini API Key của bạn lúc này.',
        requestId: request.id,
      })
    }

    const effectiveApiKey = userApiKey || config.GEMINI_API_KEY
    const keySource: 'user' | 'server' = userApiKey ? 'user' : 'server'

    if (!effectiveApiKey) {
      return reply.code(403).send({
        code: 'GEMINI_KEY_REQUIRED',
        message: 'Bạn cần nhập Gemini API Key cá nhân trước khi sử dụng trợ lý AI.',
        requestId: request.id,
      })
    }

    if (isChatRateLimited(request.userId)) {
      return reply.code(429).send({
        code: 'CHAT_RATE_LIMIT',
        message: 'Bạn gửi hơi nhanh, vui lòng đợi vài giây rồi hỏi tiếp nhé.',
        requestId: request.id,
      })
    }

    const parsed = chatRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'INVALID_CHAT_REQUEST',
        message: 'Nội dung câu hỏi không hợp lệ.',
        requestId: request.id,
      })
    }

    const { message, modelKey, previousInteractionId, context, history } = parsed.data
    const systemInstruction = buildChatSystemInstruction(context)
    const ai = new GoogleGenAI({
      apiKey: effectiveApiKey,
      httpOptions: { timeout: 20_000 },
    })

    const chain = CHAT_MODEL_CHAINS[modelKey]

    const openChatStream = async (targetModel: string, interactionIdToUse?: string) => {
      const input = buildChatInput(message, history, !interactionIdToUse)
      const generationConfig = thinkingConfigForModel(targetModel)
      const stream = await ai.interactions.create({
        model: targetModel,
        input,
        system_instruction: systemInstruction,
        previous_interaction_id: interactionIdToUse,
        ...(generationConfig ? { generation_config: generationConfig } : {}),
        stream: true,
      })
      const iterator = stream[Symbol.asyncIterator]()
      const firstResult = await iterator.next()
      if (!firstResult.done && firstResult.value && typeof firstResult.value === 'object') {
        const firstEv = firstResult.value as { event_type?: string; error?: { message?: string; code?: string } }
        if (firstEv.event_type === 'error') {
          throw new Error(firstEv.error?.message || firstEv.error?.code || 'Upstream stream error')
        }
      }
      return { targetModel, iterator, firstResult }
    }

    let activeStream: Awaited<ReturnType<typeof openChatStream>> | null = null
    let activeChainIndex = 0
    let notice: string | undefined
    let lastOpenError: unknown

    for (let idx = 0; idx < chain.length; idx += 1) {
      const candidateModel = chain[idx] as string
      const interactionToUse = idx === 0 ? previousInteractionId : undefined
      try {
        try {
          activeStream = await openChatStream(candidateModel, interactionToUse)
        } catch (firstError) {
          if (interactionToUse && isInvalidInteractionError(firstError)) {
            activeStream = await openChatStream(candidateModel, undefined)
          } else {
            throw firstError
          }
        }
        activeChainIndex = idx
        if (idx > 0) {
          notice = `Model chính đang quá tải tạm thời, đã tự chuyển sang ${candidateModel}.`
        }
        break
      } catch (error) {
        lastOpenError = error
        if (isInvalidApiKeyError(error)) {
          if (keySource === 'server') {
            return reply.code(502).send({
              code: 'GEMINI_SERVER_KEY_INVALID',
              message: 'Key hệ thống đang gặp lỗi hoặc hết hạn. Bạn có thể tự nhập Gemini API Key cá nhân để tiếp tục dùng ngay nhé.',
              requestId: request.id,
            })
          }
          return reply.code(401).send({
            code: 'GEMINI_KEY_INVALID',
            message: 'Gemini API Key của bạn không hợp lệ hoặc đã bị thu hồi. Hãy kiểm tra và nhập lại key nhé.',
            requestId: request.id,
          })
        }
        if (isTransientOverloadError(error) && idx + 1 < chain.length) {
          request.log.warn({ model: candidateModel, err: error }, 'Gemini model overloaded, trying fallback')
          continue
        }
        break
      }
    }

    if (!activeStream) {
      request.log.error({ err: lastOpenError }, 'Gemini chat request failed across fallback chain')
      if (isTransientOverloadError(lastOpenError)) {
        return reply.code(429).send({
          code: 'GEMINI_RATE_LIMIT',
          message: 'Các model AI đang quá tải tạm thời. Bạn đợi vài giây rồi thử lại nhé.',
          requestId: request.id,
        })
      }
      return reply.code(502).send({
        code: 'GEMINI_UPSTREAM_ERROR',
        message: 'Trợ lý AI tạm thời không phản hồi được. Vui lòng thử lại.',
        requestId: request.id,
      })
    }

    reply.hijack()
    const headers: Record<string, string | string[]> = {}
    for (const [headerName, headerValue] of Object.entries(reply.getHeaders())) {
      if (headerValue === undefined) continue
      headers[headerName] = Array.isArray(headerValue) ? headerValue.map(String) : String(headerValue)
    }
    headers['Content-Type'] = 'text/event-stream; charset=utf-8'
    headers['Cache-Control'] = 'no-cache, no-transform'
    headers['Connection'] = 'keep-alive'
    headers['X-Accel-Buffering'] = 'no'
    reply.raw.writeHead(200, headers)

    writeSseEvent(reply.raw, 'meta', {
      modelKey,
      model: activeStream.targetModel,
      keySource,
      ...(notice ? { notice } : {}),
    })

    let latestInteractionId: string | undefined
    let lastStatus: string | undefined
    let lastUsage: unknown
    let deltaCount = 0
    let totalChars = 0
    const eventTypes = new Set<string>()
    let finishedCleanly = false

    const handleEvent = (event: unknown): { overloadError?: string; fatalError?: { code: string; message: string } } => {
      if (!event || typeof event !== 'object') return {}
      const ev = event as {
        event_type?: string
        status?: string
        interaction?: { id?: string; status?: string; usage?: unknown }
        delta?: { type?: string; text?: string }
        error?: { code?: string; message?: string }
      }
      if (typeof ev.event_type === 'string' && ev.event_type) {
        eventTypes.add(ev.event_type)
      }
      if (typeof ev.interaction?.id === 'string' && ev.interaction.id) {
        latestInteractionId = ev.interaction.id
      }
      if (typeof ev.interaction?.status === 'string') {
        lastStatus = ev.interaction.status
      } else if (typeof ev.status === 'string') {
        lastStatus = ev.status
      }
      if (ev.interaction?.usage !== undefined) {
        lastUsage = ev.interaction.usage
      }

      if (ev.event_type === 'error') {
        const errMsg = ev.error?.message || ev.error?.code || 'Upstream stream error'
        if (isTransientOverloadError(errMsg)) {
          return { overloadError: errMsg }
        }
        return {
          fatalError: {
            code: ev.error?.code || 'UPSTREAM_STREAM_ERROR',
            message: 'Trợ lý AI gặp lỗi khi đang trả lời. Vui lòng thử lại.',
          },
        }
      }

      if ((ev.event_type === 'step.delta' || ev.event_type === 'content.delta') && ev.delta?.type === 'text' && ev.delta.text) {
        deltaCount += 1
        totalChars += ev.delta.text.length
        writeSseEvent(reply.raw, 'delta', { text: ev.delta.text })
      }
      return {}
    }

    try {
      while (activeStream && !reply.raw.destroyed && !reply.raw.writableEnded) {
        let overloadErr: unknown = null
        let fatalErr: { code: string; message: string } | null = null

        try {
          if (!activeStream.firstResult.done) {
            const res = handleEvent(activeStream.firstResult.value)
            if (res.overloadError) overloadErr = res.overloadError
            if (res.fatalError) fatalErr = res.fatalError
          }
          while (!overloadErr && !fatalErr && !reply.raw.destroyed && !reply.raw.writableEnded) {
            const next = await activeStream.iterator.next()
            if (next.done) break
            const res = handleEvent(next.value)
            if (res.overloadError) overloadErr = res.overloadError
            if (res.fatalError) fatalErr = res.fatalError
          }
        } catch (iterError) {
          if (isTransientOverloadError(iterError)) {
            overloadErr = iterError
          } else {
            throw iterError
          }
        }

        if (overloadErr && activeChainIndex + 1 < chain.length && !reply.raw.destroyed && !reply.raw.writableEnded) {
          request.log.warn({ model: activeStream.targetModel, err: overloadErr }, 'Gemini mid-stream overload, switching to fallback')
          let switched = false
          for (let nextIdx = activeChainIndex + 1; nextIdx < chain.length; nextIdx += 1) {
            const nextModel = chain[nextIdx] as string
            try {
              activeStream = await openChatStream(nextModel, undefined)
              activeChainIndex = nextIdx
              latestInteractionId = undefined
              lastStatus = undefined
              deltaCount = 0
              totalChars = 0
              writeSseEvent(reply.raw, 'reset', {
                modelKey,
                model: nextModel,
                notice: `Model đang quá tải tạm thời, đã tự chuyển sang ${nextModel}.`,
              })
              switched = true
              break
            } catch (switchError) {
              request.log.warn({ nextModel, err: switchError }, 'Gemini fallback model failed')
              continue
            }
          }
          if (switched) continue
        }

        if (overloadErr) {
          writeSseEvent(reply.raw, 'error', {
            code: 'GEMINI_OVERLOADED',
            message: 'Các model AI đang quá tải tạm thời. Bạn đợi vài giây rồi thử lại nhé.',
          })
          break
        }

        if (fatalErr) {
          writeSseEvent(reply.raw, 'error', fatalErr)
          break
        }

        finishedCleanly = true
        break
      }

      request.log.info({
        model: activeStream?.targetModel,
        modelKey,
        status: lastStatus,
        usage: lastUsage,
        deltaCount,
        totalChars,
        eventTypes: [...eventTypes],
        destroyed: reply.raw.destroyed,
      }, 'Gemini chat stream finished')

      if (finishedCleanly && !reply.raw.destroyed && !reply.raw.writableEnded) {
        if (lastStatus === 'failed' || lastStatus === 'cancelled') {
          writeSseEvent(reply.raw, 'error', {
            code: 'INTERACTION_FAILED',
            message: 'Phản hồi bị gián đoạn từ phía Google AI. Vui lòng thử lại.',
          })
        } else {
          writeSseEvent(reply.raw, 'done', {
            interactionId: latestInteractionId,
            modelKey,
            model: activeStream?.targetModel,
            ...(lastStatus === 'incomplete' ? { notice: 'Câu trả lời bị cắt ngắn bởi máy chủ AI.' } : {}),
          })
        }
      }
    } catch (streamError) {
      request.log.error({ err: streamError }, 'Gemini chat stream error')
      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        writeSseEvent(reply.raw, 'error', {
          code: 'STREAM_ERROR',
          message: 'Kết nối phản hồi bị gián đoạn. Vui lòng thử lại.',
        })
      }
    } finally {
      if (!reply.raw.writableEnded) {
        reply.raw.end()
      }
    }
  })
}
