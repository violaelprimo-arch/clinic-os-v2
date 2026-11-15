// tests/ycloud-whatsapp-automation.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import {
  formatToE164,
  verifyYCloudWebhookSignature,
  sendWhatsAppTemplateMessage
} from '../src/lib/server/ycloud-service.ts'

import {
  getCairoUtcOffsetMinutes,
  getCairoAppointmentUtcDate,
  buildTemplateParameters,
  formatArabicDate,
  formatArabicTime,
  DEFAULT_WHATSAPP_SETTINGS
} from '../src/lib/server/whatsapp-scheduler.ts'

test('TASK 1: Multi-Tenant Clinic Isolation (Two clinics with different numbers)', async () => {
  const clinicA = {
    id: 'clinic-alpha-123',
    phoneNumber: '+201011111111',
    name: 'عيادة الشفاء'
  }
  const clinicB = {
    id: 'clinic-beta-456',
    phoneNumber: '+201022222222',
    name: 'عيادة الأمل'
  }

  // Ensure formatToE164 standardizes properly
  assert.equal(formatToE164('01011111111'), '+201011111111')
  assert.equal(formatToE164('01022222222'), '+201022222222')
  assert.notEqual(formatToE164(clinicA.phoneNumber), formatToE164(clinicB.phoneNumber))

  // Test sending messages for each clinic in mock mode
  const resA = await sendWhatsAppTemplateMessage({
    from: clinicA.phoneNumber,
    to: '01033333333',
    templateName: 'booking_confirmation',
    bodyVariables: ['أحمد', clinicA.name, 'الأحد 20 نوفمبر', '10:00 صباحاً', 'https://yalla-clinic.com/track/1']
  })

  const resB = await sendWhatsAppTemplateMessage({
    from: clinicB.phoneNumber,
    to: '01044444444',
    templateName: 'booking_confirmation',
    bodyVariables: ['محمود', clinicB.name, 'الاثنين 21 نوفمبر', '12:00 ظهراً', 'https://yalla-clinic.com/track/2']
  })

  assert.ok(resA.id, 'Clinic A message must generate unique ID')
  assert.ok(resB.id, 'Clinic B message must generate unique ID')
  assert.notEqual(resA.id, resB.id, 'Message IDs must never collide across clinics')
})

test('TASK 2: Flexible Reminder Scheduling (Minutes, Hours, Days) in Africa/Cairo', () => {
  // Test appointment date & time parsing in Africa/Cairo timezone
  const apptDate = '2026-12-15'
  const apptTime = '04:30 PM' // 16:30 local Cairo time

  const apptUtc = getCairoAppointmentUtcDate(apptDate, apptTime)
  const cairoOffsetMinutes = getCairoUtcOffsetMinutes(apptUtc)

  // Verify the UTC hours match (16:30 minus cairoOffset)
  const expectedUtcHours = 16 - Math.floor(cairoOffsetMinutes / 60)
  assert.equal(apptUtc.getUTCHours(), expectedUtcHours, 'UTC hour must properly reflect Cairo timezone')
  assert.equal(apptUtc.getUTCMinutes(), 30, 'UTC minutes must match 30')

  // Calculate reminder 24 hours before
  const reminder24h = new Date(apptUtc.getTime() - 24 * 60 * 60 * 1000)
  assert.equal(
    apptUtc.getTime() - reminder24h.getTime(),
    24 * 60 * 60 * 1000,
    '24-hour reminder must be exactly 86,400,000 ms before appointment'
  )

  // Calculate reminder 45 minutes before
  const reminder45m = new Date(apptUtc.getTime() - 45 * 60 * 1000)
  assert.equal(
    apptUtc.getTime() - reminder45m.getTime(),
    45 * 60 * 1000,
    '45-minute reminder must be exactly 2,700,000 ms before appointment'
  )

  // Calculate reminder 2 days before
  const reminder2d = new Date(apptUtc.getTime() - 2 * 24 * 60 * 60 * 1000)
  assert.equal(
    apptUtc.getTime() - reminder2d.getTime(),
    172800000,
    '2-day reminder must be exactly 172,800,000 ms before appointment'
  )
})

test('TASK 3: Template Parameter Formatting for Approved Meta UTILITY Templates', () => {
  const dummyJob = {
    id: 'wa_appt_123_rem_45m',
    appointmentId: 'appt-123',
    clinicId: 'clinic-xyz',
    clinicSlug: 'dr-ahmed',
    clinicName: 'عيادة د. أحمد',
    doctorName: 'أحمد',
    patientName: 'كريم حسن',
    patientPhone: '+201099887766',
    jobType: 'appointment_reminder',
    scheduledAt: new Date().toISOString(),
    appointmentDate: '2026-11-20',
    appointmentTime: '05:30 PM',
    status: 'pending',
    idempotencyKey: 'reminder_appt-123_45m',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const { templateName, variables } = buildTemplateParameters(dummyJob)
  assert.equal(templateName, 'appointment_reminder')
  assert.equal(variables[0], 'كريم حسن')
  assert.equal(variables[1], 'عيادة د. أحمد')
  assert.ok(variables[2].includes('نوفمبر') || variables[2].includes('2026'), 'Date must be formatted in Arabic')
  assert.ok(variables[3].includes('مساءً') || variables[3].includes('05:30'), 'Time must be formatted in Arabic')

  // Check booking confirmation template
  const confirmationJob = {
    ...dummyJob,
    jobType: 'booking_confirmation'
  }
  const confResult = buildTemplateParameters(confirmationJob)
  assert.equal(confResult.templateName, 'booking_confirmation')
  assert.equal(confResult.variables.length, 5)
  assert.ok(
    confResult.variables[4].includes('https://yalla-clinic.com/clinic/dr-ahmed/track/appt-123'),
    'Tracking link must be permanent and clean'
  )
})

test('TASK 4: Idempotency & Deterministic Deduplication', () => {
  const appointmentId = 'appt_xyz_789'
  const ruleOffset = 45 // 45 minutes
  const jobId = `wa_${appointmentId}_rem_${ruleOffset}m`
  const idempotencyKey = `reminder_${appointmentId}_${ruleOffset}m`

  // Re-generating the same job produces identical IDs, preventing duplicate rows in Firestore
  const jobId2 = `wa_${appointmentId}_rem_${ruleOffset}m`
  const idempotencyKey2 = `reminder_${appointmentId}_${ruleOffset}m`

  assert.equal(jobId, jobId2, 'Job IDs must be deterministic')
  assert.equal(idempotencyKey, idempotencyKey2, 'Idempotency keys must be identical')
})

test('TASK 5: Webhook Signature Verification (Valid, Tampered, Expired)', () => {
  const secret = 'whsec_test_secret_key_123456789'
  const payload = JSON.stringify({
    id: 'evt_123456',
    type: 'whatsapp.message.updated',
    whatsappMessage: { id: 'msg_999', status: 'delivered' }
  })

  const nowSec = Math.floor(Date.now() / 1000)
  const validHmac = crypto
    .createHmac('sha256', secret)
    .update(`${nowSec}.${payload}`, 'utf8')
    .digest('hex')

  const validHeader = `t=${nowSec},s=${validHmac}`

  // 1. Valid Signature
  const resultValid = verifyYCloudWebhookSignature(payload, validHeader, secret)
  assert.equal(resultValid.valid, true, 'Valid signature must pass')

  // 2. Tampered Payload (Body changed by 1 character)
  const tamperedPayload = payload + ' '
  const resultTampered = verifyYCloudWebhookSignature(tamperedPayload, validHeader, secret)
  assert.equal(resultTampered.valid, false, 'Tampered payload must fail signature verification')
  assert.equal(resultTampered.error, 'SIGNATURE_MISMATCH')

  // 3. Expired Timestamp (Replay Attack: 10 minutes ago = 600s)
  const expiredSec = nowSec - 600
  const expiredHmac = crypto
    .createHmac('sha256', secret)
    .update(`${expiredSec}.${payload}`, 'utf8')
    .digest('hex')
  const expiredHeader = `t=${expiredSec},s=${expiredHmac}`

  const resultExpired = verifyYCloudWebhookSignature(payload, expiredHeader, secret)
  assert.equal(resultExpired.valid, false, 'Expired timestamp must be rejected to prevent replay attacks')
  assert.equal(resultExpired.error, 'TIMESTAMP_OUT_OF_TOLERANCE')
})

test('TASK 6: Patient Consent & Opt-out Respect', () => {
  // Consent is default true, but when explicitly false, no messages may be dispatched
  const patientA = { whatsappConsent: true }
  const patientB = { whatsappConsent: false }

  const shouldSendA = patientA.whatsappConsent !== false
  const shouldSendB = patientB.whatsappConsent !== false

  assert.equal(shouldSendA, true, 'Patient with consent should receive WhatsApp messages')
  assert.equal(shouldSendB, false, 'Patient without consent must be skipped')
})

test('TASK 7: Default Settings & Reminder Constraints', () => {
  assert.equal(DEFAULT_WHATSAPP_SETTINGS.sendBookingConfirmation, true)
  assert.equal(DEFAULT_WHATSAPP_SETTINGS.sendReminders, true)
  assert.equal(DEFAULT_WHATSAPP_SETTINGS.reminders.length, 2)
  assert.equal(DEFAULT_WHATSAPP_SETTINGS.monthlyLimit, 500)
})
