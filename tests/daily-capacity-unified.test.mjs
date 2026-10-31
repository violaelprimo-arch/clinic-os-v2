import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCairoDateString,
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  findNearestAvailableDate,
  filterAvailableDays
} from '../src/lib/bookingCapacity.ts'

test('Booking Capacity Unified Logic', async (t) => {
  await t.test('1. Cairo timezone formatting produces YYYY-MM-DD', () => {
    const todayCairo = getCairoDateString()
    assert.match(todayCairo, /^\d{4}-\d{2}-\d{2}$/)
  })

  await t.test('2. Effective limit resolution prioritizes clinic settings when single branch', () => {
    // Scenario from user: Clinic setting set to 1, but branch had legacy 49
    const clinic = { maxDailyBookings: 1, branchesEnabled: false }
    const branch = { id: 'main', isMain: true, maxDailyBookings: 49 }

    const effective = resolveEffectiveDailyLimit(clinic, branch, false)
    assert.equal(effective, 1, 'Clinic setting of 1 must take precedence over legacy branch 49')
  })

  await t.test('3. Effective limit resolution with multiple active branches', () => {
    const clinic = { maxDailyBookings: 20, branchesEnabled: true }
    const branchA = { id: 'branch-a', isMain: false, maxDailyBookings: 5 }
    const branchB = { id: 'branch-b', isMain: false, maxDailyBookings: 0 }

    const effectiveA = resolveEffectiveDailyLimit(clinic, branchA, true)
    assert.equal(effectiveA, 5, 'Sub-branch with custom limit of 5 must use 5')

    const effectiveB = resolveEffectiveDailyLimit(clinic, branchB, true)
    assert.equal(effectiveB, 20, 'Sub-branch with 0 must inherit clinic limit of 20')
  })

  await t.test('4. Active appointments count includes waiting, in_progress, completed, and excludes cancelled', () => {
    assert.equal(isAppointmentActive('waiting'), true)
    assert.equal(isAppointmentActive('in_progress'), true)
    assert.equal(isAppointmentActive('completed'), true)
    assert.equal(isAppointmentActive(null), true)
    assert.equal(isAppointmentActive('cancelled'), false)
  })

  await t.test('5. Day closes completely when active bookings reach limit (e.g. limit=1)', () => {
    const limit = 1
    const counts = { '2026-10-31': 1, '2026-11-01': 0 }

    const schedule = [
      { id: 'saturday', isOpen: true },
      { id: 'sunday', isOpen: true }
    ]

    const days = filterAvailableDays({
      startDateStr: '2026-10-31',
      maxDaysToScan: 7,
      limit,
      dailyCounts: counts,
      schedule
    })

    // 2026-10-31 is full (1/1), so it MUST NOT be in available days
    assert.equal(days.some(d => d.iso === '2026-10-31'), false)
    // 2026-11-01 has 0/1, so it is available
    assert.equal(days[0].iso, '2026-11-01')
  })

  await t.test('6. Nearest available day skips full days and scheduled holidays', () => {
    const limit = 2
    // Suppose Day 0 is full (2/2), Day 1 is full (2/2), Day 2 is closed (holiday), Day 3 is open (0/2)
    const counts = {
      '2026-11-01': 2,
      '2026-11-02': 2,
      '2026-11-03': 0, // closed in schedule
      '2026-11-04': 0  // open and has capacity
    }

    const schedule = [
      { id: 'sunday', isOpen: true },    // 2026-11-01 (Full)
      { id: 'monday', isOpen: true },    // 2026-11-02 (Full)
      { id: 'tuesday', isOpen: false },  // 2026-11-03 (Closed holiday)
      { id: 'wednesday', isOpen: true }  // 2026-11-04 (Open, has capacity)
    ]

    const nearest = findNearestAvailableDate({
      requestedDateStr: '2026-11-01',
      limit,
      dailyCounts: counts,
      schedule,
      maxDaysToScan: 14
    })

    assert.equal(nearest.nearestDateStr, '2026-11-04')
    assert.equal(nearest.wasRequestedDateFull, true)
  })

  await t.test('7. Empty available days when entire horizon is full', () => {
    const limit = 1
    const counts = {
      '2026-11-01': 1,
      '2026-11-02': 1
    }
    const schedule = [
      { id: 'sunday', isOpen: true },
      { id: 'monday', isOpen: true }
    ]

    const days = filterAvailableDays({
      startDateStr: '2026-11-01',
      maxDaysToScan: 2,
      limit,
      dailyCounts: counts,
      schedule
    })

    assert.equal(days.length, 0, 'Must return 0 available days when horizon is full')
  })
})
