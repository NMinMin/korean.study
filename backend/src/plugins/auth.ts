import type { FastifyReply, FastifyRequest } from 'fastify'
import { userFromAccessToken } from '../lib/supabase.js'
import { supabaseAdmin } from '../lib/supabase.js'

declare module 'fastify' {
  interface FastifyRequest { userId: string }
}
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Bạn cần đăng nhập.', requestId: request.id })
  const user = await userFromAccessToken(token)
  if (!user) return reply.code(401).send({ code: 'INVALID_SESSION', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', requestId: request.id })
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_locked').eq('id', user.id).maybeSingle()
  if (profile?.is_locked) return reply.code(403).send({ code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị quản trị viên khóa.', requestId: request.id })
  request.userId = user.id
}
