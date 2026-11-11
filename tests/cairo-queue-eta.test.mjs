import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cairoWallClockEpochMs, calculatePatientLivePosition,
} from '../src/lib/queueCalculations.ts'

test('a Cairo 5:15 PM visit is 3:15 PM UTC in winter', () => {
  assert.equal(
    cairoWallClockEpochMs('2026-11-11', 17 * 60 + 15),
    Date.parse('2026-11-11T15:15:00Z'),
  )
})

test('a Cairo 5:15 PM visit is 2:15 PM UTC during summer time', () => {
  assert.equal(
    cairoWallClockEpochMs('2026-06-15', 17 * 60 + 15),
    Date.parse('2026-06-15T14:15:00Z'),
  )
})

test('one waiting patient ahead means 51 minutes, not 2h51, at 4:24 PM Cairo', () => {
  const date = '2026-11-11'
  const first = {
    id: 'first', clinic_id: 'clinic-1', branch_id: 'branch-1',
    date, queue_number: 1, status: 'waiting',
    serviceId: 'general', serviceName: 'كشف عام',
  }
  const second = {
    ...first, id: 'second', queue_number: 2,
  }
  const result = calculatePatientLivePosition({
    targetAppointmentId: second.id,
    targetAppointment: second,
    allTodayAppointments: [first, second],
    clinic: { averageVisitTime: 15 },
    branch: { id: 'branch-1', averageVisitTime: 15 },
    customNowDate: new Date('2026-11-11T14:24:00Z'),
    isRtl: true,
  })
  assert.equal(result.aheadCount, 1)
  assert.equal(result.estimatedEntranceTime12H, '5:15 م')
  assert.equal(result.estimatedWaitMins, 51)
  assert.equal(result.remainingTotalMinutes, 51)
})
