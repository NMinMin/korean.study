import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProgressExportRows } from '../src/lib/progressReport.js'
import { makeExcelRows } from '../src/lib/excelExport.js'

test('progress export includes all learners and distinguishes missing data from zero', () => {
  const learners = [{ user_id: 'a', profiles: { display_name: 'An' } }, { user_id: 'b', profiles: { display_name: 'Bình' } }, { user_id: 'c', profiles: { display_name: 'Chi' } }]
  const enrollments = [{ user_id: 'a', textbook_id: 'x', textbooks: { title_ko: '교재' } }, { user_id: 'b', textbook_id: 'x', profiles: { display_name: 'Bình' }, textbooks: { title_ko: '교재' } }]
  const progress = [{ user_id: 'a', textbook_id: 'x', profiles: { display_name: 'An' }, textbooks: { title_ko: '교재' }, lessons: { lesson_number: 1, title_ko: '인사' }, progress_percent: 0 }]
  const rows = buildProgressExportRows(progress, enrollments, learners)
  assert.equal(rows.length, 3)
  assert.equal(rows[0][5], 0)
  assert.equal(rows[1][5], '')
  assert.equal(rows[1][6], 'Chưa có dữ liệu tiến độ')
  assert.equal(rows[2][6], 'Chưa có giáo trình hoặc tiến độ')
})

test('Excel cells keep numeric values and user text as text', () => {
  const cells = makeExcelRows([['Tên', 'Số'], ['=1+1', 42]])
  assert.deepEqual(cells[1], [{ value: '=1+1' }, { value: 42 }])
  assert.equal(cells[0][0].fontWeight, 'bold')
})
