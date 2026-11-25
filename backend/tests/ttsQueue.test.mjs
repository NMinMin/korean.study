import assert from 'node:assert/strict'
import test from 'node:test'
import { enqueueTts } from '../dist/lib/ttsQueue.js'

const request = { text: '안녕하세요', voice: 'ko-KR-SunHiNeural', speed: 1 }

test('TTS requests are serialized and rate limits are retried without repeating other failures', async () => {
  const original = globalThis.fetch
  let active = 0
  let maxActive = 0
  let calls = 0
  globalThis.fetch = async () => {
    active++
    maxActive = Math.max(maxActive, active)
    calls++
    await new Promise(resolve => setTimeout(resolve, 20))
    active--
    if (calls === 1) return new Response(JSON.stringify({ detail: 'Upload service failed with status 429: Too Many Requests' }), { status: 502 })
    return new Response(JSON.stringify({ url: 'http://api-cloud-u4v8.onrender.com/files/storage/test.mp3' }), { status: 200 })
  }
  try {
    const results = await Promise.all([enqueueTts(request), enqueueTts(request)])
    assert.equal(maxActive, 1)
    assert.equal(calls, 3)
    assert.ok(results.every(item => item.url.startsWith('https://')))
    globalThis.fetch = async () => { calls++; return new Response('{}', { status: 500 }) }
    await assert.rejects(enqueueTts(request))
    assert.equal(calls, 4)
  } finally { globalThis.fetch = original }
})
