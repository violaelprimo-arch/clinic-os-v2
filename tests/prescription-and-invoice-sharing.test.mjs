import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatPrescriptionWhatsAppMessage,
  formatInvoiceWhatsAppMessage,
  generateCleanRxFileName
} from '../src/lib/whatsappShare.ts'
import {
  createShareToken,
  verifyShareToken,
  createSessionToken,
  verifySessionToken,
  hashPassword,
  verifyPassword
} from '../src/lib/auth-crypto.ts'
import {
  maskPhoneNumber,
  normalizePhone,
  authorizeRecordAccess
} from '../src/lib/server/record-access.ts'
import {
  toSafeRgb
} from '../src/lib/pdfGenerator.ts'

test('TASK 5: WhatsApp prescription message uses permanent link and protects patient privacy', () => {
  const directRxUrl = 'https://yalla-clinic.com/clinic/cairo-ortho/prescription/appt-12345'
  const message = formatPrescriptionWhatsAppMessage({
    clinicName: 'عيادة القاهرة للعظام',
    doctorName: 'حازم شريف',
    specialty: 'جراحة العظام',
    patientName: 'أحمد محمود',
    patientAge: 35,
    date: '2026-11-15',
    diagnosis: 'التهاب أوتار الكتف الأيمن المزمن',
    instructions: 'الراحة لمدة أسبوع',
    drugs: [{ name: 'Panadol Extra', dosage: 'قرص كل 8 ساعات' }],
    directRxUrl
  })

  // 1. Matches required verbatim Arabic template structure
  assert.ok(message.includes('مرحبًا، هذه روشتتك الطبية من عيادة عيادة القاهرة للعظام.'), 'Must include greeting with clinic name')
  assert.ok(message.includes('يمكنك فتح الروشتة وتحميلها أو طباعتها من الرابط التالي:'), 'Must include permanent link header')
  assert.ok(message.includes(directRxUrl), 'Must contain exact clean permanent URL')
  assert.ok(message.includes('نتمنى لك دوام الصحة والعافية.'), 'Must include closing health wish')
  assert.ok(message.includes('Yalla Clinic'), 'Must include platform signature')

  // 2. Strict Privacy: NO diagnosis, NO medication names in WhatsApp message body
  assert.ok(!message.includes('التهاب أوتار'), 'Must NOT reveal sensitive medical diagnosis in WhatsApp chat')
  assert.ok(!message.includes('Panadol Extra'), 'Must NOT reveal prescription drug names in WhatsApp chat')

  // 3. Clean URL: NO token or expires parameter in link
  assert.ok(!message.includes('?token='), 'Must NOT contain temporary token in URL')
  assert.ok(!message.includes('expires='), 'Must NOT contain expiration parameter in URL')
})

test('TASK 5: WhatsApp invoice message uses clean permanent link and protects patient privacy', () => {
  const directInvoiceUrl = 'https://yalla-clinic.com/clinic/cairo-ortho/invoice/inv-9988'
  const message = formatInvoiceWhatsAppMessage({
    clinicName: 'عيادة القاهرة للعظام',
    patientName: 'أحمد محمود',
    patientPhone: '01012345678',
    invoiceNumber: 'inv-9988',
    date: '2026-11-15',
    time: '04:30 م',
    serviceName: 'كشف واستشارة طبية',
    originalPrice: 400,
    discount: 50,
    netTotal: 350,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    directInvoiceUrl
  })

  assert.ok(message.includes('فاتورة طبية رسمية - إيصال سداد'), 'Must include invoice title')
  assert.ok(message.includes('عيادة القاهرة للعظام'), 'Must include clinic name')
  assert.ok(message.includes('inv-9988'), 'Must include invoice number')
  assert.ok(message.includes(directInvoiceUrl), 'Must include exact clean invoice URL')
  assert.ok(!message.includes('?token='), 'Must NOT contain temporary token in URL')
  assert.ok(!message.includes('expires='), 'Must NOT contain expiration in URL')
})

test('TASK 5: generateCleanRxFileName produces safe sanitized file names', () => {
  const pdfName = generateCleanRxFileName('أحمد محمود', '2026-11-15', 'pdf')
  assert.ok(pdfName.startsWith('Rx_') && pdfName.endsWith('.pdf'), 'Must generate clean sanitized PDF filename')

  const pngName = generateCleanRxFileName('Dr. Jane Doe & Co.', '2026-11-15', 'png')
  assert.ok(pngName.startsWith('Rx_') && pngName.endsWith('.png'), 'Must generate clean sanitized PNG filename')
})

test('TASK 3: Permanent Share Tokens & Cryptographic Verification', async () => {
  const token = await createShareToken({
    clinicId: 'clinic-alpha',
    recordId: 'rec-001',
    type: 'prescription'
  })

  assert.ok(token && typeof token === 'string', 'Token must be a non-empty string')

  // Verify valid token
  const valid = await verifyShareToken(token, {
    clinicId: 'clinic-alpha',
    recordId: 'rec-001',
    type: 'prescription'
  })
  assert.equal(valid, true, 'Valid token must be successfully verified')

  // Prevent cross-record spoofing
  const invalidRecord = await verifyShareToken(token, {
    clinicId: 'clinic-alpha',
    recordId: 'rec-002',
    type: 'prescription'
  })
  assert.equal(invalidRecord, false, 'Token must not verify for different record')

  // Prevent cross-clinic spoofing
  const invalidClinic = await verifyShareToken(token, {
    clinicId: 'clinic-beta',
    recordId: 'rec-001',
    type: 'prescription'
  })
  assert.equal(invalidClinic, false, 'Token must not verify for different clinic')

  // Prevent cross-type spoofing
  const invalidType = await verifyShareToken(token, {
    clinicId: 'clinic-alpha',
    recordId: 'rec-001',
    type: 'invoice'
  })
  assert.equal(invalidType, false, 'Token must not verify for different document type')

  // Backward compatibility: Verify a token created with past timestamp still passes HMAC validation
  // Format: clinicId:recordId:type:expiresAt:signature
  const pastExpires = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
  const enc = new TextEncoder()
  const payload = `clinic-alpha:rec-001:prescription:${pastExpires}`
  // Use createShareToken with negative expiry
  const legacyToken = await createShareToken({
    clinicId: 'clinic-alpha',
    recordId: 'rec-001',
    type: 'prescription',
    expiresInHours: -720 // expired 30 days ago
  })
  const legacyValid = await verifyShareToken(legacyToken, {
    clinicId: 'clinic-alpha',
    recordId: 'rec-001',
    type: 'prescription'
  })
  assert.equal(legacyValid, true, 'Legitimate legacy token must remain accessible permanently')
})

test('TASK 4: Phone Masking & Normalization', () => {
  assert.equal(maskPhoneNumber('01012345678'), '010****5678')
  assert.equal(maskPhoneNumber('+201012345678'), '010****5678')
  assert.equal(maskPhoneNumber('201012345678'), '010****5678')
  assert.equal(maskPhoneNumber('01198765432'), '011****5432')
  assert.equal(maskPhoneNumber(''), '')
  assert.equal(maskPhoneNumber(null), '')

  assert.equal(normalizePhone('+201012345678'), '01012345678')
  assert.equal(normalizePhone('00201012345678'), '01012345678')
  assert.equal(normalizePhone('201012345678'), '01012345678')
  assert.equal(normalizePhone('01012345678'), '01012345678')
})

test('TASK 4: Password & OTP Hash and Verification', async () => {
  const otp = '482915'
  const hash = await hashPassword(otp)
  assert.ok(hash.startsWith('pbkdf2:'), 'Hash must use PBKDF2 format')

  const isMatch = await verifyPassword('482915', hash)
  assert.equal(isMatch, true, 'Correct OTP must match hash')

  const isWrong = await verifyPassword('111111', hash)
  assert.equal(isWrong, false, 'Incorrect OTP must fail verification')
})

test('TASK 4: Multi-Tenant IDOR and Patient Record Authorization', async () => {
  // Mock NextRequest-like object
  function createMockRequest(headers = {}, cookies = {}, searchParams = {}) {
    return {
      headers: {
        get: (name) => headers[name.toLowerCase()] || null
      },
      cookies: {
        get: (name) => (cookies[name] !== undefined ? { value: cookies[name] } : undefined)
      },
      nextUrl: {
        searchParams: {
          get: (param) => searchParams[param] || null
        }
      }
    }
  }

  // 1. Unauthenticated request without session or token -> Requires verification
  const unauthReq = createMockRequest({}, {}, {})
  const unauthRes = await authorizeRecordAccess(unauthReq, {
    clinicId: 'clinic-1',
    clinicSlug: 'clinic-1',
    recordId: 'appt-1',
    recordType: 'prescription',
    recordPhone: '01012345678'
  })
  assert.equal(unauthRes.authorized, false)
  assert.equal(unauthRes.error, 'VERIFICATION_REQUIRED')
  assert.equal(unauthRes.maskedPhone, '010****5678')

  // 2. Request with valid share token -> Authorized as guest_token
  const validToken = await createShareToken({
    clinicId: 'clinic-1',
    recordId: 'appt-1',
    type: 'prescription'
  })
  const tokenReq = createMockRequest({}, {}, { token: validToken })
  const tokenRes = await authorizeRecordAccess(tokenReq, {
    clinicId: 'clinic-1',
    clinicSlug: 'clinic-1',
    recordId: 'appt-1',
    recordType: 'prescription',
    recordPhone: '01012345678'
  })
  assert.equal(tokenRes.authorized, true)
  assert.equal(tokenRes.accessorRole, 'guest_token')

  // 3. Request with verified patient session matching phone -> Authorized as patient
  const patientToken = await createSessionToken({
    role: 'patient',
    name: 'أحمد محمود',
    phone: '01012345678',
    clinicId: 'clinic-1',
    slug: 'clinic-1',
    patientId: 'patient-42'
  })
  const patientReq = createMockRequest({}, { patient_session: patientToken }, {})
  const patientRes = await authorizeRecordAccess(patientReq, {
    clinicId: 'clinic-1',
    clinicSlug: 'clinic-1',
    recordId: 'appt-1',
    recordType: 'prescription',
    recordPhone: '01012345678',
    recordPatientId: 'patient-42'
  })
  assert.equal(patientRes.authorized, true)
  assert.equal(patientRes.accessorRole, 'patient')

  // 4. IDOR Protection: Patient from clinic-1 trying to access clinic-2 record -> Denied
  const crossClinicPatientRes = await authorizeRecordAccess(patientReq, {
    clinicId: 'clinic-2',
    clinicSlug: 'clinic-2',
    recordId: 'appt-99',
    recordType: 'prescription',
    recordPhone: '01012345678'
  })
  assert.equal(crossClinicPatientRes.authorized, false)

  // 5. IDOR Protection: Doctor from clinic-1 trying to access clinic-2 record -> 403 Forbidden
  const doctorTokenClinic1 = await createSessionToken({
    role: 'doctor',
    name: 'د. مصطفى',
    clinicId: 'clinic-1',
    slug: 'clinic-1'
  })
  const doctorReq = createMockRequest({}, { clinic_session: doctorTokenClinic1 }, {})
  const crossClinicDoctorRes = await authorizeRecordAccess(doctorReq, {
    clinicId: 'clinic-2',
    clinicSlug: 'clinic-2',
    recordId: 'appt-99',
    recordType: 'prescription',
    recordPhone: '01099998888'
  })
  assert.equal(crossClinicDoctorRes.authorized, false)
  assert.equal(crossClinicDoctorRes.status, 403)
})

test('TASK 2: Modern CSS Color Sanitization for html2canvas compatibility', () => {
  // Safe colors pass through unchanged
  assert.equal(toSafeRgb('rgb(15, 23, 42)'), 'rgb(15, 23, 42)')
  assert.equal(toSafeRgb('rgba(255, 255, 255, 0.9)'), 'rgba(255, 255, 255, 0.9)')
  assert.equal(toSafeRgb('#087cf4'), '#087cf4')

  // Modern unsupported CSS colors (Tailwind v4) are safely converted
  const oklchResult = toSafeRgb('oklch(0.623 0.214 259.815)')
  assert.ok(!oklchResult.includes('oklch'), 'Must strip oklch to avoid html2canvas crash')

  const labResult = toSafeRgb('lab(50% 20 -30)')
  assert.ok(!labResult.includes('lab('), 'Must strip lab to avoid html2canvas crash')

  const colorMixResult = toSafeRgb('color-mix(in srgb, red 20%, white)')
  assert.ok(!colorMixResult.includes('color-mix'), 'Must strip color-mix')
})

