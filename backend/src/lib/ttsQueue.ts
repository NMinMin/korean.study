import { randomUUID } from 'node:crypto'

type Request = { text: string; voice: string; speed: number }
type Result = { url: string }

export class TtsError extends Error {
  constructor(message: string, public status = 502) { super(message) }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
let tail: Promise<void> = Promise.resolve()
let queued = 0
let nextStart = 0
const maxQueued = 20

export function enqueueTts(input: Request): Promise<Result> {
  if (queued >= maxQueued) return Promise.reject(new TtsError('Hàng chờ tạo giọng đang đầy. Vui lòng thử lại sau.', 429))
  queued++
  const job = tail.then(async () => {
    await sleep(Math.max(0, nextStart - Date.now()))
    const filename = `${randomUUID()}-speech.mp3`
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let response: Response
        try {
          response = await fetch('https://text-to-speed.onrender.com/tts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...input, filename }), signal: AbortSignal.timeout(90000),
          })
        } catch {
          throw new TtsError('Không kết nối được dịch vụ tạo giọng. Vui lòng thử lại sau.')
        }
        const data = await response.json().catch(() => ({})) as Record<string, unknown>
        const detail = String(data.detail || data.message || data.error || '')
        const rateLimited = response.status === 429 || (response.status === 502 && /(?:status\s+429|too many requests)/i.test(detail))
        if (rateLimited && attempt < 3) {
          const header = response.headers.get('retry-after')
          const seconds = header && /^\d+$/.test(header) ? Number(header) : 0
          await sleep(Math.max(Math.min(seconds * 1000, 30000), 2000 * 2 ** attempt) + Math.floor(Math.random() * 500))
          continue
        }
        if (rateLimited) throw new TtsError('Dịch vụ tạo giọng hoặc lưu trữ đang giới hạn lượt gọi. Vui lòng thử lại sau.', 429)
        const nested = data.data && typeof data.data === 'object' ? data.data as Record<string, unknown> : {}
        const url = data.url || nested.url
        if (!response.ok || data.success === false || typeof url !== 'string') throw new TtsError('Dịch vụ tạo giọng chưa xử lý được yêu cầu. Vui lòng thử lại sau.')
        return { url: url.replace(/^http:\/\/api-cloud-u4v8\.onrender\.com/i, 'https://api-cloud-u4v8.onrender.com') }
      }
      throw new TtsError('Không thể tạo giọng.')
    } finally { nextStart = Date.now() + 1500 }
  }).finally(() => { queued-- })
  tail = job.then(() => undefined, () => undefined)
  return job
}
