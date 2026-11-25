import { supabaseAdmin } from './supabase.js'
import { enqueueTts } from './ttsQueue.js'

let started = false
let busy = false

export function startTtsWorker(log: { error: (object: unknown, message: string) => void }) {
  if (started) return
  started = true
  const run = async () => {
    if (busy) return
    busy = true
    try {
      const { data, error } = await supabaseAdmin.rpc('claim_tts_job')
      if (error) throw error
      const job = data?.[0]
      if (!job) return
      try {
        const result = await enqueueTts({ text: job.text_content, voice: job.voice, speed: Number(job.speed) })
        if (job.exercise_id) {
          let update = supabaseAdmin.from('lesson_exercises').update({ audio_url: result.url }).eq('id', job.exercise_id).eq('prompt_ko', job.text_content).is('audio_url', null)
          update = job.exercise_updated_at ? update.eq('updated_at', job.exercise_updated_at) : update.is('updated_at', null)
          const { data: updated, error: updateError } = await update.select('id')
          if (updateError || !updated?.length) throw new Error('Bài tập đã thay đổi hoặc không thể gắn audio. Vui lòng kiểm tra lại.')
        }
        const { error: saveError } = await supabaseAdmin.from('tts_jobs').update({ status: 'completed', audio_url: result.url, updated_at: new Date().toISOString(), lease_until: null }).eq('id', job.id).eq('status', 'processing')
        if (saveError) throw saveError
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Không thể tạo giọng đọc.'
        const { error: saveError } = await supabaseAdmin.from('tts_jobs').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString(), lease_until: null }).eq('id', job.id).eq('status', 'processing')
        if (saveError) throw saveError
      }
    } catch (err) { log.error({ err }, 'TTS worker failed') }
    finally { busy = false }
  }
  const timer = setInterval(() => { void run() }, 3000)
  timer.unref()
  void run()
}
