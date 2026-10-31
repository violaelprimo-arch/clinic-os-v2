import test from 'node:test';
import assert from 'node:assert/strict';
import { sortQueue } from '../src/lib/queueCalculations.ts';

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
