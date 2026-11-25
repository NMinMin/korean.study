import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
process.env.GROQ_GRADER_URL = 'https://example.com/'
const { supabaseAdmin } = await import('../dist/lib/supabase.js')
const { adminRoutes } = await import('../dist/routes/admin.js')

const calls = []
supabaseAdmin.auth.getUser = async () => ({ data: { user: { id: 'admin' } }, error: null })
supabaseAdmin.from = (table) => {
  const query = {
    select(...args) { calls.push([table, 'select', ...args]); return this },
    eq(...args) { calls.push([table, 'eq', ...args]); return this },
    order(...args) { calls.push([table, 'order', ...args]); return this },
    maybeSingle() { return Promise.resolve({ data: table === 'profiles' ? { is_locked: false } : { role: 'admin' }, error: null }) },
    range(...args) { calls.push([table, 'range', ...args]); return Promise.resolve({ data: [{ user_id: 'learner', progress_percent: 75, updated_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Học viên' } }], count: 21, error: null }) },
  }
  return query
}

test('admin lesson ranking is authenticated, paginated and wrapped for adminApi', async () => {
  const app = Fastify()
  await app.register(adminRoutes, { prefix: '/v1' })
  const unauthorized = await app.inject({ method: 'GET', url: '/v1/admin/lessons/lesson-1/ranking' })
  assert.equal(unauthorized.statusCode, 401)
  const response = await app.inject({ method: 'GET', url: '/v1/admin/lessons/lesson-1/ranking?page=2', headers: { authorization: 'Bearer test' } })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().data, { items: [{ user_id: 'learner', progress_percent: 75, updated_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Học viên' } }], total: 21, page: 2, pageSize: 20 })
  assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['lesson_progress', 'eq', 'lesson_id', 'lesson-1'])))
  assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['lesson_progress', 'range', 20, 39])))
  await app.close()
})
