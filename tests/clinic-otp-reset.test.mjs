import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { NextRequest } from 'next/server.js'
import { POST as resetPassword } from '../src/app/api/auth/reset-password/route.ts'
import { POST as obsoleteSendOtp } from '../src/app/api/send-otp/route.ts'
import { verifyPassword } from '../src/lib/auth-crypto.ts'

const savedFetch = globalThis.fetch
const clinic = { slug: 'otp-clinic', doctorEmail: 'doctor@example.com', doctorName: 'Test Doctor', clinicName: 'Test Clinic' }
let sentCode = null
let delivered = 0

function encode(value) {
  if (value == null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'boolean') return { booleanValue: value }
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } }
}
function decode(value) {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('booleanValue' in value) return value.booleanValue
  return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [k, decode(v)]))
}
function req(action, details = {}) {
  return new NextRequest('https://clinic.example.test/api/auth/reset-password', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, slug: 'otp-clinic', email: 'doctor@example.com', ...details }),
  })
}

before(async () => {
  process.env.FIREBASE_PROJECT_ID = 'clinic-os-d2d1b'
  process.env.FIREBASE_CLIENT_EMAIL = 'test@example.test'
  const keys = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['sign', 'verify'])
  const raw = await crypto.subtle.exportKey('pkcs8', keys.privateKey)
  process.env.FIREBASE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(raw).toString('base64')}\n-----END PRIVATE KEY-----`
  process.env.RESEND_API_KEY = 'resend-fixture-key'
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url)
    if (target === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fixture', expires_in: 3600 })
    if (target === 'https://api.resend.com/emails') {
      assert.equal(options.headers.Authorization, 'Bearer resend-fixture-key')
      const body = JSON.parse(options.body)
      sentCode = body.text.match(/\b\d{6}\b/)?.[0]
      delivered++
      return Response.json({ id: 'sent-id' })
    }
    if (target.startsWith('https://firestore.googleapis.com/v1/')) {
      if (target.includes(':runQuery')) return Response.json([{
        document: { name: 'projects/x/databases/(default)/documents/clinics/test-id', fields: encode(clinic).mapValue.fields },
      }])
      const path = new URL(target).pathname.split('/documents/')[1]
      if ((!options.method || options.method === 'GET') && path === 'system/config') return Response.json({}, { status: 404 })
      if (options.method === 'PATCH' && path === 'clinics/test-id') {
        Object.assign(clinic, decode({ mapValue: JSON.parse(options.body) }))
        return Response.json({})
      }
      if (options.method === 'POST' && path === 'audit_logs') return Response.json({})
    }
    assert.fail('Unexpected fetch: ' + target)
  }
})

after(() => {
  globalThis.fetch = savedFetch
  delete process.env.FIREBASE_PROJECT_ID
  delete process.env.FIREBASE_CLIENT_EMAIL
  delete process.env.FIREBASE_PRIVATE_KEY
  delete process.env.RESEND_API_KEY
})

test('OTP is delivered through a server mailer with a single-use hash', async () => {
  const res = await resetPassword(req('request'))
  assert.equal(res.status, 200)
  assert.equal(delivered, 1)
  assert.match(sentCode, /^\d{6}$/)
  assert.notEqual(clinic.resetPasswordOtpHashed, sentCode)
})

test('incorrect OTP is rejected without changing password', async () => {
  const res = await resetPassword(req('verify-and-reset', { otp: '999999', newPassword: 'new-password-123' }))
  assert.equal(res.status, 400)
  assert.equal(clinic.resetPasswordAttempts, 1)
})

test('correct OTP resets doctor password and consumes challenge', async () => {
  const res = await resetPassword(req('verify-and-reset', { otp: sentCode, newPassword: 'new-password-123' }))
  assert.equal(res.status, 200)
  assert.equal(await verifyPassword('new-password-123', clinic.doctorPasswordHash), true)
  assert.equal(clinic.resetPasswordOtpHashed, null)
})

test('old unauthenticated OTP mail endpoint cannot be used as an email relay', async () => {
  const res = await obsoleteSendOtp()
  assert.equal(res.status, 404)
})
