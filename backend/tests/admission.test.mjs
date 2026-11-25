import assert from 'node:assert/strict'
import test from 'node:test'
import { BusyError, createAdmission } from '../dist/lib/admission.js'

test('limits concurrent requests, bounds waiters, and releases slots safely', async () => {
  const acquire = createAdmission(1, 1, 1000)
  const release = await acquire()
  const waiting = acquire()
  await assert.rejects(acquire(), BusyError)
  release()
  const nextRelease = await waiting
  release()
  const nextWaiting = acquire()
  nextRelease()
  const lastRelease = await nextWaiting
  lastRelease()
})

test('timed-out requests are removed from the queue', async () => {
  const acquire = createAdmission(1, 1, 10)
  const release = await acquire()
  await assert.rejects(acquire(), BusyError)
  const pending = acquire()
  release()
  const next = await pending
  next()
})

test('a burst of 999 requests stays bounded and recovers after overload', async () => {
  const acquire = createAdmission(4, 20, 1000)
  let running = 0
  let peak = 0
  const outcomes = await Promise.all(Array.from({ length: 999 }, async () => {
    try {
      const release = await acquire()
      running++
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, 2))
      running--
      release()
      return 'accepted'
    } catch (error) {
      assert.ok(error instanceof BusyError)
      return 'busy'
    }
  }))
  assert.equal(peak, 4)
  assert.equal(outcomes.filter(value => value === 'accepted').length, 24)
  assert.equal(outcomes.filter(value => value === 'busy').length, 975)
  const release = await acquire()
  release()
})
