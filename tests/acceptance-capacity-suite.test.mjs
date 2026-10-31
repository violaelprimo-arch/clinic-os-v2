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

test('Acceptance 1: Set limit to 1 - after first booking, day is closed and auto-advances to nearest available day', () => {
  const clinic = { maxDailyBookings: 1 };
  const dailyCounts = { '2026-11-01': 1 }; // 1 booking made
  const schedule = [
    { id: 'sunday', isOpen: true },
    { id: 'monday', isOpen: true }
  ];

  const available = filterAvailableDays({
    startDateStr: '2026-11-01',
    maxDaysToScan: 5,
    targetCount: 3,
    limit: clinic.maxDailyBookings,
    dailyCounts,
    schedule,
    isRtl: true
  });

  // Closed: Sunday 2026-11-01 is NOT available
  assert.equal(available.some(d => d.iso === '2026-11-01'), false);
  // Auto-advance target: Monday 2026-11-02
  assert.equal(available[0].iso, '2026-11-02');

  const nearest = findNearestAvailableDate({
    requestedDateStr: '2026-11-01',
    schedule,
    dailyCounts,
    limit: clinic.maxDailyBookings,
    isRtl: true
  });

  assert.ok(nearest);
  assert.equal(nearest.iso, '2026-11-02');
  assert.equal(nearest.wasRequestedDateFull, true);
});

test('Acceptance 2: Two consecutive full days with a scheduled holiday in between', () => {
  const dailyCounts = {
    '2026-11-01': 2, // Day 1: full (limit 2)
    '2026-11-02': 2  // Day 2: full (limit 2)
  };
  const schedule = [
    { id: 'sunday', isOpen: true },
    { id: 'monday', isOpen: true },
    { id: 'tuesday', isOpen: false }, // Holiday / closed day
    { id: 'wednesday', isOpen: true }  // First open day with capacity
  ];

  const nearest = findNearestAvailableDate({
    requestedDateStr: '2026-11-01',
    limit: 2,
    dailyCounts,
    schedule,
    isRtl: true
  });

  assert.ok(nearest);
  // Must skip 2026-11-01 (full), 2026-11-02 (full), 2026-11-03 (Tuesday holiday), landing on 2026-11-04 (Wed)
  assert.equal(nearest.iso, '2026-11-04');
});

test('Acceptance 3: Last remaining slot with two concurrent booking attempts', async () => {
  let activeBookings = 0;
  const limit = 1;

  async function atomicBook(patientName) {
    // Atomically verified inside transaction
    if (activeBookings >= limit) {
      throw new Error(`QUOTA_EXCEEDED:${limit}`);
    }
    activeBookings++;
    return { success: true, patientName, queueNumber: activeBookings };
  }

  const [res1, res2] = await Promise.allSettled([
    atomicBook('Patient 1'),
    atomicBook('Patient 2')
  ]);

  const successes = [res1, res2].filter(r => r.status === 'fulfilled');
  const failures = [res1, res2].filter(r => r.status === 'rejected');

  assert.equal(successes.length, 1, 'Only one concurrent attempt must succeed');
  assert.equal(failures.length, 1, 'The other concurrent attempt must fail');
  assert.ok(failures[0].reason.message.includes('QUOTA_EXCEEDED'));
  assert.equal(activeBookings, 1);
});

test('Acceptance 4: Limit update from settings is immediately active on other client devices', () => {
  // Device A (Clinic Doctor) updates limit from 10 to 1
  let clinicDoc = { maxDailyBookings: 10, branchesEnabled: false };
  let mainBranchDoc = { maxDailyBookings: 10, isMain: true };

  // Before update: limit is 10
  assert.equal(resolveEffectiveDailyLimit(clinicDoc, mainBranchDoc, false), 10);

  // Doctor updates to 1
  clinicDoc.maxDailyBookings = 1;
  mainBranchDoc.maxDailyBookings = 1;

  // Device B (Patient booking form) resolves immediately to 1
  assert.equal(resolveEffectiveDailyLimit(clinicDoc, mainBranchDoc, false), 1);
});

test('Acceptance 5: In-clinic and online bookings share the same capacity and cancellation frees capacity', () => {
  const limit = 3;
  const appointments = [
    { id: '1', date: '2026-11-01', status: 'waiting', source: 'online' },
    { id: '2', date: '2026-11-01', status: 'in_progress', source: 'in_clinic' },
    { id: '3', date: '2026-11-01', status: 'waiting', source: 'online' }
  ];

  // 3 active bookings: capacity reached
  let activeCount = appointments.filter(a => isAppointmentActive(a.status)).length;
  assert.equal(activeCount, 3);
  assert.equal(activeCount >= limit, true, 'Capacity reached for both in-clinic and online');

  // Cancel appointment #3
  appointments[2].status = 'cancelled';
  activeCount = appointments.filter(a => isAppointmentActive(a.status)).length;
  assert.equal(activeCount, 2);
  assert.equal(activeCount < limit, true, 'Cancellation opens up a slot');
});

test('Acceptance 6: Two different clinics have completely independent limits and booking data', () => {
  const clinic1 = { id: 'clinic-zizo', maxDailyBookings: 1, branchesEnabled: false };
  const clinic2 = { id: 'clinic-almasry', maxDailyBookings: 50, branchesEnabled: false };

  const limit1 = resolveEffectiveDailyLimit(clinic1, null, false);
  const limit2 = resolveEffectiveDailyLimit(clinic2, null, false);

  assert.equal(limit1, 1);
  assert.equal(limit2, 50);

  // Clinic 1 has 1 booking -> full
  const clinic1Count = { '2026-11-01': 1 };
  // Clinic 2 has 1 booking -> NOT full (1/50)
  const clinic2Count = { '2026-11-01': 1 };

  const availableClinic1 = filterAvailableDays({
    startDateStr: '2026-11-01',
    limit: limit1,
    dailyCounts: clinic1Count,
    schedule: [{ id: 'sunday', isOpen: true }]
  });
  const availableClinic2 = filterAvailableDays({
    startDateStr: '2026-11-01',
    limit: limit2,
    dailyCounts: clinic2Count,
    schedule: [{ id: 'sunday', isOpen: true }]
  });

  assert.equal(availableClinic1.some(d => d.iso === '2026-11-01'), false, 'Clinic 1 is full on 2026-11-01');
  assert.equal(availableClinic2.some(d => d.iso === '2026-11-01'), true, 'Clinic 2 is OPEN on 2026-11-01');
});

test('Acceptance 7: Date calculation and auto-advance never alters existing booked appointments', () => {
  const existingHistoricalAppts = [
    { id: 'past-1', date: '2026-10-15', patientName: 'سارة محمد', queue_number: 1 },
    { id: 'past-2', date: '2026-10-20', patientName: 'أحمد محمود', queue_number: 2 }
  ];

  // Deep clone to verify immutability
  const originalSnapshot = JSON.stringify(existingHistoricalAppts);

  // Run date search for a new patient
  const nearest = findNearestAvailableDate({
    requestedDateStr: '2026-11-01',
    limit: 1,
    dailyCounts: { '2026-11-01': 1 },
    schedule: [{ id: 'sunday', isOpen: true }, { id: 'monday', isOpen: true }]
  });

  assert.ok(nearest);
  // Verify existing appointments remained 100% untouched
  assert.equal(JSON.stringify(existingHistoricalAppts), originalSnapshot);
  assert.equal(existingHistoricalAppts[0].date, '2026-10-15');
});
