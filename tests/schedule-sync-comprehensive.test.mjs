import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCairoNow,
  getCairoDateString,
  formatTime12H,
  parseTimeToMinutes,
  extractDayShifts,
  isDayReceptionEnded,
  evaluateDayAvailability,
  filterAvailableDays,
  findNearestAvailableDate,
  validateBookingAvailability,
  buildBookingCalendar
} from '../src/lib/bookingCapacity.ts';

test('1. Working day, weekly holiday, and exceptional closure (vacations list)', () => {
  const clinic = {
    weeklySchedule: [
      { id: 'sunday', isOpen: true, start: '09:00', end: '22:00' },
      { id: 'friday', isOpen: false, start: '09:00', end: '22:00' }
    ],
    vacations: ['2026-11-03'] // Tuesday exceptional holiday
  };

  // Normal working day (future Sunday)
  const sundayEval = evaluateDayAvailability({
    dateStr: '2026-11-08', // Sunday
    clinic,
    limit: 10,
    isRtl: true
  });
  assert.equal(sundayEval.status, 'available');
  assert.equal(sundayEval.isSelectable, true);

  // Weekly day off (Friday)
  const fridayEval = evaluateDayAvailability({
    dateStr: '2026-11-06', // Friday
    clinic,
    limit: 10,
    isRtl: true
  });
  assert.equal(fridayEval.status, 'holiday');
  assert.equal(fridayEval.isSelectable, false);
  assert.equal(fridayEval.statusLabel, 'إجازة');

  // Exceptional closure date (Tuesday 2026-11-03)
  const vacationEval = evaluateDayAvailability({
    dateStr: '2026-11-03',
    clinic,
    limit: 10,
    isRtl: true
  });
  assert.equal(vacationEval.status, 'holiday');
  assert.equal(vacationEval.isSelectable, false);
});

test('2. Booking for today: before opening, during operating hours, and after final closing time', () => {
  const shifts = [
    { start: '10:00', end: '16:00', startMinutes: 600, endMinutes: 960, isOvernight: false }
  ];

  // At 08:30 (before opening): reception has NOT ended, patient can book for today
  assert.equal(isDayReceptionEnded(shifts, 8 * 60 + 30), false);

  // At 14:00 (during working hours): reception has NOT ended
  assert.equal(isDayReceptionEnded(shifts, 14 * 60), false);

  // At 16:30 (after closing): reception HAS ended for today
  assert.equal(isDayReceptionEnded(shifts, 16 * 60 + 30), true);

  // Evaluate day availability for today after hours
  const mockNowEvening = new Date('2026-11-01T17:00:00.000Z'); // After 16:00 in Cairo
  const todayEndedEval = evaluateDayAvailability({
    dateStr: getCairoDateString(mockNowEvening),
    clinic: {
      weeklySchedule: [{ id: 'sunday', isOpen: true, start: '10:00', end: '16:00' }]
    },
    limit: 10,
    customNowDate: mockNowEvening
  });
  assert.equal(todayEndedEval.status, 'reception_ended');
  assert.equal(todayEndedEval.isSelectable, false);
  assert.equal(todayEndedEval.statusLabel, 'انتهى الحجز');
});

test('3. Day with two shifts and a break in between: break does NOT close the day', () => {
  const daySched = {
    id: 'sunday',
    isOpen: true,
    start: '09:00',
    end: '13:00',
    start2: '17:00',
    end2: '22:00'
  };

  const shifts = extractDayShifts(daySched);
  assert.equal(shifts.length, 2);
  assert.equal(shifts[0].start, '09:00');
  assert.equal(shifts[0].end, '13:00');
  assert.equal(shifts[1].start, '17:00');
  assert.equal(shifts[1].end, '22:00');

  // At 14:30 (during break between 13:00 and 17:00):
  // Shift 1 has ended, but Shift 2 (17:00 - 22:00) is upcoming!
  // Reception is NOT ended for the day!
  const breakMinutes = 14 * 60 + 30;
  assert.equal(isDayReceptionEnded(shifts, breakMinutes), false);

  // At 22:15 (after both shifts have ended):
  // Reception has ended
  const nightMinutes = 22 * 60 + 15;
  assert.equal(isDayReceptionEnded(shifts, nightMinutes), true);
});

test('4. Overnight shifts extending past midnight (e.g. 20:00 to 02:00)', () => {
  const daySched = {
    id: 'thursday',
    isOpen: true,
    start: '20:00',
    end: '02:00'
  };
  const shifts = extractDayShifts(daySched);
  assert.equal(shifts[0].isOvernight, true);

  // At 23:30 (late evening before midnight): active
  assert.equal(isDayReceptionEnded(shifts, 23 * 60 + 30), false);

  // At 01:15 (past midnight within operating session): active
  assert.equal(isDayReceptionEnded(shifts, 1 * 60 + 15), false);

  // At 02:30 (after overnight shift closed): ended
  assert.equal(isDayReceptionEnded(shifts, 2 * 60 + 30), true);
});

test('5. 12-Hour time formatting utility', () => {
  assert.equal(formatTime12H('09:00', true), '9:00 ص');
  assert.equal(formatTime12H('13:30', true), '1:30 م');
  assert.equal(formatTime12H('00:00', true), '12:00 ص');
  assert.equal(formatTime12H('12:00', true), '12:00 م');
  assert.equal(formatTime12H('22:15', false), '10:15 PM');
});

test('6. Server-side validation rejects past dates, holidays, ended hours, and full capacity', () => {
  const clinic = {
    weeklySchedule: [
      { id: 'sunday', isOpen: true, start: '10:00', end: '18:00' },
      { id: 'friday', isOpen: false, start: '10:00', end: '18:00' }
    ],
    vacations: ['2026-11-10'],
    maxDailyBookings: 1
  };

  // Rejection 1: Past date
  const pastRes = validateBookingAvailability({
    bookingDate: '2026-10-15',
    clinic,
    currentActiveBookings: 0
  });
  assert.equal(pastRes.isValid, false);
  assert.equal(pastRes.status, 'past');

  // Rejection 2: Friday day off
  const fridayRes = validateBookingAvailability({
    bookingDate: '2026-11-06', // Friday
    clinic,
    currentActiveBookings: 0
  });
  assert.equal(fridayRes.isValid, false);
  assert.equal(fridayRes.status, 'holiday');
  assert.ok(fridayRes.nextAvailableDate);

  // Rejection 3: Vacation date
  const vacRes = validateBookingAvailability({
    bookingDate: '2026-11-10',
    clinic,
    currentActiveBookings: 0
  });
  assert.equal(vacRes.isValid, false);
  assert.equal(vacRes.status, 'holiday');

  // Rejection 4: Full capacity
  const fullRes = validateBookingAvailability({
    bookingDate: '2026-11-08', // Sunday
    clinic,
    currentActiveBookings: 1 // limit is 1
  });
  assert.equal(fullRes.isValid, false);
  assert.equal(fullRes.status, 'full');
  assert.ok(fullRes.nextAvailableDate);

  // Acceptance: Valid date with capacity
  const validRes = validateBookingAvailability({
    bookingDate: '2026-11-08', // Sunday
    clinic,
    currentActiveBookings: 0
  });
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.status, 'available');
});

test('7. Calendar builder returns each day with its real status badge', () => {
  const clinic = {
    weeklySchedule: [
      { id: 'sunday', isOpen: true, start: '09:00', end: '22:00' },
      { id: 'monday', isOpen: false }, // Weekly day off
      { id: 'tuesday', isOpen: true, start: '09:00', end: '22:00' }
    ],
    maxDailyBookings: 2
  };
  const dailyCounts = {
    '2026-11-01': 2 // Sunday is full
  };

  const calendar = buildBookingCalendar({
    startDateStr: '2026-11-01',
    maxDaysToScan: 3,
    targetCount: 3,
    limit: clinic.maxDailyBookings,
    dailyCounts,
    clinic,
    isRtl: true
  });

  assert.equal(calendar.length, 3);
  // Day 1 (Sunday 2026-11-01): Full
  assert.equal(calendar[0].iso, '2026-11-01');
  assert.equal(calendar[0].status, 'full');
  assert.equal(calendar[0].statusLabel, 'مكتمل');
  assert.equal(calendar[0].isSelectable, false);

  // Day 2 (Monday 2026-11-02): Holiday
  assert.equal(calendar[1].iso, '2026-11-02');
  assert.equal(calendar[1].status, 'holiday');
  assert.equal(calendar[1].statusLabel, 'إجازة');
  assert.equal(calendar[1].isSelectable, false);

  // Day 3 (Tuesday 2026-11-03): Available
  assert.equal(calendar[2].iso, '2026-11-03');
  assert.equal(calendar[2].status, 'available');
  assert.equal(calendar[2].statusLabel, 'متاح');
  assert.equal(calendar[2].isSelectable, true);
});
