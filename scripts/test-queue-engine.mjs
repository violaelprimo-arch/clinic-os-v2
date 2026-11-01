import assert from 'assert';
import {
  simulateQueueTimeline,
  calculatePatientLivePosition,
  formatMinutesTo12H,
  formatWaitDuration
} from '../src/lib/queueCalculations.ts';

console.log('=== RUNNING CLINICAL QUEUE & APPOINTMENT ENGINE TESTS ===');

// 1. Mandatory Before-Opening Test:
// Current time 10:00 AM, Clinic opens at 17:00 (5:00 PM), 3 patients ahead (15 mins each)
// Expected entrance: 17:00 + (3 * 15m) = 17:45 (5:45 PM) - NOT 10:45 AM!
{
  const customNow = new Date('2026-11-01T08:00:00Z'); // 10:00 AM Cairo (UTC+2)
  const clinic = {
    averageVisitTime: 15,
    weeklySchedule: [
      {
        day: 'sunday',
        isOpen: true,
        shifts: [
          { start: '17:00', end: '22:00' }
        ]
      }
    ]
  };

  const allAppts = [
    { id: 'p1', queue_number: 1, status: 'waiting', date: '2026-11-01' },
    { id: 'p2', queue_number: 2, status: 'waiting', date: '2026-11-01' },
    { id: 'p3', queue_number: 3, status: 'waiting', date: '2026-11-01' },
    { id: 'my-appt', queue_number: 4, status: 'waiting', date: '2026-11-01' }
  ];

  const res = calculatePatientLivePosition({
    targetAppointmentId: 'my-appt',
    allTodayAppointments: allAppts,
    clinic,
    customNowDate: customNow,
    isRtl: true
  });

  console.log('Test 1 (Before clinic opens today):');
  console.log('  aheadCount:', res.aheadCount);
  console.log('  effectivePosition:', res.effectivePosition);
  console.log('  estimatedEntranceTime12H:', res.estimatedEntranceTime12H);
  console.log('  isCurrentTurn:', res.isCurrentTurn);
  console.log('  isNextInLine:', res.isNextInLine);

  assert.strictEqual(res.aheadCount, 3, 'Should have exactly 3 patients ahead');
  assert.strictEqual(res.effectivePosition, 4, 'Effective position should be 4');
  assert.strictEqual(res.isCurrentTurn, false, 'Cannot be current turn before clinic opens');
  // 17:45 in Arabic 12-hour Cairo format is "05:45 م"
  assert.ok(
    res.estimatedEntranceTime12H.includes('05:45') || res.estimatedEntranceTime12H.includes('5:45'),
    `Expected 5:45 PM, got ${res.estimatedEntranceTime12H}`
  );
  assert.ok(
    res.estimatedEntranceTime12H.includes('م') || res.estimatedEntranceTime12H.toLowerCase().includes('pm'),
    `Expected PM (م), got ${res.estimatedEntranceTime12H}`
  );
  console.log('✓ PASS: Test 1 Before-opening anchor correctly calculates 5:45 PM (not 10:45 AM)');
}

// 2. Future Date Booking Test:
// Booking for tomorrow (2026-11-02), clinic opens at 17:00, 2 cases ahead (20 mins each)
// Expected entrance: 17:00 + (2 * 20m) = 17:40 (5:40 PM) tomorrow
// isCurrentTurn MUST be strictly false!
{
  const customNow = new Date('2026-11-01T10:00:00Z'); // Sunday 12:00 PM Cairo
  const clinic = {
    averageVisitTime: 20,
    weeklySchedule: [
      {
        day: 'monday',
        isOpen: true,
        shifts: [
          { start: '17:00', end: '22:00' }
        ]
      }
    ]
  };

  const res = calculatePatientLivePosition({
    targetAppointment: {
      id: 'future-appt',
      queue_number: 3,
      date: '2026-11-02',
      status: 'waiting'
    },
    allTodayAppointments: [
      { id: 'f1', queue_number: 1, status: 'waiting', date: '2026-11-02' },
      { id: 'f2', queue_number: 2, status: 'waiting', date: '2026-11-02' },
      { id: 'future-appt', queue_number: 3, status: 'waiting', date: '2026-11-02' }
    ],
    clinic,
    bookingDateStr: '2026-11-02',
    customNowDate: customNow,
    isRtl: true
  });

  console.log('\nTest 2 (Future Date Booking):');
  console.log('  status:', res.status);
  console.log('  aheadCount:', res.aheadCount);
  console.log('  estimatedEntranceTime12H:', res.estimatedEntranceTime12H);
  console.log('  isCurrentTurn:', res.isCurrentTurn);
  console.log('  formattedWaitTime:', res.formattedWaitTime);

  assert.strictEqual(res.isCurrentTurn, false, 'isCurrentTurn MUST be false for future bookings');
  assert.strictEqual(res.aheadCount, 2, 'Should have 2 cases ahead');
  assert.strictEqual(res.status, 'upcoming', 'Status should be upcoming');
  assert.ok(
    res.estimatedEntranceTime12H.includes('05:40') || res.estimatedEntranceTime12H.includes('5:40'),
    `Expected 5:40 PM, got ${res.estimatedEntranceTime12H}`
  );
  console.log('✓ PASS: Test 2 Future date correctly anchored to tomorrow shift start and isCurrentTurn = false');
}

// 3. Multi-Shift Break Test:
// Shift 1: 10:00 to 13:00. Shift 2: 17:00 to 22:00.
// Current time: 12:45. In progress patient has 10 mins remaining.
// Next patient (duration 20 mins) would finish at 13:15, crossing the 13:00 break boundary!
// Timeline rolls over into Shift 2: 17:00 start!
{
  const customNow = new Date('2026-11-01T10:45:00Z'); // 12:45 PM Cairo
  const clinic = {
    averageVisitTime: 20,
    weeklySchedule: [
      {
        day: 'sunday',
        isOpen: true,
        shifts: [
          { start: '10:00', end: '13:00' },
          { start: '17:00', end: '22:00' }
        ]
      }
    ]
  };

  const allAppts = [
    { id: 'inp', queue_number: 1, status: 'in_progress', date: '2026-11-01', startedAt: '2026-11-01T10:35:00Z' }, // 10 mins elapsed of 20 => 10 left -> ends 12:55
    { id: 'p2', queue_number: 2, status: 'waiting', date: '2026-11-01' }, // starts 12:55, duration 20 => ends 13:15 (past 13:00) => moves to 17:00
    { id: 'my-appt', queue_number: 3, status: 'waiting', date: '2026-11-01' } // starts after p2
  ];

  const res = calculatePatientLivePosition({
    targetAppointmentId: 'my-appt',
    allTodayAppointments: allAppts,
    clinic,
    customNowDate: customNow,
    isRtl: true
  });

  console.log('\nTest 3 (Shift Break Rollover):');
  console.log('  estimatedEntranceTime12H:', res.estimatedEntranceTime12H);
  console.log('  aheadCount:', res.aheadCount);

  // Must roll over into evening shift (after 17:00 / 5:00 PM)
  assert.ok(
    res.estimatedEntranceTime12H.includes('05:') || res.estimatedEntranceTime12H.includes('5:'),
    `Expected rollover into evening shift at ~5:20 PM, got ${res.estimatedEntranceTime12H}`
  );
  console.log('✓ PASS: Test 3 Break rollover correctly pushes schedule into evening shift');
}

// 4. Doctor Delay / Pause Test:
{
  const customNow = new Date('2026-11-01T08:00:00Z');
  const clinic = {
    isPaused: true,
    weeklySchedule: [{ day: 'sunday', isOpen: true, shifts: [{ start: '17:00', end: '22:00' }] }]
  };

  const res = calculatePatientLivePosition({
    targetAppointmentId: 'p1',
    allTodayAppointments: [{ id: 'p1', queue_number: 1, status: 'waiting', date: '2026-11-01' }],
    clinic,
    customNowDate: customNow
  });

  console.log('\nTest 4 (Doctor Pause / Delayed):');
  console.log('  isEstimateConfirmed:', res.isEstimateConfirmed);
  console.log('  estimatedEntranceTime12H:', res.estimatedEntranceTime12H);

  assert.strictEqual(res.isEstimateConfirmed, false, 'Estimate must not be confirmed when clinic is paused');
  console.log('✓ PASS: Test 4 Unconfirmed flag set when clinic paused');
}

console.log('\nALL CLINICAL QUEUE TESTS PASSED SUCCESSFULLY! ✓');
