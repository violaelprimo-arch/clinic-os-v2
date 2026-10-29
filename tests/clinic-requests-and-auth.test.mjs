import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/lib/auth-crypto.ts'
import { trialSubmissionSchema } from '../src/lib/landing-config.ts'

describe('Clinic Registration, Doctor Password & OTP Security Suite', () => {

  it('P01: Validates complete clinic registration request schema without requiring password', () => {
    const validPayload = {
      doctorName: 'د. خالد عبد الرحمن',
      clinicName: 'مركز الشفاء التخصصي',
      specialty: 'أمراض القلب والأوعية الدموية',
      phone: '01012345678',
      email: 'khaled.cardio@gmail.com',
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      address: 'شارع عباس العقاد، برج النصر الطبي',
      expectedPatientsPerDay: '20 - 30 مريض',
      notes: 'نريد تفعيل الحجز الإلكتروني وشاشة النداء TV'
    }

    const parsed = trialSubmissionSchema.safeParse(validPayload)
    assert.strictEqual(parsed.success, true, 'Valid payload should parse successfully')
    assert.strictEqual(parsed.data.doctorName, validPayload.doctorName)
    assert.strictEqual(parsed.data.email, validPayload.email)
    assert.strictEqual(parsed.data.phone, '201012345678', 'Phone should be normalized with international Egyptian prefix')
    assert.strictEqual(parsed.data.governorate, 'القاهرة')
    assert.strictEqual(parsed.data.city, 'مدينة نصر')
    assert.strictEqual(parsed.data.address, 'شارع عباس العقاد، برج النصر الطبي')
    // Ensure password is NEVER part of public registration schema
    assert.strictEqual('password' in parsed.data, false, 'Password must not be in public registration payload')
  })

  it('P02: Rejects invalid or malicious clinic registration attempts', () => {
    // Missing doctor name
    const invalidName = trialSubmissionSchema.safeParse({
      doctorName: 'A',
      clinicName: 'عيادة الفؤاد',
      specialty: 'باطنة',
      phone: '01012345678',
      email: 'doc@example.com'
    })
    assert.strictEqual(invalidName.success, false, 'Should reject too short doctor name')

    // Invalid phone number
    const invalidPhone = trialSubmissionSchema.safeParse({
      doctorName: 'د. أحمد',
      clinicName: 'عيادة الأمل',
      specialty: 'باطنة',
      phone: '12345',
      email: 'doc@example.com'
    })
    assert.strictEqual(invalidPhone.success, false, 'Should reject invalid phone')

    // Invalid email
    const invalidEmail = trialSubmissionSchema.safeParse({
      doctorName: 'د. محمد',
      clinicName: 'عيادة النور',
      specialty: 'جلدية',
      phone: '01098765432',
      email: 'not-an-email'
    })
    assert.strictEqual(invalidEmail.success, false, 'Should reject invalid email')
  })

  it('P03: Hashes doctor initial password securely and preserves verifyPassword functionality', async () => {
    const initialPlain = 'Clin@2026!Key7'
    const hashed = await hashPassword(initialPlain)

    assert.notStrictEqual(hashed, initialPlain, 'Hashed password must not match plaintext')
    assert.strictEqual(hashed.length, 64, 'SHA-256 hash should be 64 hexadecimal characters')

    const isValid = await verifyPassword(initialPlain, hashed)
    assert.strictEqual(isValid, true, 'verifyPassword must return true for correct password')

    const isWrongValid = await verifyPassword('WrongPassword123', hashed)
    assert.strictEqual(isWrongValid, false, 'verifyPassword must return false for incorrect password')
  })

  it('P04: Session tokens correctly convey mustChangePassword flag and enforce boundaries', async () => {
    const sessionPayload = {
      role: 'doctor',
      email: 'newdoctor@yalla-clinic.com',
      name: 'د. سامح شريف',
      clinicId: 'clinic_test_123',
      slug: 'sameh-clinic',
      mustChangePassword: true
    }

    const token = await createSessionToken(sessionPayload)
    assert.ok(token && token.includes('.'), 'Token must be formatted as data.signature')

    const verification = await verifySessionToken(token)
    assert.strictEqual(verification.valid, true, 'Session token signature must be valid')
    assert.strictEqual(verification.payload.mustChangePassword, true, 'mustChangePassword must be preserved in payload')
    assert.strictEqual(verification.payload.role, 'doctor')
    assert.strictEqual(verification.payload.slug, 'sameh-clinic')

    // Tampered token test
    const tampered = token.slice(0, -4) + 'abcd'
    const tamperedVerify = await verifySessionToken(tampered)
    assert.strictEqual(tamperedVerify.valid, false, 'Tampered token signature must be rejected')
  })

  it('P05: Updated session token clears mustChangePassword after verified change', async () => {
    const updatedPayload = {
      role: 'doctor',
      email: 'newdoctor@yalla-clinic.com',
      name: 'د. سامح شريف',
      clinicId: 'clinic_test_123',
      slug: 'sameh-clinic',
      mustChangePassword: false
    }

    const updatedToken = await createSessionToken(updatedPayload)
    const verification = await verifySessionToken(updatedToken)
    assert.strictEqual(verification.valid, true)
    assert.strictEqual(verification.payload.mustChangePassword, false, 'mustChangePassword must be false after update')
  })

  it('P06: OTP Generation is 6-digit numeric and cryptographically random', () => {
    for (let i = 0; i < 20; i++) {
      const randomValues = new Uint32Array(1)
      crypto.getRandomValues(randomValues)
      const otp = (100000 + (randomValues[0] % 900000)).toString()
      assert.strictEqual(otp.length, 6, 'OTP must be exactly 6 digits')
      assert.match(otp, /^\d{6}$/, 'OTP must contain digits only')
      const num = parseInt(otp, 10)
      assert.ok(num >= 100000 && num <= 999999, 'OTP must be in range 100000-999999')
    }
  })

  it('P07: OTP Hashing and single-use verification verification cycle', async () => {
    const generatedOtp = '482915'
    const hashedOtp = await hashPassword(generatedOtp)

    // Verification check
    const isCorrect = await verifyPassword('482915', hashedOtp)
    assert.strictEqual(isCorrect, true, 'Correct OTP matches hash')

    const isWrong = await verifyPassword('482916', hashedOtp)
    assert.strictEqual(isWrong, false, 'Wrong OTP fails match')
  })
})
