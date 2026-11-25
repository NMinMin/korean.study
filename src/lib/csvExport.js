export function makeCsv(rows) {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    const original = value == null ? '' : String(value)
    const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(original) ? `'${original}` : original
    return `"${safe.replace(/"/g, '""')}"`
  }).join(',')).join('\r\n')
}

export function downloadCsv(filename, rows) {
  const url = URL.createObjectURL(new Blob([makeCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
