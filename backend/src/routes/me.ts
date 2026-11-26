import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { config } from '../config.js'
import { supabaseAdmin } from '../lib/supabase.js'
import {
  deleteUserGeminiKey,
  getUserGeminiKeyStatus,
  saveUserGeminiKey,
} from '../lib/userAiKey.js'
import { requireAuth } from '../plugins/auth.js'

const aiKeySchema = z.object({
  apiKey: z.string().trim().min(20).max(300).regex(/^[A-Za-z0-9._-]+$/),
})

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, avatar_url, timezone, xp, level, created_at')
      .eq('id', request.userId)
      .single()
    if (error) return reply.code(500).send({ code: 'PROFILE_READ_FAILED', message: 'Không thể tải hồ sơ.', requestId: request.id })
    return { data }
  })

  app.get('/me/ai-key', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getUserGeminiKeyStatus(request.userId)
      return { data: { ...data, hasServerKey: Boolean(config.GEMINI_API_KEY) } }
    } catch (error) {
      request.log.error({ err: error }, 'Failed to load user AI key status')
      return reply.code(500).send({
        code: 'AI_KEY_READ_FAILED',
        message: 'Không thể kiểm tra trạng thái API key lúc này.',
        requestId: request.id,
      })
    }
  })

  app.put('/me/ai-key', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = aiKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'INVALID_AI_KEY_FORMAT',
        message: 'API key không đúng định dạng (cần ít nhất 20 ký tự, không chứa khoảng trắng).',
        requestId: request.id,
      })
    }

    try {
      const data = await saveUserGeminiKey(request.userId, parsed.data.apiKey)
      return { data: { ...data, hasServerKey: Boolean(config.GEMINI_API_KEY) } }
    } catch (error) {
      request.log.error({ err: error }, 'Failed to save user AI key')
      return reply.code(500).send({
        code: 'AI_KEY_SAVE_FAILED',
        message: 'Không thể lưu API key lúc này. Vui lòng thử lại.',
        requestId: request.id,
      })
    }
  })

  app.delete('/me/ai-key', { preHandler: requireAuth }, async (request, reply) => {
    try {
      await deleteUserGeminiKey(request.userId)
      return {
        data: {
          hasKey: false,
          hasServerKey: Boolean(config.GEMINI_API_KEY),
          maskedKey: null,
          updatedAt: null,
        },
      }
    } catch (error) {
      request.log.error({ err: error }, 'Failed to delete user AI key')
      return reply.code(500).send({
        code: 'AI_KEY_DELETE_FAILED',
        message: 'Không thể xóa API key lúc này.',
        requestId: request.id,
      })
    }
  })
}
