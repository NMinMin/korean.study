import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('grammar mapping keeps each example and displays formula content without placeholder labels', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    const { mapDatabaseGrammar } = await vite.ssrLoadModule('/src/features/curriculum/curriculumMappers.js')
    const input = { id: 'g1', pattern: '이에요', conjugationVi: 'Danh từ có 받침 + 이에요\nDanh từ không có 받침 + 예요', examples: [{ ko: '학생이에요.', vi: 'Là học sinh.' }] }
    const result = mapDatabaseGrammar(input, 0)
    assert.deepEqual(result.examples, input.examples)
    assert.deepEqual(result.formula, [
      { subject: '', condition: '', form: 'Danh từ có 받침 + 이에요' },
      { subject: '', condition: '', form: 'Danh từ không có 받침 + 예요' },
    ])
    assert.deepEqual(mapDatabaseGrammar({ pattern: '이에요' }, 0).examples, [])
  } finally { await vite.close() }
})
