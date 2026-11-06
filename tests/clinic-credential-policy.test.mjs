import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeDoctorEmail,
  isCurrentClinicDoctor,
  pickNormalClinicSettings,
} from '../src/lib/clinic-credential-policy.ts'
import { normalizeBookingPageConfig, displayDoctorName } from '../src/lib/booking-page-config.ts'
import { createSessionToken, verifySessionToken } from '../src/lib/auth-crypto.ts'

const clinicId = 'clinic-123'
const slug = 'clinic-example'
const clinic = { slug, doctorEmail: 'doctor@example.com' }
const doctorSession = {
  role: 'doctor', clinicId, slug, email: 'DOCTOR@example.com', issuedAt: 1770000000000,
}

test('Only the doctor of this exact clinic can change credentials', () => {
  assert.equal(isCurrentClinicDoctor(doctorSession, clinic, clinicId, slug), true)
  assert.equal(isCurrentClinicDoctor({ ...doctorSession, role: 'assistant' }, clinic, clinicId, slug), false)
  assert.equal(isCurrentClinicDoctor({ ...doctorSession, role: 'owner' }, clinic, clinicId, slug), false)
  assert.equal(isCurrentClinicDoctor({ ...doctorSession, clinicId: 'other' }, clinic, clinicId, slug), false)
  assert.equal(isCurrentClinicDoctor({ ...doctorSession, slug: 'other' }, clinic, clinicId, slug), false)
  assert.equal(isCurrentClinicDoctor({ ...doctorSession, email: 'other@example.com' }, clinic, clinicId, slug), false)
})

test('Password changes invalidate older doctor sessions', () => {
  assert.equal(isCurrentClinicDoctor(doctorSession, {
    ...clinic, passwordLastChangedAt: new Date(doctorSession.issuedAt + 1000).toISOString(),
  }, clinicId, slug), false)
  assert.equal(isCurrentClinicDoctor(doctorSession, {
    ...clinic, passwordLastChangedAt: new Date(doctorSession.issuedAt - 1000).toISOString(),
  }, clinicId, slug), true)
})

test('Normal settings cannot update credentials, tenant IDs or platform roles', () => {
  assert.deepEqual(pickNormalClinicSettings({
    clinicName: 'Clinic', maxDailyBookings: 5,
    doctorEmail: 'attacker@example.com', doctorPasswordHash: 'forged',
    doctorPassword: 'exposed', mustChangePassword: false,
    clinicId: 'other', platformOwner: true, subscriptionStatus: 'active',
  }), { clinicName: 'Clinic', maxDailyBookings: 5 })
  assert.deepEqual(pickNormalClinicSettings(null), {})
})

test('Doctor email normalization rejects invalid addresses', () => {
  assert.equal(normalizeDoctorEmail(' Doctor@Example.Com '), 'doctor@example.com')
  assert.equal(normalizeDoctorEmail('not-an-email'), null)
  assert.equal(normalizeDoctorEmail(undefined), null)
})

test('Production clinic sessions must use a non-default secret', async () => {
  const previous = {
    env: process.env.NODE_ENV,
    clinic: process.env.CLINIC_SESSION_SECRET,
    auth: process.env.AUTH_SECRET,
  }
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.CLINIC_SESSION_SECRET
    delete process.env.AUTH_SECRET
    const payload = { role: 'doctor', clinicId, slug, name: 'Doctor' }
    await assert.rejects(createSessionToken(payload), /CLINIC_SESSION_SECRET_REQUIRED/)
    process.env.CLINIC_SESSION_SECRET = 'a-secret-with-more-than-32-characters-for-tests'
    const token = await createSessionToken(payload)
    assert.equal((await verifySessionToken(token)).valid, true)
    process.env.CLINIC_SESSION_SECRET = 'a-second-long-secret-for-rotation-testing'
    assert.equal((await verifySessionToken(token)).valid, false)
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.env,
      CLINIC_SESSION_SECRET: previous.clinic,
      AUTH_SECRET: previous.auth,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('Booking page customization is bounded and never exposes credential keys', () => {
  const updated = pickNormalClinicSettings({
    bookingPageConfig: {
      headlineAr: '  عنوان مميز  ', showLocation: false, showServices: 'false',
      doctorPassword: 'should-never-persist',
      trustAr: ['وقت مناسب', 42, 'تقييمات حقيقية', 'أمان'],
      heroLayout: 'copy_first', unknown: { isAdmin: true },
    },
  })
  const cfg = updated.bookingPageConfig
  assert.equal(cfg.headlineAr, 'عنوان مميز')
  assert.equal(cfg.showLocation, false)
  assert.equal(cfg.showServices, true)
  assert.equal(cfg.heroLayout, 'copy_first')
  assert.equal(cfg.trustAr[1], 'تقييمات حقيقية')
  assert.equal(Object.hasOwn(cfg, 'doctorPassword'), false)
  assert.equal(Object.hasOwn(cfg, 'unknown'), false)
  assert.deepEqual(normalizeBookingPageConfig(undefined), normalizeBookingPageConfig({}))
})

test('Doctor title does not repeat with legacy prefixed doctor names', () => {
  assert.equal(displayDoctorName('د. أحمد السعيد', 'د.'), 'د. أحمد السعيد')
  assert.equal(displayDoctorName('أحمد السعيد', 'د.'), 'د. أحمد السعيد')
  assert.equal(displayDoctorName('Dr. Ahmed', 'Dr.'), 'Dr. Ahmed')
})
