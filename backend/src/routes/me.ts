import type { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'
import { requireAuth } from '../plugins/auth.js'

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
}
