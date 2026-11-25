import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
process.env.GROQ_GRADER_URL = 'https://example.com/'
const { supabaseAdmin } = await import('../dist/lib/supabase.js')
const { adminRoutes } = await import('../dist/routes/admin.js')
const progress = [
  { user_id: 'u1', textbook_id: 'b1', lesson_id: 'l1', progress_percent: 100 },
  { user_id: 'u1', textbook_id: 'b1', lesson_id: 'l2', progress_percent: 50 },
  { user_id: 'u2', textbook_id: 'b1', lesson_id: 'l1', progress_percent: 0 },
]
supabaseAdmin.rpc = async (name, args) => { assert.equal(name, 'get_curriculum_leaderboard'); assert.deepEqual(args, { p_textbook_id: 'b1', p_page: 1, p_page_size: 100 }); return { data: [{ rank_position: 1, user_id: 'u1', display_name: 'Học viên', xp: 120, streak: 3, total_count: 1 }], error: null } }
supabaseAdmin.auth.getUser = async () => ({ data: { user: { id: 'admin' } }, error: null })
supabaseAdmin.from = (table) => {
  let filtered = progress
  const q = {
    select() { return this },
    eq(key, value) { if (table === 'lesson_progress' && key === 'textbook_id') filtered = progress.filter((row) => row.textbook_id === value); return this },
    order() { return this },
    maybeSingle() { return Promise.resolve({ data: table === 'profiles' ? { is_locked: false } : { role: 'admin' }, error: null }) },
    range(from, to) { return Promise.resolve({ data: filtered.slice(from, to + 1), count: filtered.length, error: null }) },
    then(resolve, reject) { return Promise.resolve({ data: table === 'textbooks' ? [{ id: 'b1', title_ko: '한국어' }, { id: 'b2', title_ko: 'Empty' }] : [], error: null }).then(resolve, reject) },
  }
  return q
}

test('admin course summary and paginated export use recorded lesson progress', async () => {
  const app = Fastify()
  await app.register(adminRoutes, { prefix: '/v1' })
  const unauthenticated = await app.inject({ method: 'GET', url: '/v1/admin/reports/course-progress' })
  assert.equal(unauthenticated.statusCode, 401)
  const headers = { authorization: 'Bearer test' }
  const summary = await app.inject({ method: 'GET', url: '/v1/admin/reports/course-progress', headers })
  assert.equal(summary.statusCode, 200)
  assert.deepEqual(summary.json().data, [
    { id: 'b1', title: '한국어', learners: 2, records: 3, completed: 1, average: 50 },
    { id: 'b2', title: 'Empty', learners: 0, records: 0, completed: 0, average: null },
  ])
  const ranking = await app.inject({ method: 'GET', url: '/v1/admin/reports/leaderboard?textbookId=b1', headers })
  assert.equal(ranking.json().data.items[0].xp, 120)
  assert.equal(ranking.json().data.total, 1)
  const report = await app.inject({ method: 'GET', url: '/v1/admin/reports/lesson-progress?textbookId=b2', headers })
  assert.deepEqual(report.json().data, { items: [], total: 0, page: 1, pageSize: 500 })
  await app.close()
})
