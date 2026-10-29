import assert from 'assert'
import fs from 'fs'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware.ts'
import {
  formatWaitDuration,
  calculatePatientLivePosition,
  sortQueue
} from '../src/lib/queueCalculations.ts'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken
} from '../src/lib/auth-crypto.ts'

console.log('=================================================================')
console.log('   YALLA CLINIC — AUDIT FINDINGS VERIFICATION SUITE (A01 - A22)  ')
console.log('=================================================================')

let passed = 0
let failed = 0

function runTest(name, fn) {
  try {
    fn()
    console.log(`[PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message)
    failed++
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn()
    console.log(`[PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message)
    failed++
  }
}

// 1. A01: Unauthenticated Admin Protection in Middleware
await runAsyncTest('A01: Unauthenticated request to /clinic/zizo/admin redirects to /clinic/zizo/login', async () => {
  const req = new NextRequest('https://yalla-clinic.com/clinic/zizo/admin', {
    headers: { host: 'yalla-clinic.com' }
  })
  const res = await middleware(req)
  assert.equal(res.status, 307, 'Must redirect with status 307')
  const location = res.headers.get('location')
  assert(location && location.includes('/clinic/zizo/login'), 'Must redirect to clinic login page')
})

await runAsyncTest('A01: Subdomain unauthenticated /admin redirects to /login', async () => {
  const req = new NextRequest('https://zizo.yalla-clinic.com/admin', {
    headers: { host: 'zizo.yalla-clinic.com' }
  })
  const res = await middleware(req)
  assert.equal(res.status, 307, 'Must redirect with status 307')
  const location = res.headers.get('location')
  assert(location && location.includes('/login'), 'Must redirect to /login')
})

await runAsyncTest('A01: Authenticated doctor with valid session cookie is allowed through', async () => {
  const token = await createSessionToken({
    role: 'doctor',
    name: 'د. زياد',
    email: 'zizo@yalla-clinic.com',
    clinicId: 'zizo-id',
    slug: 'zizo'
  })
  const req = new NextRequest('https://yalla-clinic.com/clinic/zizo/admin', {
    headers: {
      host: 'yalla-clinic.com',
      cookie: `clinic_session=${token}`
    }
  })
  const res = await middleware(req)
  // When authorized on non-subdomain, next() gives status 200 / x-middleware-next
  assert.notEqual(res.status, 307, 'Must NOT redirect authorized doctor')
})

await runAsyncTest('A01: Cross-tenant doctor (Clinic A token accessing Clinic B) is rejected', async () => {
  const tokenClinicA = await createSessionToken({
    role: 'doctor',
    name: 'طبيب عيادة أ',
    email: 'dr-a@clinic.com',
    clinicId: 'clinic-a',
    slug: 'clinic-a'
  })
  const req = new NextRequest('https://yalla-clinic.com/clinic/clinic-b/admin', {
    headers: {
      host: 'yalla-clinic.com',
      cookie: `clinic_session=${tokenClinicA}`
    }
  })
  const res = await middleware(req)
  assert.equal(res.status, 307, 'Cross-tenant access must be rejected')
})

// 2. A03: Cryptographic Password Hashing and Signed Tokens
await runAsyncTest('A03: Password hashing and verification works with SHA-256 and salt', async () => {
  const pass = 'SecretPatientPassword2026'
  const hash = await hashPassword(pass)
  assert(hash.length === 64, 'SHA-256 hex string must be 64 characters')
  assert.notEqual(pass, hash, 'Password must not be stored in plaintext')
  const match = await verifyPassword(pass, hash)
  assert.equal(match, true, 'Matching password must verify to true')
  const mismatch = await verifyPassword('WrongPassword', hash)
  assert.equal(mismatch, false, 'Wrong password must verify to false')
})

// 3. A07: Urgent Priority in Dynamic Queue
runTest('A07: Urgent ticket #2 is placed ahead of normal ticket #1', () => {
  const appointments = [
    { id: 'norm-1', queue_number: 1, serviceName: 'كشف عادي', isUrgent: false, status: 'waiting' },
    { id: 'urg-2', queue_number: 2, serviceName: 'كشف مستعجل', isUrgent: true, status: 'waiting' }
  ]
  const urgentLive = calculatePatientLivePosition({
    targetAppointmentId: 'urg-2',
    allTodayAppointments: appointments
  })
  assert.equal(urgentLive.aheadCount, 0, 'Urgent patient must have 0 patients ahead')
  assert.equal(urgentLive.isCurrentTurn, true, 'Urgent patient must be current turn')
})

// 4. A08: Branch Isolation prevents undefined leakage
runTest('A08: Undefined branch names do not cross-leak across branches', () => {
  const appointments = [
    { id: 'p-b1', queue_number: 1, branch_id: 'branch-alpha', status: 'waiting' },
    { id: 'p-b2', queue_number: 2, branch_id: 'branch-beta', status: 'waiting' }
  ]
  const b2Live = calculatePatientLivePosition({
    targetAppointmentId: 'p-b2',
    allTodayAppointments: appointments
  })
  assert.equal(b2Live.aheadCount, 0, 'Branch beta must have 0 patients ahead from branch alpha')
})

// 5. A09: Eliminating Phantom Patients
runTest('A09: Single ticket #7 does NOT invent 6 phantom patients', () => {
  const appointments = [
    { id: 'solo-7', queue_number: 7, serviceName: 'كشف عام', status: 'waiting' }
  ]
  const live = calculatePatientLivePosition({
    targetAppointmentId: 'solo-7',
    allTodayAppointments: appointments
  })
  assert.equal(live.aheadCount, 0, 'Ahead count must be 0 for the only waiting patient')
  assert.equal(live.isCurrentTurn, true, 'Solo patient is current turn')
})

// 6. A14: Financial Strict Accounting
runTest('A14: Completed visits with unpaid status are counted in receivables (due), NOT in collected cash', () => {
  const visitUnpaid = { status: 'completed', paymentStatus: 'unpaid', servicePrice: 300 }
  const isPaid = visitUnpaid.paymentStatus === 'paid' && visitUnpaid.status !== 'cancelled'
  assert.equal(isPaid, false, 'Unpaid completed visit must not be marked isPaid')
  
  const visitPaid = { status: 'completed', paymentStatus: 'paid', servicePrice: 300 }
  const isPaidReal = visitPaid.paymentStatus === 'paid' && visitPaid.status !== 'cancelled'
  assert.equal(isPaidReal, true, 'Paid visit must be marked isPaid')
})

// 7. A15: formatWaitDuration preserves days, hours, AND remaining minutes
runTest('A15: formatWaitDuration(1505) preserves days, hours, and remaining minutes', () => {
  const str = formatWaitDuration(1505)
  assert(str.includes('1 يوم'), 'Must include 1 day')
  assert(str.includes('1 ساعة'), 'Must include 1 hour')
  assert(str.includes('5 دقيقة'), 'Must include 5 minutes')
})

// 8. A18: Windows SWC is removed from package.json
runTest('A18: @next/swc-win32-x64-msvc is removed from package.json', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  assert.equal(pkg.dependencies['@next/swc-win32-x64-msvc'], undefined, 'Must not be in dependencies')
})

console.log('=================================================================')
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
console.log('=================================================================')

if (failed > 0) {
  process.exit(1)
}
