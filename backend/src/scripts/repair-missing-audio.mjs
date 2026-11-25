import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
if (required.some((name) => !process.env[name])) throw new Error('Thiếu cấu hình Supabase hoặc Cloudinary.')
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
// Python must have edge-tts installed; override the executable or module path when needed.
const python = process.env.TTS_PYTHON || 'python'
const dependencies = process.env.TTS_PYTHONPATH
const audioPattern = /\.(mp3|m4a|wav|ogg)(?:[?#]|$)/i
const fields = 'id,skill_type,exercise_type,prompt_ko,audio_url,media_url,answer,status,updated_at'
function needsAudio(row) {
  const answer = row.answer && typeof row.answer === 'object' && !Array.isArray(row.answer) ? row.answer : {}
  const grammar = ['grammar', 'grammar_pattern', 'pattern'].includes(String(row.exercise_type || '').toLowerCase()) || answer.formulaLines || answer.contextVi
  return (['dictation', 'shadowing'].includes(row.skill_type) || (row.skill_type === 'vocabulary_grammar' && !grammar)) && row.status === 'published' && Boolean(row.prompt_ko?.trim()) && !row.audio_url && !answer.audioUrl && !(row.media_url && audioPattern.test(row.media_url))
}
async function synthesize(text, voice, rate, path) {
  await new Promise((resolve, reject) => {
    const child = spawn(python, ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', path], { env: { ...process.env, ...(dependencies ? { PYTHONPATH: dependencies } : {}) }, stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''; child.stderr.on('data', (part) => { err += part.toString() })
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Tạo giọng thất bại: ${err.slice(-450)}`)))
  })
}
async function upload(bytes, id) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const folder = 'korean-study/tts-recovery'
  const params = `folder=${folder}&public_id=${id}&timestamp=${timestamp}`
  const signature = createHash('sha1').update(params + process.env.CLOUDINARY_API_SECRET).digest('hex')
  const form = new FormData()
  form.set('file', new Blob([bytes], { type: 'audio/mpeg' }), `${id}.mp3`)
  form.set('folder', folder); form.set('public_id', id); form.set('timestamp', timestamp)
  form.set('api_key', process.env.CLOUDINARY_API_KEY); form.set('signature', signature)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/auto/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.secure_url) throw new Error(`Upload lỗi HTTP ${response.status}: ${String(result.error?.message || '').slice(0, 150)}`)
  return result.secure_url
}
let all = []
for (let offset = 0; ; offset += 500) {
  const { data, error } = await client.from('lesson_exercises').select(fields).order('id').range(offset, offset + 499)
  if (error) throw new Error(`Không thể đọc học liệu: ${error.message}`)
  all.push(...data); if (data.length < 500) break
}
const shardArg = process.argv.find((arg) => arg.startsWith('--shard='))
const shard = shardArg ? Number(shardArg.split('=')[1]) : null
if (shard !== null && (!Number.isInteger(shard) || shard < 0 || shard > 2)) throw new Error('Shard không hợp lệ.')
const pending = all.filter(needsAudio).filter((row) => shard === null || createHash('sha256').update(row.id).digest()[0] % 3 === shard)
console.log(`Học liệu cần bổ sung audio: ${pending.length}`)
if (!process.argv.includes('--apply')) process.exit(0)
let done = 0
for (const candidate of pending) {
  const { data: current, error: readError } = await client.from('lesson_exercises').select(fields).eq('id', candidate.id).maybeSingle()
  if (readError) throw new Error(`Không thể kiểm tra học liệu: ${readError.message}`)
  if (!current || !needsAudio(current)) continue
  const answer = current.answer && typeof current.answer === 'object' && !Array.isArray(current.answer) ? current.answer : {}
  const voices = ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural', 'ko-KR-HyunsuNeural', 'ko-KR-HyunsuMultilingualNeural']
  const stored = answer.ttsVoice === 'ko-KR-HyunSuNeural' ? 'ko-KR-HyunsuNeural' : answer.ttsVoice
  const voice = voices.includes(stored) ? stored : 'ko-KR-SunHiNeural'
  const rate = Number(answer.ttsSpeed) === 0.75 ? '-25%' : Number(answer.ttsSpeed) === 1.25 ? '+25%' : '+0%'
  const fingerprint = createHash('sha256').update(`${current.prompt_ko.trim()}\n${voice}\n${rate}`).digest('hex').slice(0, 12)
  const publicId = `lesson-${current.id}-${fingerprint}`
  const path = join(tmpdir(), `${publicId}.mp3`)
  try {
    await synthesize(current.prompt_ko.trim(), voice, rate, path)
    const bytes = await readFile(path)
    if (bytes.length < 500) throw new Error('Tệp âm thanh rỗng hoặc không hợp lệ.')
    const audioUrl = await upload(bytes, publicId)
    const check = await fetch(audioUrl, { headers: { Range: 'bytes=0-32' }, signal: AbortSignal.timeout(30000) })
    if (!check.ok || !/^(audio\/|application\/octet-stream)/i.test(check.headers.get('content-type') || '')) throw new Error(`Không đọc được file audio HTTP ${check.status}.`)
    await check.body?.cancel()
    let update = client.from('lesson_exercises').update({ audio_url: audioUrl }).eq('id', current.id)
    update = current.audio_url === null ? update.is('audio_url', null) : update.eq('audio_url', current.audio_url)
    if (current.updated_at) update = update.eq('updated_at', current.updated_at)
    const { data: updated, error: updateError } = await update.select('id')
    if (updateError || !updated?.length) throw new Error(`Không thể lưu an toàn: ${updateError?.message || 'học liệu đã thay đổi'}.`)
    done++; console.log(`Đã lưu ${done}/${pending.length}`)
  } finally { await unlink(path).catch(() => {}) }
  if (process.argv.includes('--one')) break
  await new Promise((resolve) => setTimeout(resolve, 1500))
}
console.log(`Hoàn tất: đã lưu ${done}.`)
