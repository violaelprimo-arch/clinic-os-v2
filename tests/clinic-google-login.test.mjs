import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { NextRequest } from 'next/server.js'
import { POST as googleLogin } from '../src/app/api/auth/google-login/route.ts'

const savedFetch = globalThis.fetch
const projectId = 'clinic-os-d2d1b'
let account = { localId: 'google-uid', email: 'doctor@example.com', emailVerified: true, disabled: false }

function makeToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    aud: projectId, iss: `https://securetoken.google.com/${projectId}`,
    sub: 'google-uid', email: 'doctor@example.com', email_verified: true,
    iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'google.com' }, ...overrides,
  }
  return 'eyJhbGciOiJSUzI1NiJ9.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.stub-signature'
}

function request(idToken, slug = 'google-clinic', origin = 'https://clinic.example.test') {
  return new NextRequest('https://clinic.example.test/api/auth/google-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify({ idToken, slug }),
  })
}

before(async () => {
  process.env.CLINIC_SESSION_SECRET = 'test-secret-google-session-with-more-than-32-characters'
  process.env.FIREBASE_PROJECT_ID = projectId
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key'
  process.env.FIREBASE_CLIENT_EMAIL = 'fixture@example.test'
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['sign', 'verify'])
  const privateKey = await crypto.subtle.exportKey('pkcs8', keys.privateKey)
  process.env.FIREBASE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privateKey).toString('base64')}\n-----END PRIVATE KEY-----`

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url)
    if (target === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fixture', expires_in: 3600 })
    if (target.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup')) {
      assert.equal(JSON.parse(options.body).idToken.split('.').length, 3)
      return Response.json({ users: [account] })
    }
    if (target.includes('firestore.googleapis.com') && target.includes(':runQuery')) {
      const query = JSON.parse(options.body)
      assert.equal(query.structuredQuery.where.fieldFilter.value.stringValue, 'google-clinic')
      return Response.json([{ document: { name: 'projects/x/databases/(default)/documents/clinics/clinic-google-id', fields: {
        doctorEmail: { stringValue: 'doctor@example.com' }, doctorName: { stringValue: 'Test Doctor' },
      } } }])
    }
    if (target.includes('firestore.googleapis.com') && target.includes('audit_logs')) return Response.json({})
    assert.fail('Unexpected fetch: ' + target)
  }
})

after(() => {
  globalThis.fetch = savedFetch
  for (const name of ['CLINIC_SESSION_SECRET', 'FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'])
    delete process.env[name]
})

test('registered doctor Google account receives a tenant-scoped signed session', async () => {
  const res = await googleLogin(request(makeToken()))
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.user.role, 'doctor')
  assert.equal(data.user.clinicId, 'clinic-google-id')
  assert.ok(res.cookies.get('clinic_session')?.httpOnly)
})

test('Google login rejects non-Google Firebase sign-in providers', async () => {
  const res = await googleLogin(request(makeToken({ firebase: { sign_in_provider: 'password' } })))
  assert.equal(res.status, 401)
})

test('Google login rejects unverified email identities and cross-origin requests', async () => {
  const denied = await googleLogin(request(makeToken({ email_verified: false })))
  assert.equal(denied.status, 401)
  const forbidden = await googleLogin(request(makeToken(), 'google-clinic', 'https://wrong.example.test'))
  assert.equal(forbidden.status, 403)
})

test('a different Google account cannot claim the doctor role in this clinic', async () => {
  account = { localId: 'different-uid', email: 'other@example.com', emailVerified: true }
  const res = await googleLogin(request(makeToken({ sub: 'different-uid', email: 'other@example.com' })))
  assert.equal(res.status, 403)
})
