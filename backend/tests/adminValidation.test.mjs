import assert from 'node:assert/strict'
import test from 'node:test'
import { adminBodySchema } from '../dist/lib/adminValidation.js'

test('rejects malformed admin creation fields instead of crashing handlers', () => {
  const schema = adminBodySchema('POST', '/v1/admin/textbooks')
  for (const body of [null, {}, { slug: 1, titleKo: 'Test' }, { slug: ' ', titleKo: 'Test' }, { slug: 'book', titleKo: 'Test', status: 'invalid' }]) {
    assert.equal(schema.safeParse(body).success, false)
  }
  assert.equal(schema.safeParse({ slug: 'book', titleKo: 'Test', status: 'published' }).success, true)
})

test('moderation requires explicit booleans and a real action', () => {
  const vocabulary = adminBodySchema('PATCH', '/v1/admin/community/custom-lessons/:id')
  assert.equal(vocabulary.safeParse({ hidden: 'false' }).success, false)
  assert.equal(vocabulary.safeParse({ hidden: false }).success, true)
  const posts = adminBodySchema('PATCH', '/v1/admin/community/posts/:id')
  assert.equal(posts.safeParse({}).success, false)
  assert.equal(posts.safeParse({ commentsLocked: false }).success, true)
})

test('validates lesson numbers, exercise skills and role updates', () => {
  const lesson = adminBodySchema('PATCH', '/v1/admin/lessons/:id')
  assert.equal(lesson.safeParse({ lessonNumber: -1 }).success, false)
  assert.equal(lesson.safeParse({ lessonNumber: 1.5 }).success, false)
  assert.equal(lesson.safeParse({ titleKo: '' }).success, false)
  assert.equal(lesson.safeParse({ status: 'locked' }).success, true)
  assert.equal(adminBodySchema('PATCH', '/admin/exercises/:id').safeParse({ skillType: 'invalid' }).success, false)
  assert.equal(adminBodySchema('PATCH', '/admin/users/:id/role').safeParse({ role: 'owner' }).success, false)
})
