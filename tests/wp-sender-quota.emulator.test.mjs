import test from 'node:test'
import assert from 'node:assert/strict'
import { reserveWpSenderUsage } from '../src/lib/server/whatsapp-scheduler.ts'
import { getFirestoreEmulatorOrigin } from '../src/lib/server/firebase-rest.ts'

test('two monthly slots, concurrent last slot, independent mock quota and month rollover', async () => {
  assert.ok(getFirestoreEmulatorOrigin(), 'Start the local Firestore emulator first')
  const clinic = 'quota-test-' + crypto.randomUUID()
  const reserve = (mock = false, month = '11') =>
    reserveWpSenderUsage(clinic, 2, `2026-${month}-10T12:00:00Z`, mock)
  assert.equal(await reserve(), true)
  assert.equal((await Promise.all([reserve(), reserve()])).filter(Boolean).length, 1)
  assert.equal(await reserve(), false)
  assert.equal(await reserve(true), true)
  assert.equal(await reserve(false, '12'), true)
})
