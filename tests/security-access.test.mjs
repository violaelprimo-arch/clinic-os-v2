import assert from 'node:assert'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  createShareToken,
  verifyShareToken
} from '../src/lib/auth-crypto.ts'

console.log('--- RUNNING SECURITY & CRYPTO TEST SUITE ---')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✅ [PASS] ${name}`)
  } catch (err) {
    failed++
    console.error(`  ❌ [FAIL] ${name}:`, err.message)
  }
}

// 1. PBKDF2 Password Hashing
await test('PBKDF2 hash generation uses pbkdf2:100000:<salt>:<hash> format', async () => {
  const hash = await hashPassword('MySecretPass123!')
  assert(hash.startsWith('pbkdf2:100000:'), 'Hash must start with pbkdf2:100000:')
  const parts = hash.split(':')
  assert.strictEqual(parts.length, 4, 'Must have 4 parts: pbkdf2, iterations, salt, hash')
  assert.strictEqual(parts[2].length, 32, 'Salt must be 16 bytes (32 hex characters)')
  assert.strictEqual(parts[3].length, 64, 'Hash must be 32 bytes (64 hex characters)')
})

await test('PBKDF2 generates unique salt and hash for the same password twice', async () => {
  const hash1 = await hashPassword('DuplicatePass123')
  const hash2 = await hashPassword('DuplicatePass123')
  assert.notStrictEqual(hash1, hash2, 'Two hashes with different random salts must never be identical')
})

await test('PBKDF2 verifies correct password and rejects wrong password', async () => {
  const hash = await hashPassword('DoctorSecure#2026')
  const valid = await verifyPassword('DoctorSecure#2026', hash)
  assert.strictEqual(valid, true, 'Correct password must verify')

  const invalid = await verifyPassword('WrongPassword#2026', hash)
  assert.strictEqual(invalid, false, 'Wrong password must be rejected')
})

// 2. Legacy SHA-256 Backward Compatibility
await test('Legacy SHA-256 64-char hex hash verifies correctly', async () => {
  // Compute legacy hash of "LegacyDoctorPass2026" using default salt
  const salt = process.env.AUTH_SECRET || 'clinic-os-v2-secure-cairo-salt-key-2026'
  const enc = new TextEncoder()
  const data = enc.encode(`${salt}:LegacyDoctorPass2026`)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  const legacyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

  assert.strictEqual(legacyHash.length, 64)
  const valid = await verifyPassword('LegacyDoctorPass2026', legacyHash)
  assert.strictEqual(valid, true, 'Legacy hash must verify for backward compatibility')

  const invalid = await verifyPassword('WrongPass', legacyHash)
  assert.strictEqual(invalid, false, 'Wrong password against legacy hash must fail')
})

// 3. Strict Rejection of Plaintext Passwords
await test('Plaintext password stored in DB is NEVER accepted as valid hash', async () => {
  const plainInDb = 'PlaintextPassword123'
  const valid = await verifyPassword('PlaintextPassword123', plainInDb)
  assert.strictEqual(valid, false, 'Plaintext matching must be strictly rejected')
})

// 4. HMAC-SHA256 Session Tokens
await test('HMAC-SHA256 session token creates and verifies with constant-time signature', async () => {
  const token = await createSessionToken({
    role: 'doctor',
    clinicId: 'clinic-123',
    slug: 'dr-karim',
    email: 'dr.karim@test.com'
  })

  assert(token.includes('.'), 'Token must be data.signature')
  const verified = await verifySessionToken(token)
  assert.strictEqual(verified.valid, true)
  assert.strictEqual(verified.payload.role, 'doctor')
  assert.strictEqual(verified.payload.clinicId, 'clinic-123')
  assert.strictEqual(verified.payload.slug, 'dr-karim')
})

await test('Tampered session token signature is rejected', async () => {
  const token = await createSessionToken({
    role: 'doctor',
    clinicId: 'clinic-123'
  })

  const [data, sig] = token.split('.')
  const tamperedSig = sig.slice(0, -2) + '00'
  const verified = await verifySessionToken(`${data}.${tamperedSig}`)
  assert.strictEqual(verified.valid, false)
  assert.strictEqual(verified.error, 'SIGNATURE_MISMATCH')
})

// 5. Signed Share Tokens for Invoices & Prescriptions
await test('Share token generates and verifies for valid matching clinic, record, and type', async () => {
  const token = await createShareToken({
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'prescription',
    expiresInHours: 24
  })

  const isValid = await verifyShareToken(token, {
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'prescription'
  })
  assert.strictEqual(isValid, true, 'Valid share token must verify')
})

await test('Share token rejects wrong clinicId (cross-clinic IDOR protection)', async () => {
  const token = await createShareToken({
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'prescription',
    expiresInHours: 24
  })

  const isCrossClinicValid = await verifyShareToken(token, {
    clinicId: 'clinic-zizo-02', // Attacker clinic
    recordId: 'appt-998877',
    type: 'prescription'
  })
  assert.strictEqual(isCrossClinicValid, false, 'Cross-clinic token must be rejected')
})

await test('Share token rejects wrong recordId or wrong type', async () => {
  const token = await createShareToken({
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'invoice',
    expiresInHours: 24
  })

  const isWrongRecordValid = await verifyShareToken(token, {
    clinicId: 'clinic-karim-01',
    recordId: 'appt-different-id',
    type: 'invoice'
  })
  assert.strictEqual(isWrongRecordValid, false, 'Wrong recordId must be rejected')

  const isWrongTypeValid = await verifyShareToken(token, {
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'prescription'
  })
  assert.strictEqual(isWrongTypeValid, false, 'Wrong type must be rejected')
})

await test('Expired share token is strictly rejected', async () => {
  const expiredToken = await createShareToken({
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'prescription',
    expiresInHours: -1 // Expired 1 hour ago
  })

  const isValid = await verifyShareToken(expiredToken, {
    clinicId: 'clinic-karim-01',
    recordId: 'appt-998877',
    type: 'prescription'
  })
  assert.strictEqual(isValid, false, 'Expired token must be rejected')
})

console.log(`\nTEST SUMMARY: Passed: ${passed}, Failed: ${failed}`)
if (failed > 0) process.exit(1)
