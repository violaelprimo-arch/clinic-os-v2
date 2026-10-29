import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server.js'
import {
  createOwnerSession,
  OWNER_EMAIL,
} from '../src/lib/owner-session.ts'
import {
  trialSubmissionSchema,
  normalizePhoneNumber,
} from '../src/lib/landing-config.ts'
import { POST as submitTrial } from '../src/app/api/landing/trials/route.ts'
import { GET as getOwnerTrials, PATCH as updateOwnerTrial } from '../src/app/api/owner/landing/trials/route.ts'

const origin = 'https://clinic.example.test'
const secret = 'local-test-secret-for-owner-session-1234567890'
let token = ''
let counter = 0
const originalFetch = globalThis.fetch
const records = new Map()

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
  process.env.FIREBASE_CLIENT_EMAIL = 'fixture@test-project.iam.gserviceaccount.com'

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
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({
        access_token: 'fixture-service-access',
        expires_in: 3600,
      })

    const parsed = new URL(url)
    const path = decodeURIComponent(parsed.pathname.split('/documents/')[1] || '')

    if (parsed.pathname.endsWith(':runQuery')) {
      const query = JSON.parse(options.body).structuredQuery
      const collection = query.from[0].collectionId
      const matches = [...records.entries()]
        .filter(([key]) => key.startsWith(collection + '/'))
        .map(([name, fields]) => ({
          document: { name: 'projects/fixture/databases/(default)/documents/' + name, fields },
          readTime: new Date().toISOString(),
        }))
      return Response.json(matches)
    }

    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body)
      const existing = records.get(path) || {}
      records.set(path, { ...existing, ...body.fields })
      return Response.json({
        name: 'projects/fixture/databases/(default)/documents/' + path,
        fields: records.get(path),
      })
    }

    if (options.method === 'POST') {
      const body = JSON.parse(options.body)
      const docId = parsed.searchParams.get('documentId') || 'gen-' + ++counter
      const fullPath = path ? `${path}/${docId}` : docId
      records.set(fullPath, body.fields)
      return Response.json({
        name: 'projects/fixture/databases/(default)/documents/' + fullPath,
        fields: body.fields,
      }, { status: 200 })
    }

    if (records.has(path)) {
      return Response.json({
        name: 'projects/fixture/databases/(default)/documents/' + path,
        fields: records.get(path),
      })
    }

    return Response.json({ error: { message: 'Not found' } }, { status: 404 })
  }
})

after(() => {
  globalThis.fetch = originalFetch
})

test('phone normalization accurately normalizes Egyptian & international numbers', () => {
  assert.equal(normalizePhoneNumber('01012345678'), '201012345678')
  assert.equal(normalizePhoneNumber('+201012345678'), '201012345678')
  assert.equal(normalizePhoneNumber('00201012345678'), '201012345678')
  assert.equal(normalizePhoneNumber('+20 01012345678'), '201012345678')
  assert.equal(normalizePhoneNumber('1012345678'), '201012345678')
  assert.equal(normalizePhoneNumber('٠١٥٥١٠٠٧٠١٨'), '201551007018')
  assert.equal(normalizePhoneNumber('+966501234567'), '966501234567')
})

test('trialSubmissionSchema accepts Arabic specialty "طب" and optional null fields', () => {
  const result = trialSubmissionSchema.safeParse({
    doctorName: 'د. محمود سعيد',
    clinicName: 'مركز الشفاء الطبي',
    specialty: 'طب',
    phone: '01123456789',
    email: 'dr.mahmoud@example.com',
    governorate: null,
    city: null,
    address: null,
    expectedPatientsPerDay: null,
    notes: null,
  })
  assert.equal(result.success, true)
  assert.equal(result.data.specialty, 'طب')
  assert.equal(result.data.governorate, '')
  assert.equal(result.data.phone, '201123456789')
})

test('trialSubmissionSchema defaults empty specialty to "طب عام"', () => {
  const result = trialSubmissionSchema.safeParse({
    doctorName: 'د. أحمد علي',
    clinicName: 'عيادة النور',
    specialty: '',
    phone: '01223344556',
    email: 'ahmed@clinic.com',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.specialty, 'طب عام')
})

test('trialSubmissionSchema rejects bad inputs with clear field-level errors', () => {
  const result = trialSubmissionSchema.safeParse({
    doctorName: 'أ', // too short (< 2)
    clinicName: '', // empty
    specialty: 'باطنة',
    phone: '01012', // too short
    email: 'not-an-email',
  })
  assert.equal(result.success, false)
  const issues = result.error.issues
  assert.ok(issues.some(i => i.path.includes('doctorName')))
  assert.ok(issues.some(i => i.path.includes('clinicName')))
  assert.ok(issues.some(i => i.path.includes('phone')))
  assert.ok(issues.some(i => i.path.includes('email')))
})

test('POST /api/landing/trials returns 400 with structured fieldErrors on bad input', async () => {
  const response = await submitTrial(req('/api/landing/trials', {
    doctorName: 'م',
    clinicName: 'ع',
    phone: 'badphone',
    email: 'invalid',
  }))
  assert.equal(response.status, 400)
  const data = await response.json()
  assert.equal(data.success, false)
  assert.equal(data.code, 'INVALID_TRIAL')
  assert.ok(data.fieldErrors)
  assert.ok(data.fieldErrors.doctorName)
  assert.ok(data.fieldErrors.clinicName)
  assert.ok(data.fieldErrors.phone)
  assert.ok(data.fieldErrors.email)
})

test('POST /api/landing/trials rejects honeypot spam bot with SPAM_DETECTED', async () => {
  const response = await submitTrial(req('/api/landing/trials', {
    doctorName: 'د. سامي يوسف',
    clinicName: 'عيادة الصفا',
    specialty: 'أسنان',
    phone: '01012345678',
    email: 'sami@example.com',
    governorate: 'الجيزة',
    website: 'http://spam-link.com',
  }))
  assert.equal(response.status, 400)
  const data = await response.json()
  assert.equal(data.code, 'SPAM_DETECTED')
})

test('Owner trials endpoints require valid owner session', async () => {
  // Unauthorized request
  const unauthReq = new NextRequest(origin + '/api/owner/landing/trials', {
    method: 'GET',
    headers: { origin },
  })
  const unauthRes = await getOwnerTrials(unauthReq)
  assert.equal(unauthRes.status, 401)

  // Authorized request
  const authReq = new NextRequest(origin + '/api/owner/landing/trials', {
    method: 'GET',
    headers: {
      origin,
      cookie: `owner_session=${token}`,
    },
  })
  const authRes = await getOwnerTrials(authReq)
  assert.equal(authRes.status, 200)
})

test('Owner PATCH /api/owner/landing/trials updates status and created clinic info', async () => {
  const patchReq = new NextRequest(origin + '/api/owner/landing/trials', {
    method: 'PATCH',
    headers: {
      origin,
      'content-type': 'application/json',
      cookie: `owner_session=${token}`,
    },
    body: JSON.stringify({
      id: 'mock-req-123',
      status: 'clinic_created',
      createdClinicId: 'clinic-mock-456',
      createdClinicSlug: 'dr-zizo-clinic',
      internalNotes: 'تم الاتصال وإنشاء العيادة بنجاح',
    }),
  })
  const patchRes = await updateOwnerTrial(patchReq)
  assert.equal(patchRes.status, 200)
  const patchData = await patchRes.json()
  assert.equal(patchData.success, true)
  assert.equal(patchData.updates.status, 'clinic_created')
  assert.equal(patchData.updates.createdClinicId, 'clinic-mock-456')
})
