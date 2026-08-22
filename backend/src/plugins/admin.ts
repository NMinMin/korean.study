import type { FastifyReply, FastifyRequest } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'
import { requireAuth } from './auth.js'

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', request.userId)
    .maybeSingle()
  if (error || data?.role !== 'admin') {
    return reply.code(403).send({ code: 'ADMIN_REQUIRED', message: 'Bạn không có quyền quản trị.', requestId: request.id })
  }
}
