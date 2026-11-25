import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCsv } from '../src/lib/csvExport.js'

test('CSV is Excel-friendly, escapes cells and protects against spreadsheet formulas', () => {
  const csv = makeCsv([['Học viên', 'Tên bài', 'Tiến độ'], ['=SUM(1,2)', 'Nói "xin chào",\n친구', 50], ['-2+3', '', 0]])
  assert.equal(csv, '\uFEFF"Học viên","Tên bài","Tiến độ"\r\n"\'=SUM(1,2)","Nói ""xin chào"",\n친구","50"\r\n"\'-2+3","","0"')
})
