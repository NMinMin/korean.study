export function makeExcelRows(rows) {
  return rows.map((row, index) => row.map((value) => ({
    value: value == null ? '' : value,
    ...(index === 0 ? { fontWeight: 'bold', backgroundColor: '#EDE9FE' } : {}),
  })))
}

export async function downloadExcel(filename, rows) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const data = makeExcelRows(rows)
  const columns = (rows[0] || []).map((_, index) => ({ width: Math.min(40, Math.max(14, ...rows.slice(0, 100).map((row) => String(row[index] ?? '').length + 2))) }))
  await writeExcelFile(data, { columns, stickyRowsCount: 1 }).toFile(filename)
}
