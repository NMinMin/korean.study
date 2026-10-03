import assert from 'node:assert/strict'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
const outputDir = await mkdtemp(join(tmpdir(), 'kstudy-cache-test-'))
let outputText
try {
  execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
    fileURLToPath(new URL('../src/lib/requestCache.ts', import.meta.url)), '--target', 'ES2022', '--module', 'ESNext', '--skipLibCheck', '--outDir', outputDir], { cwd: outputDir, stdio: 'pipe' })
  outputText = await readFile(join(outputDir, 'requestCache.js'), 'utf8')
} finally {
  await unlink(join(outputDir, 'requestCache.js')).catch(() => {})
  await rmdir(outputDir)
}
const { createRequestCache } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('shares pending loads, starts TTL after completion, and isolates keys', async () => {
  const cache = createRequestCache(1000)
  let resolve
  let calls = 0
  const load = () => { calls++; return new Promise((done) => { resolve = done }) }
  const first = cache.get('user-a', load)
  await Promise.resolve()
  assert.equal(cache.get('user-a', load), first)
  assert.equal(calls, 1)
  assert.equal(await cache.get('user-b', async () => 'other'), 'other')
  resolve('loaded')
  assert.equal(await first, 'loaded')
  assert.equal(await cache.get('user-a', load), 'loaded')
  assert.equal(calls, 1)
})

test('expires completed results and retries errors', async () => {
  const cache = createRequestCache(-1)
  let calls = 0
  assert.equal(await cache.get('key', async () => ++calls), 1)
  assert.equal(await cache.get('key', async () => ++calls), 2)
  await assert.rejects(cache.get('error', async () => { throw new Error('offline') }))
  assert.equal(await cache.get('error', async () => 'retry'), 'retry')
})

test('invalidated pending requests cannot replace or delete a newer request', async () => {
  const cache = createRequestCache(1000)
  let reject
  const old = cache.get('key', () => new Promise((_, fail) => { reject = fail }))
  await Promise.resolve()
  cache.clear()
  const current = cache.get('key', async () => 'new')
  reject(new Error('old failure'))
  await assert.rejects(old)
  assert.equal(await current, 'new')
  assert.equal(await cache.get('key', async () => 'unexpected'), 'new')
})
