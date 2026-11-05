import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { NextRequest } from 'next/server.js'
import { hashPassword, verifyPassword, createSessionToken } from '../src/lib/auth-crypto.ts'
import { POST as changePassword } from '../src/app/api/clinic/[slug]/change-password/route.ts'
import { POST as changeEmail } from '../src/app/api/clinic/[slug]/change-email/route.ts'
import { POST as saveSettings } from '../src/app/api/clinic/[slug]/settings/route.ts'

const origin = 'https://clinic.example.test'
const clinicId = 'fixture-clinic-id'
const slug = 'fixture-clinic'
const records = new Map()
const previousFetch = globalThis.fetch
let doctorCookie

function encode(value) {
  if (value == null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } }
}

function decode(value) {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('booleanValue' in value) return value.booleanValue
  if ('arrayValue' in value) return value.arrayValue.values.map(decode)
  return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [k, decode(v)]))
}

function request(path, body, cookie = doctorCookie, sourceOrigin = origin) {
  return new NextRequest(origin + path, {
    method: 'POST',
    headers: {
      origin: sourceOrigin,
      'content-type': 'application/json',
      ...(cookie ? { cookie: `clinic_session=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

const ctx = { params: Promise.resolve({ slug }) }

before(async () => {
  process.env.CLINIC_SESSION_SECRET = 'fixture-clinic-session-secret-with-at-least-32-chars'
  process.env.FIREBASE_PROJECT_ID = 'clinic-os-d2d1b'
  process.env.FIREBASE_CLIENT_EMAIL = 'test@clinic-os-d2d1b.iam.gserviceaccount.com'
  const keys = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['sign', 'verify'])
  const rawKey = await crypto.subtle.exportKey('pkcs8', keys.privateKey)
  process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\n'
    + Buffer.from(rawKey).toString('base64') + '\n-----END PRIVATE KEY-----'

  records.set(`clinics/${clinicId}`, {
    slug, doctorName: 'Doctor Example', doctorEmail: 'doctor@example.com',
    doctorPasswordHash: await hashPassword('old-password-123'),
    assistants: [{ email: 'assistant@example.com' }],
  })
  doctorCookie = await createSessionToken({
    role: 'doctor', clinicId, slug, name: 'Doctor Example', email: 'doctor@example.com',
  })

  globalThis.fetch = async (url, options = {}) => {
    url = String(url)
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'test-service-token', expires_in: 3600 })
    }
    assert.ok(url.startsWith('https://firestore.googleapis.com/v1/'), 'Unexpected network call')
    const parsed = new URL(url)
    const path = decodeURIComponent(parsed.pathname.split('/documents/')[1] || '')
    if (!options.method || options.method === 'GET') {
      const value = records.get(path)
      return value
        ? Response.json({ name: 'projects/test/databases/(default)/documents/' + path, fields: encode(value).mapValue.fields })
        : Response.json({}, { status: 404 })
    }
    if (options.method === 'PATCH') {
      const value = decode({ mapValue: JSON.parse(options.body) })
      records.set(path, parsed.searchParams.has('updateMask.fieldPaths')
        ? { ...records.get(path), ...value }
        : value)
      return Response.json({})
    }
    if (options.method === 'POST' && path.startsWith('audit_logs')) return Response.json({})
    assert.fail('Unexpected Firestore request ' + options.method + ' ' + path)
  }
})

after(() => {
  globalThis.fetch = previousFetch
  delete process.env.CLINIC_SESSION_SECRET
  delete process.env.FIREBASE_CLIENT_EMAIL
  delete process.env.FIREBASE_PRIVATE_KEY
})

test('Password update requires a doctor session and the correct current password', async () => {
  const path = `/api/clinic/${slug}/change-password`
  const missing = await changePassword(request(path, {
    currentPassword: 'old-password-123', newPassword: 'new-password-456',
  }, null), ctx)
  assert.equal(missing.status, 401)
  const wrong = await changePassword(request(path, {
    currentPassword: 'wrong', newPassword: 'new-password-456',
  }), ctx)
  assert.equal(wrong.status, 401)
})

test('Doctor password update persists and rotates its signed session', async () => {
  const result = await changePassword(request(`/api/clinic/${slug}/change-password`, {
    currentPassword: 'old-password-123', newPassword: 'new-password-456',
  }), ctx)
  assert.equal(result.status, 200)
  assert.ok(result.cookies.get('clinic_session')?.value)
  assert.equal(await verifyPassword('new-password-456', records.get(`clinics/${clinicId}`).doctorPasswordHash), true)
  assert.equal(await verifyPassword('old-password-123', records.get(`clinics/${clinicId}`).doctorPasswordHash), false)
  doctorCookie = result.cookies.get('clinic_session').value
})

test('Doctor email change rejects assistant email and wrong password', async () => {
  const path = `/api/clinic/${slug}/change-email`
  const duplicate = await changeEmail(request(path, {
    newEmail: 'assistant@example.com', currentPassword: 'new-password-456',
  }), ctx)
  assert.equal(duplicate.status, 409)
  const wrong = await changeEmail(request(path, {
    newEmail: 'new-doctor@example.com', currentPassword: 'wrong',
  }), ctx)
  assert.equal(wrong.status, 401)
})

test('Changing doctor email updates the login field without changing clinic identity', async () => {
  const result = await changeEmail(request(`/api/clinic/${slug}/change-email`, {
    newEmail: ' NEW-DOCTOR@example.com ', currentPassword: 'new-password-456',
  }), ctx)
  assert.equal(result.status, 200)
  assert.equal(records.get(`clinics/${clinicId}`).doctorEmail, 'new-doctor@example.com')
  assert.equal(records.get(`clinics/${clinicId}`).slug, slug)
  doctorCookie = result.cookies.get('clinic_session').value
})

test('Normal settings cannot overwrite email and cross-origin updates are rejected', async () => {
  const path = `/api/clinic/${slug}/settings`
  const sensitive = await saveSettings(request(path, { doctorEmail: 'attacker@example.com' }), ctx)
  assert.equal(sensitive.status, 400)
  const foreign = await saveSettings(request(path, { clinicName: 'Nope' }, doctorCookie, 'https://malicious.test'), ctx)
  assert.equal(foreign.status, 403)
  const legitimate = await saveSettings(request(path, { clinicName: 'Valid Name' }), ctx)
  assert.equal(legitimate.status, 200)
  assert.equal(records.get(`clinics/${clinicId}`).clinicName, 'Valid Name')
  assert.equal(records.get(`clinics/${clinicId}`).doctorEmail, 'new-doctor@example.com')
})
