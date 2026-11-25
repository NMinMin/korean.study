import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
let rows = []
for (let offset = 0; ; offset += 500) {
  const { data, error } = await db.from('lesson_exercises').select('id,audio_url').like('audio_url', '%/korean-study/tts-recovery/%').order('id').range(offset, offset + 499)
  if (error) throw error
  rows.push(...data)
  if (data.length < 500) break
}
console.log(`Cần chuyển: ${rows.length}`)
if (!process.argv.includes('--apply')) process.exit()
let done = 0
for (const row of rows) {
  const source = await fetch(row.audio_url, { signal: AbortSignal.timeout(60000) })
  if (!source.ok || !/^audio\//i.test(source.headers.get('content-type') || '')) throw new Error(`Không đọc được audio nguồn: HTTP ${source.status}`)
  const bytes = await source.arrayBuffer()
  const form = new FormData()
  form.set('file', new Blob([bytes], { type: 'audio/mpeg' }), `lesson-${row.id}.mp3`)
  const result = await fetch('https://api-cloud-u4v8.onrender.com/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(120000) })
  const body = await result.json().catch(() => ({}))
  if (!result.ok || !body.url) throw new Error(`Upload thất bại HTTP ${result.status}: ${JSON.stringify(body).slice(0, 300)}`)
  const url = body.url.replace(/^http:\/\//i, 'https://')
  if (new URL(url).hostname !== 'api-cloud-u4v8.onrender.com') throw new Error('Upload trả về địa chỉ không hợp lệ')
  const check = await fetch(url, { headers: { Range: 'bytes=0-32' }, signal: AbortSignal.timeout(60000) })
  if (!check.ok || !/^(audio\/|application\/octet-stream)/i.test(check.headers.get('content-type') || '')) throw new Error(`Không đọc được audio đã upload HTTP ${check.status}`)
  await check.body?.cancel()
  const { data, error } = await db.from('lesson_exercises').update({ audio_url: url }).eq('id', row.id).eq('audio_url', row.audio_url).select('id')
  if (error || !data?.length) throw new Error(`Không thể cập nhật an toàn: ${error?.message || 'dữ liệu đã thay đổi'}`)
  console.log(`Đã chuyển ${++done}/${rows.length}`)
  if (process.argv.includes('--one')) break
  await new Promise(resolve => setTimeout(resolve, 1500))
}
