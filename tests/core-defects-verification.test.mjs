import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_WEEKLY_SCHEDULE,
  checkScheduleConflicts,
  formatWeeklyScheduleSummary,
  calculateHaversineDistanceKm
} from '../src/lib/branchService.ts'
import {
  extractCoordsFromLink,
  sanitizeAddress,
  isPlaceholderAddress
} from '../src/lib/mapsHelper.ts'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken
} from '../src/lib/auth-crypto.ts'
import {
  getClinicWebsiteUrl,
  getClinicTrackUrl,
  getClinicPatientPortalUrl
} from '../src/lib/clinicUrls.ts'

test('1. Branch Schedule Conflicts & Working Hours', () => {
  const branchA = {
    id: 'b1',
    name: 'فرع المعادي',
    isOpen: true,
    weeklySchedule: [
      { id: 'saturday', day: 'السبت', isOpen: true, start: '10:00', end: '14:00' },
      { id: 'sunday', day: 'الأحد', isOpen: true, start: '10:00', end: '14:00' },
      { id: 'friday', day: 'الجمعة', isOpen: false, start: '10:00', end: '14:00' }
    ]
  }

  const conflictingCandidate = {
    id: 'b2',
    name: 'فرع التجمع',
    isOpen: true,
    weeklySchedule: [
      { id: 'saturday', day: 'السبت', isOpen: true, start: '12:00', end: '16:00' } // overlaps 12:00 - 14:00
    ]
  }

  const conflicts = checkScheduleConflicts([branchA], conflictingCandidate)
  assert.ok(conflicts.length > 0, 'Should detect overlapping doctor hours between branches')
  assert.ok(conflicts[0].includes('السبت'), 'Should mention Saturday in conflict message')
})

test('2. Maps URL Extraction & Placeholder Address Sanitization', () => {
  // Direct lat/lng URL
  const coords1 = extractCoordsFromLink('https://www.google.com/maps?q=30.0444,31.2357')
  assert.ok(coords1 !== null)
  assert.equal(Math.round(coords1.lat * 100) / 100, 30.04)
  assert.equal(Math.round(coords1.lng * 100) / 100, 31.24)

  // Clean address from placeholders like عندها
  const dirty = 'شارع التسعين الشمالي عندها مبنى المعادي'
  const cleaned = sanitizeAddress(dirty)
  assert.ok(!cleaned.includes('عندها'))
  assert.equal(isPlaceholderAddress('عندها'), true)
  assert.equal(isPlaceholderAddress('الفرع الرئيسي'), true)
  assert.equal(isPlaceholderAddress('مقر العيادة'), true)
  assert.equal(isPlaceholderAddress('شارع التسعين الشمالي - مبنى 45'), false)
})

test('3. Settings Decoupling & Password Hash Verification', async () => {
  const rawSecret = 'SecurePassword123'
  const hash = await hashPassword(rawSecret)

  // Correct verification
  const isValid = await verifyPassword(rawSecret, hash)
  assert.equal(isValid, true)

  // Incorrect verification
  const isInvalid = await verifyPassword('WrongPassword', hash)
  assert.equal(isInvalid, false)

  // Session Token Creation & Verification
  const token = await createSessionToken({
    role: 'doctor',
    name: 'د. أحمد محمود',
    clinicId: 'clinic_test_123',
    slug: 'yalla-demo',
    mustChangePassword: false
  })

  const verified = await verifySessionToken(token)
  assert.equal(verified.valid, true)
  assert.equal(verified.payload?.clinicId, 'clinic_test_123')
  assert.equal(verified.payload?.mustChangePassword, false)
})

test('4. Clinic Canonical URL Builders & Routing Isolation', () => {
  const website = getClinicWebsiteUrl('yalla-demo', { canonical: true })
  assert.equal(website, 'https://yalla-demo.yalla-clinic.com/')

  const track = getClinicTrackUrl('yalla-demo', '01012345678', { canonical: true })
  assert.equal(track, 'https://yalla-demo.yalla-clinic.com/track?phone=01012345678')

  const portal = getClinicPatientPortalUrl('yalla-demo', { canonical: true })
  assert.equal(portal, 'https://yalla-demo.yalla-clinic.com/patient')
})

test('5. Weekly Schedule Cairo Timezone Day Boundaries', () => {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const nowCairoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
  assert.match(nowCairoStr, /^\d{4}-\d{2}-\d{2}$/)

  const schedule = DEFAULT_WEEKLY_SCHEDULE
  const friday = schedule.find((s) => s.id === 'friday')
  assert.equal(friday?.isOpen, false, 'Friday is closed by default in clinic schedule')
})
