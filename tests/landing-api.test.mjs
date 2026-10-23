import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server.js'
import {
  createOwnerSession,
  verifyOwnerSession,
  OWNER_EMAIL,
} from '../src/lib/owner-session.ts'
import {
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
  trialSubmissionSchema,
  whatsappNumber,
} from '../src/lib/landing-config.ts'
import { POST as login } from '../src/app/api/auth/owner-login/route.ts'
import { PUT as saveConfig } from '../src/app/api/owner/landing/route.ts'
import { POST as submitFeedback } from '../src/app/api/landing/feedback/route.ts'
import { POST as submitTrial } from '../src/app/api/landing/trials/route.ts'
import { publicLandingConfig } from '../src/lib/server/landing-store.ts'
import { middleware } from '../src/middleware.ts'
const origin = 'https://clinic.example.test',
  secret = 'local-test-secret-for-owner-session-1234567890',
  records = new Map(),
  originalFetch = globalThis.fetch
let token,
  counter = 0
test('owner subdomains can load the shared draft preview without an owner-path rewrite', () => {
  const preview = middleware(
    new NextRequest('https://owner.yalla-clinic.com/landing-preview', {
      headers: { host: 'owner.yalla-clinic.com' },
    }),
  )
  assert.equal(preview.headers.get('x-middleware-next'), '1')
  const dashboard = middleware(
    new NextRequest('https://owner.yalla-clinic.com/', {
      headers: { host: 'owner.yalla-clinic.com' },
    }),
  )
  assert.equal(
    new URL(dashboard.headers.get('x-middleware-rewrite')).pathname,
    '/owner',
  )
})
function encode(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, encode(v)]),
      ),
    },
  }
}
function decode(value) {
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return value.arrayValue.values.map(decode)
  return Object.fromEntries(
    Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [
      k,
      decode(v),
    ]),
  )
}
function req(path, body, owner = false, extra = {}) {
  return new NextRequest(origin + path, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'cf-connecting-ip': '192.0.2.' + ++counter,
      ...(owner ? { cookie: `owner_session=${token}` } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
  })
}
before(async () => {
  process.env.OWNER_SESSION_SECRET = secret
  process.env.FIREBASE_PROJECT_ID = 'clinic-os-d2d1b'
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'fixture-public-key'
  process.env.PLATFORM_OWNER_UID = 'fixture-owner-uid'
  process.env.FIREBASE_CLIENT_EMAIL =
    'fixture@test-project.iam.gserviceaccount.com'
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const key = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  process.env.FIREBASE_PRIVATE_KEY =
    '-----BEGIN PRIVATE KEY-----\n' +
    Buffer.from(key).toString('base64') +
    '\n-----END PRIVATE KEY-----'
  token = await createOwnerSession(OWNER_EMAIL, 'fixture-owner-uid', secret)
  globalThis.fetch = async (url, options = {}) => {
    url = String(url)
    if (url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=')) {
      const idToken = JSON.parse(options.body).idToken
      if (idToken === 'invalid') return Response.json({}, { status: 401 })
      return Response.json({ users: [{
        localId: 'fixture-owner-uid', email: OWNER_EMAIL,
        emailVerified: true, disabled: false, validSince: '0',
      }] })
    }
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({
        access_token: 'fixture-service-access',
        expires_in: 3600,
      })
    assert.ok(
      url.startsWith('https://firestore.googleapis.com/'),
      'unexpected outbound request: ' + url,
    )
    const parsed = new URL(url),
      path = decodeURIComponent(parsed.pathname.split('/documents/')[1] || '')
    if (parsed.pathname.endsWith(':runQuery')) {
      const query = JSON.parse(options.body).structuredQuery,
        collection = query.from[0].collectionId
      return Response.json(
        [...records]
          .filter(
            ([key, value]) =>
              key.startsWith(collection + '/') &&
              (!query.where || value.approved === true),
          )
          .map(([key, value]) => ({
            document: {
              name: 'projects/test/databases/(default)/documents/' + key,
              fields: encode(value).mapValue.fields,
            },
          })),
      )
    }
    if (!options.method || options.method === 'GET') {
      const value = records.get(path)
      return value
        ? Response.json({
            name: 'projects/test/databases/(default)/documents/' + path,
            fields: encode(value).mapValue.fields,
          })
        : Response.json({}, { status: 404 })
    }
    if (options.method === 'PATCH') {
      const value = decode({ mapValue: JSON.parse(options.body) })
      records.set(
        path,
        parsed.searchParams.has('updateMask.fieldPaths')
          ? { ...records.get(path), ...value }
          : value,
      )
      return Response.json({})
    }
    if (options.method === 'POST') {
      const key = path + '/' + parsed.searchParams.get('documentId')
      if (records.has(key)) return Response.json({}, { status: 409 })
      records.set(key, decode({ mapValue: JSON.parse(options.body) }))
      return Response.json({})
    }
    if (options.method === 'DELETE') {
      records.delete(path)
      return Response.json({})
    }
    throw Error('unhandled fixture request')
  }
})
after(() => {
  globalThis.fetch = originalFetch
})
test('owner sessions reject tampering, clinic roles and a different email', async () => {
  assert.equal((await verifyOwnerSession(token, secret)).email, OWNER_EMAIL)
  assert.equal(await verifyOwnerSession(token + 'x', secret), null)
  assert.equal(
    await verifyOwnerSession(
      await createOwnerSession('doctor@example.test', 'fixture-owner-uid', secret),
      secret,
    ),
    null,
  )
  assert.equal(await verifyOwnerSession(token, 'wrong'.repeat(10)), null)
})
function testFirebaseToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    aud: 'clinic-os-d2d1b',
    iss: 'https://securetoken.google.com/clinic-os-d2d1b',
    sub: 'fixture-owner-uid',
    email: OWNER_EMAIL,
    email_verified: true,
    ownerEmail: OWNER_EMAIL,
    platformOwner: true,
    iat: now - 60,
    auth_time: now - 60,
    exp: now + 3600,
    ...overrides,
  }
  return (
    Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url') +
    '.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.signature'
  )
}
test('doctor ID tokens cannot be used to sign in as platform owner', async () => {
  const response = await login(req('/api/auth/owner-login', {
    idToken: testFirebaseToken({ sub: 'doctor-user-id' }),
  }))
  assert.equal(response.status, 403)
  assert.ok(!response.headers.has('set-cookie'))
})
test('owner authentication requires server-issued custom claims', async () => {
  const response = await login(req('/api/auth/owner-login', {
    idToken: testFirebaseToken({ platformOwner: false }),
  }))
  assert.equal(response.status, 403)
  assert.ok(!response.headers.has('set-cookie'))
})
test('verified Firebase owner ID token produces a signed, HttpOnly cookie', async () => {
  const response = await login(req('/api/auth/owner-login', {
    idToken: testFirebaseToken(),
  }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  const body = await response.json()
  assert.equal(body.owner.uid, 'fixture-owner-uid')
  assert.equal(body.owner.role, 'owner')
  assert.ok(!('firebaseToken' in body))
})
test('anonymous and cross-site requests cannot change landing config', async () => {
  assert.equal(
    (await saveConfig(req('/api/owner/landing', DEFAULT_LANDING_CONFIG)))
      .status,
    401,
  )
  assert.equal(
    (
      await saveConfig(
        req('/api/owner/landing', DEFAULT_LANDING_CONFIG, true, {
          origin: 'https://attacker.example',
        }),
      )
    ).status,
    403,
  )
})
test('owner can publish config and read back persistent Firestore content', async () => {
  const config = structuredClone(DEFAULT_LANDING_CONFIG)
  config.heroTitle = 'عنوان منشور'
  assert.equal(
    (await saveConfig(req('/api/owner/landing', config, true))).status,
    200,
  )
  assert.equal((await publicLandingConfig()).heroTitle, 'عنوان منشور')
})
test('public feedback is pending and never rewrites configuration', async () => {
  const before = JSON.stringify(records.get('site_settings/landing_page'))
  const response = await submitFeedback(
    req('/api/landing/feedback', {
      authorName: 'طبيب اختبار',
      clinicName: 'عيادة اختبار',
      comment: 'تجربة مفيدة لاختبار النموذج',
      rating: 5,
      approved: true,
    }),
  )
  assert.equal(response.status, 201)
  assert.equal(
    JSON.stringify(records.get('site_settings/landing_page')),
    before,
  )
  const item = [...records].find(([key]) => key.startsWith('landing_feedback/'))
  assert.equal(item[1].approved, false)
  assert.equal((await publicLandingConfig()).feedbacks.length, 0)
  item[1].approved = true
  assert.equal((await publicLandingConfig()).feedbacks.length, 1)
})
test('disabled forms reject direct submissions', async () => {
  const config = records.get('site_settings/landing_page')
  config.visibility.allowClientFeedbackSubmission = false
  const response = await submitFeedback(
    req('/api/landing/feedback', {
      authorName: 'طبيب',
      clinicName: 'عيادة',
      comment: 'رأي للاختبار فقط',
      rating: 4,
    }),
  )
  assert.equal(response.status, 403)
  config.visibility.allowClientFeedbackSubmission = true
})
test('trial submissions are closed by default and validation still rejects bad phones', async () => {
  const data = {
    doctorName: 'طبيب اختبار',
    clinicName: 'عيادة اختبار',
    specialty: 'عام',
    phone: '٠١٥٥١٠٠٧٠١٨',
    email: 'doctor@example.test',
    status: 'activated',
  }
  const response = await submitTrial(req('/api/landing/trials', data))
  assert.equal(DEFAULT_LANDING_CONFIG.visibility.showTrialBanner, false)
  assert.equal(response.status, 403)
  assert.equal(
    [...records].some(([key]) => key.startsWith('trial_requests/')),
    false,
  )
  assert.equal(whatsappNumber('01551007018'), '201551007018')
  assert.equal(
    trialSubmissionSchema.safeParse({ ...data, phone: 'abc' }).success,
    false,
  )
})
test('public submission rate limits are persistent and honeypot submissions fail', async () => {
  const data = {
    authorName: 'طبيب',
    clinicName: 'عيادة',
    comment: 'رأي للاختبار فقط',
    rating: 4,
  }
  const request = () =>
    req('/api/landing/feedback', data, false, {
      'cf-connecting-ip': '192.0.2.255',
    })
  assert.equal((await submitFeedback(request())).status, 201)
  assert.equal((await submitFeedback(request())).status, 429)
  assert.equal(
    (
      await submitFeedback(
        req('/api/landing/feedback', { ...data, website: 'spam' }),
      )
    ).status,
    400,
  )
})
test('configuration rejects javascript URLs and invalid review ratings', () => {
  assert.equal(
    landingConfigSchema.safeParse({
      ...DEFAULT_LANDING_CONFIG,
      demoUrl: 'javascript:alert(1)',
    }).success,
    false,
  )
  assert.equal(
    landingConfigSchema.safeParse({
      ...DEFAULT_LANDING_CONFIG,
      screenshots: [
        {
          ...DEFAULT_LANDING_CONFIG.screenshots[0],
          imageUrl: 'javascript:alert(1)',
        },
      ],
    }).success,
    false,
  )
  assert.equal(
    landingConfigSchema.safeParse({
      ...DEFAULT_LANDING_CONFIG,
      clients: [
        {
          id: 'client-1',
          name: 'عيادة اختبار',
          link: 'javascript:alert(1)',
        },
      ],
    }).success,
    false,
  )
  assert.equal(DEFAULT_LANDING_CONFIG.demoButtonText, 'طلب ديمو مجاني')
  assert.equal(
    DEFAULT_LANDING_CONFIG.patientPortalButtonText,
    'تواصل مع الدعم الفني',
  )
})
