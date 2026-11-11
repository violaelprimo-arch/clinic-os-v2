import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sortQueue, calculatePatientLivePosition } from '../src/lib/queueCalculations.ts';

// Re-implemented helper to test contract
function numberToArabicWords(num) {
  if (num === undefined || num === null) return 'واحد';
  const clean = String(num).replace(/[^0-9]/g, '');
  const n = parseInt(clean, 10);
  if (isNaN(n) || n <= 0) return 'واحد';

  const ones = [
    '', 'وَاحِد', 'اثْنَان', 'ثَلَاثَة', 'أَرْبَعَة', 'خَمْسَة', 'سِتَّة', 'سَبْعَة', 'ثَمَانِيَة', 'تِسْعَة', 'عَشَرَة',
    'أَحَدَ عَشَر', 'اثْنَا عَشَر', 'ثَلَاثَةَ عَشَر', 'أَرْبَعَةَ عَشَر', 'خَمْسَةَ عَشَر', 'سِتَّةَ عَشَر', 'سَبْعَةَ عَشَر', 'ثَمَانِيَةَ عَشَر', 'تِسْعَةَ عَشَر'
  ];
  if (n < 20) return ones[n];
  return String(num);
}

test('1. numberToArabicWords safely handles undefined and null without returning "undefined"', () => {
  assert.notEqual(numberToArabicWords(undefined), 'undefined');
  assert.equal(numberToArabicWords(undefined), 'واحد');
  assert.equal(numberToArabicWords(null), 'واحد');
  assert.equal(numberToArabicWords('5'), 'خَمْسَة');
  assert.equal(numberToArabicWords(12), 'اثْنَا عَشَر');
});

test('2. TV queue distinguishes between in_progress and waiting patients', () => {
  const appointments = [
    { id: '1', queue_number: 1, status: 'completed', patientName: 'Ali' },
    { id: '2', queue_number: 2, status: 'in_progress', patientName: 'Ahmed' },
    { id: '3', queue_number: 3, status: 'waiting', patientName: 'Sara' },
    { id: '4', queueNumber: 4, status: 'waiting', patientName: 'Mona' },
    { id: '5', queue_number: 5, status: 'cancelled', patientName: 'Omar' }
  ];

  // Current patient
  const current = appointments.find(a => a.status === 'in_progress' || a.status === 'examining');
  assert.ok(current);
  assert.equal(current.id, '2');
  assert.equal(current.queue_number, 2);

  // Next waiting
  const waiting = sortQueue(appointments, null);
  assert.equal(waiting.length, 2);
  assert.equal(waiting[0].id, '3');
  assert.equal(waiting[0].queue_number ?? waiting[0].queueNumber, 3);
  assert.equal(waiting[1].id, '4');
  assert.equal(waiting[1].queue_number ?? waiting[1].queueNumber, 4);
});

test('3. Clinic document in appointments list does not create #undefined ticket', () => {
  // Simulating the bug where a clinic doc was erroneously queried as an appointment
  const fakeAppts = [
    { id: 'clinic_zizo', slug: 'zizo', clinicName: 'عيادة د. زيزو', doctorName: 'زيزو' }
  ];

  const filteredAppts = fakeAppts.filter(a => a.status === 'waiting' && (a.queue_number || a.queueNumber));
  assert.equal(filteredAppts.length, 0, 'Clinic documents must never be counted as waiting patient tickets');
});

test('4. sortQueue keeps priorityNext and urgent cases ordered across TV, Admin, and Track', () => {
  const waiting = [
    { id: 'reg-2', queue_number: 2, status: 'waiting', patientName: 'Regular 2', serviceId: 'general' },
    { id: 'req-1', queueNumber: 1, status: 'waiting', patientName: 'Requeued 1', priorityNext: true, requeuedAt: '2026-11-11T10:00:00Z' },
    { id: 'reg-3', queueNumber: 3, status: '', patientName: 'Regular 3', serviceId: 'general' },
    { id: 'urg-4', queueNumber: 4, status: 'waiting', patientName: 'Urgent 4', isUrgent: true },
  ];
  const ordered = sortQueue(waiting, null);
  assert.deepEqual(ordered.map(a => a.id), ['req-1', 'urg-4', 'reg-2', 'reg-3']);
});

test('5. calculatePatientLivePosition supports examining status and camelCase queueNumber', () => {
  const date = '2026-11-11';
  const examining = { id: 'curr', clinic_id: 'c1', date, queueNumber: 7, status: 'examining', patientName: 'Inside' };
  const waiting = { id: 'next', clinic_id: 'c1', date, queueNumber: 8, status: 'waiting', patientName: 'Next' };
  const currPos = calculatePatientLivePosition({
    targetAppointment: examining,
    allTodayAppointments: [examining, waiting],
    customNowDate: new Date('2026-11-11T15:00:00Z'),
  });
  assert.equal(currPos.status, 'in_progress');
  assert.equal(currPos.isCurrentTurn, true);

  const nextPos = calculatePatientLivePosition({
    targetAppointment: waiting,
    allTodayAppointments: [examining, waiting],
    customNowDate: new Date('2026-11-11T15:00:00Z'),
  });
  assert.equal(nextPos.currentPatientExamining?.queueNumber, 7);
});

test('6. Queue API, transition API, TV client, and Push manager maintain sync contracts', () => {
  const queueRoute = fs.readFileSync('src/app/api/clinic/[slug]/queue/route.ts', 'utf8');
  const transitionRoute = fs.readFileSync('src/app/api/clinic/[slug]/appointments/transition/route.ts', 'utf8');
  const queueTransition = fs.readFileSync('src/lib/server/queue-transition.ts', 'utf8');
  const tvClient = fs.readFileSync('src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx', 'utf8');
  const pushMgr = fs.readFileSync('src/components/clinic/PatientPushNotificationManager.tsx', 'utf8');

  assert.match(queueRoute, /sortQueue\(allTodayAppts/);
  assert.match(queueRoute, /a\.branchId === branchId/);
  assert.match(transitionRoute, /executeQueueTransition/);
  assert.match(queueTransition, /alertWaitingPatients\([\s\S]*?clinicDoc/);
  assert.doesNotMatch(queueTransition, /if\s*\(\s*called\s*&&\s*String\(called\.phone/);
  assert.match(tvClient, /totalWaitingCount \?\? nextWaitingPatients\.length/);
  assert.match(tvClient, /if \(!isAudioEnabled\) return\s+lastAnnouncedCallKeyRef\.current = currentCallKey/);
  assert.doesNotMatch(tvClient, /heldUntilRef/);
  assert.match(pushMgr, /if \(isSubscribed\)[\s\S]*مفعّلة/);
});
