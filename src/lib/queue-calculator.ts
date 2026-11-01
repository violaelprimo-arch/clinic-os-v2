/**
 * Queue Calculator Wrapper & Bridge
 * Forwards and delegates all queue calculations, priority sorting,
 * and wait time estimation to the unified engine in queueCalculations.ts.
 *
 * Guarantees zero conflicting calculations across the platform.
 */

export * from './queueCalculations'

import {
  sortQueue,
  simulateQueueTimeline,
  formatCairo12Hour,
  QueuePatient,
} from './queueCalculations'

export interface WaitTimeEstimate {
  peopleAhead: number
  estimatedWaitMinutes: number
  estimatedEntranceTime: string // e.g. "08:15 م"
  isNext: boolean
}

/**
 * Legacy wrapper: Order waiting patients based on doctor's priority.
 */
export function sortWaitingQueue(
  waiting: QueuePatient[],
  regularPerUrgent: number = 2,
  urgentPerRegular: number = 1
): QueuePatient[] {
  // Use unified clinical queue sorting engine
  return sortQueue(waiting, {
    queueNormal: regularPerUrgent,
    queueUrgent: urgentPerRegular,
  })
}

/**
 * Legacy wrapper: Calculate wait time and entrance estimation for a patient.
 */
export function calculateWaitTime(
  patientId: string,
  orderedWaitingList: QueuePatient[],
  currentPatient: QueuePatient | null,
  defaultServiceMinutes: number = 15
): WaitTimeEstimate {
  const allAppts: any[] = [...orderedWaitingList]
  if (currentPatient && !allAppts.some((p) => p.id === currentPatient.id)) {
    allAppts.unshift(currentPatient)
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())

  const sim = simulateQueueTimeline({
    bookingDateStr: todayStr,
    targetAppointmentId: patientId,
    allDateAppointments: allAppts,
    clinic: { slotDuration: defaultServiceMinutes },
  })

  return {
    peopleAhead: sim.aheadCount,
    estimatedWaitMinutes: sim.remainingTotalMinutes,
    estimatedEntranceTime: sim.estimatedEntranceTime12H,
    isNext: sim.isNextInLine,
  }
}
