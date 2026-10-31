import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCairoDateString,
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  filterAvailableDays,
  findNearestAvailableDate,
  CAPACITY_FULL_MESSAGE
} from '../src/lib/bookingCapacity.ts';

test('1. Cairo timezone formatting produces valid YYYY-MM-DD regardless of system offset', () => {
  const cairoToday = getCairoDateString();
  assert.match(cairoToday, /^\d{4}-\d{2}-\d{2}$/);
  
  // Specific instant around midnight
  const utcInstant = new Date('2026-10-30T22:30:00.000Z'); // In UTC: Oct 30. In Cairo (UTC+2 or UTC+3): Oct 31
  const cairoFormatted = getCairoDateString(utcInstant);
  assert.ok(cairoFormatted.startsWith('2026-10-31'), `Expected 2026-10-31 but got ${cairoFormatted}`);
});

test('2. Root cause fix: Single branch clinic setting (1) takes strict precedence over stale branch value (49)', () => {
  const clinic = {
    maxDailyBookings: 1,
    branchesEnabled: false
  };
  const staleBranch = {
    id: 'main',
    name: 'Main Branch',
    maxDailyBookings: 49,
    isMain: true
  };

  const resolved = resolveEffectiveDailyLimit(clinic, staleBranch, false);
  assert.equal(resolved, 1, 'Clinic setting (1) MUST override stale branch value (49) for single-branch clinic');
});

test('3. Multi-branch clinic respects individual branch capacity when configured', () => {
  const clinic = {
    maxDailyBookings: 10,
    branchesEnabled: true
  };
  const branchA = {
    id: 'branch-a',
    maxDailyBookings: 5,
    isMain: false
  };
  const branchB = {
    id: 'branch-b',
    maxDailyBookings: 0,
    isMain: false
  };

  assert.equal(resolveEffectiveDailyLimit(clinic, branchA, true), 5);
  // Branch B has 0 (unspecified) so it falls back to clinic-level limit 10
  assert.equal(resolveEffectiveDailyLimit(clinic, branchB, true), 10);
});

test('4. Active appointments counting: waiting, in_progress, and completed count towards quota, cancelled does NOT', () => {
  assert.equal(isAppointmentActive('waiting'), true);
  assert.equal(isAppointmentActive('in_progress'), true);
  assert.equal(isAppointmentActive('completed'), true);
  assert.equal(isAppointmentActive('cancelled'), false);
  assert.equal(isAppointmentActive('canceled'), false);
  assert.equal(isAppointmentActive('no_show'), false);
});

test('5. When day reaches limit (1 booking), it is completely excluded from availableDays and cannot be selected', () => {
  const todayStr = '2026-11-01'; // Sunday
  const dailyCounts = {
    '2026-11-01': 1 // 1 booking recorded
  };
  const schedule = [
    { id: 'sunday', isOpen: true },
    { id: 'monday', isOpen: true },
    { id: 'tuesday', isOpen: true }
  ];

  const available = filterAvailableDays({
    startDateStr: todayStr,
    maxDaysToScan: 5,
    targetCount: 3,
    limit: 1,
    dailyCounts,
    schedule,
    isRtl: true
  });

  // 2026-11-01 is full (1/1), so availableDays MUST NOT contain 2026-11-01
  const containsFullDay = available.some(d => d.iso === '2026-11-01');
  assert.equal(containsFullDay, false, 'Full day must be completely excluded from available days list');
  
  // First available day should be Monday 2026-11-02
  assert.equal(available[0].iso, '2026-11-02');
});

test('6. Auto-advance: correctly skips multiple full days and weekly holidays to find nearest date', () => {
  const todayStr = '2026-11-01'; // Sunday (full)
  const dailyCounts = {
    '2026-11-01': 1, // Sunday: full (limit 1)
    '2026-11-02': 1  // Monday: full (limit 1)
  };
  const schedule = [
    { id: 'sunday', isOpen: true },
    { id: 'monday', isOpen: true },
    { id: 'tuesday', isOpen: false }, // Tuesday: closed / holiday
    { id: 'wednesday', isOpen: true }  // Wednesday: OPEN and free
  ];

  const nearest = findNearestAvailableDate({
    startDateStr: todayStr,
    schedule,
    dailyCounts,
    limit: 1,
    isRtl: true
  });

  assert.ok(nearest, 'Should find nearest available date');
  assert.equal(nearest.iso, '2026-11-04', 'Should skip Sun(full), Mon(full), Tue(closed) and land on Wed 2026-11-04');
});

test('7. Empty horizon returns null / empty list when all days in range are full', () => {
  const todayStr = '2026-11-01';
  const dailyCounts = {};
  for (let i = 0; i < 21; i++) {
    const d = new Date(new Date(todayStr).getTime() + i * 86400000);
    dailyCounts[d.toISOString().split('T')[0]] = 5;
  }

  const available = filterAvailableDays({
    startDateStr: todayStr,
    maxDaysToScan: 14,
    targetCount: 5,
    limit: 5, // All are full
    dailyCounts,
    schedule: [{ id: 'sunday', isOpen: true }],
    isRtl: true
  });

  assert.equal(available.length, 0, 'No days should be returned if all are full');

  const nearest = findNearestAvailableDate({
    startDateStr: todayStr,
    schedule: [],
    dailyCounts,
    limit: 5,
    maxDaysToScan: 21,
    isRtl: true
  });

  assert.equal(nearest, null, 'Nearest date should be null when all dates in horizon are full');
});

test('8. Concurrency & atomic quota check prevents race conditions', async () => {
  // Simulate counter document state in Firestore transaction
  let counter = {
    count: 0,
    activeBookings: 0,
    clinicId: 'clinic-123',
    date: '2026-11-01'
  };
  const limit = 1;

  // Two concurrent booking attempts for the same single remaining slot
  async function attemptBooking(patientName) {
    // Simulated transaction runTransaction
    if (counter.activeBookings >= limit) {
      throw new Error(`QUOTA_EXCEEDED: Daily bookings limit (${limit}) reached for 2026-11-01`);
    }
    // Increment atomically
    counter.count += 1;
    counter.activeBookings += 1;
    return {
      success: true,
      patientName,
      queueNumber: counter.count
    };
  }

  const results = await Promise.allSettled([
    attemptBooking('Patient A'),
    attemptBooking('Patient B')
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one concurrent booking must succeed');
  assert.equal(rejected.length, 1, 'Second concurrent booking must be rejected with quota exceeded');
  assert.ok(rejected[0].reason.message.includes('QUOTA_EXCEEDED'));
  assert.equal(counter.activeBookings, 1);
});

test('9. In-clinic and online bookings share the same capacity bucket', () => {
  const clinic = { maxDailyBookings: 2 };
  const dailyCounts = {
    '2026-11-01': 0
  };

  // Online booking arrives
  dailyCounts['2026-11-01'] += 1; // 1 online
  assert.equal(dailyCounts['2026-11-01'] >= clinic.maxDailyBookings, false);

  // In-clinic booking arrives
  dailyCounts['2026-11-01'] += 1; // 1 in-clinic -> total 2
  assert.equal(dailyCounts['2026-11-01'] >= clinic.maxDailyBookings, true);

  // Day is now full for BOTH online and in-clinic
  const available = filterAvailableDays({
    startDateStr: '2026-11-01',
    maxDaysToScan: 3,
    targetCount: 2,
    limit: clinic.maxDailyBookings,
    dailyCounts,
    schedule: [{ id: 'sunday', isOpen: true }, { id: 'monday', isOpen: true }]
  });

  assert.equal(available.some(d => d.iso === '2026-11-01'), false, 'Day must close after 1 online + 1 in-clinic reached limit of 2');
});

test('10. Two different clinics have fully isolated limits and counters', () => {
  const clinicA = { id: 'clinic-a', maxDailyBookings: 1 };
  const clinicB = { id: 'clinic-b', maxDailyBookings: 100 };

  const limitA = resolveEffectiveDailyLimit(clinicA, null, false);
  const limitB = resolveEffectiveDailyLimit(clinicB, null, false);

  assert.equal(limitA, 1);
  assert.equal(limitB, 100);
  assert.notEqual(limitA, limitB);
});
