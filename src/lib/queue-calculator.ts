/**
 * Queue Calculation Engine & Wait Time Estimation
 * Strictly deterministic calculation using Cairo Timezone (Africa/Cairo).
 */

export interface QueuePatient {
  id: string
  queue_number: number
  patientName?: string
  phone?: string
  servicePrice?: number
  serviceName?: string
  durationMinutes?: number
  isUrgent?: boolean
  fivePatientsAlertSent?: boolean
  status: 'waiting' | 'in_progress' | 'completed' | 'skipped' | 'no_show' | 'cancelled'
  startedAt?: string
  createdAt?: string
}

export interface WaitTimeEstimate {
  peopleAhead: number
  estimatedWaitMinutes: number
  estimatedEntranceTime: string // e.g. "08:15 م"
  isNext: boolean
}

/**
 * Format a timestamp into 12-hour Arabic time string (e.g. "٠٨:٣٠ م") in Cairo timezone.
 */
export function formatCairo12Hour(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date)
  } catch {
    return date.toLocaleTimeString()
  }
}

/**
 * Order waiting patients based on doctor's priority & interleaving ratio.
 * Urgent patients are prioritized according to regularPerUrgent ratio (or immediate next if ratio is 0).
 */
export function sortWaitingQueue(
  waiting: QueuePatient[],
  regularPerUrgent: number = 2,
  urgentPerRegular: number = 1
): QueuePatient[] {
  const regularQueue = waiting
    .filter(p => !p.isUrgent)
    .sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0))

  const urgentQueue = waiting
    .filter(p => p.isUrgent)
    .sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0))

  // If urgent ratio is 0 or doctor specified urgent priority 0: urgent comes immediately next
  if (regularPerUrgent <= 0) {
    return [...urgentQueue, ...regularQueue]
  }

  const ordered: QueuePatient[] = []
  let rIndex = 0
  let uIndex = 0

  while (rIndex < regularQueue.length || uIndex < urgentQueue.length) {
    for (let i = 0; i < regularPerUrgent && rIndex < regularQueue.length; i++) {
      ordered.push(regularQueue[rIndex++])
    }
    for (let i = 0; i < urgentPerRegular && uIndex < urgentQueue.length; i++) {
      ordered.push(urgentQueue[uIndex++])
    }
  }

  return ordered
}

/**
 * Calculate deterministic wait time and entrance estimation for a patient.
 */
export function calculateWaitTime(
  patientId: string,
  orderedWaitingList: QueuePatient[],
  currentPatient: QueuePatient | null,
  defaultServiceMinutes: number = 15
): WaitTimeEstimate {
  // If patient is currently in progress
  if (currentPatient && currentPatient.id === patientId) {
    return {
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
      estimatedEntranceTime: 'بالداخل الآن',
      isNext: false
    }
  }

  // Find position in ordered waiting list
  const patientIndex = orderedWaitingList.findIndex(p => p.id === patientId)
  if (patientIndex === -1) {
    return {
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
      estimatedEntranceTime: '—',
      isNext: false
    }
  }

  const peopleAhead = patientIndex

  // Remaining time of current patient in exam room
  let remainingCurrentMinutes = 0
  if (currentPatient) {
    const currentDuration = currentPatient.durationMinutes || defaultServiceMinutes
    if (currentPatient.startedAt) {
      const elapsedMs = Date.now() - new Date(currentPatient.startedAt).getTime()
      const elapsedMins = Math.floor(elapsedMs / 60000)
      remainingCurrentMinutes = Math.max(2, currentDuration - elapsedMins)
    } else {
      remainingCurrentMinutes = Math.floor(currentDuration / 2)
    }
  }

  // Sum duration of all patients ahead in waiting sequence
  let waitingAheadMinutes = 0
  for (let i = 0; i < patientIndex; i++) {
    const aheadPatient = orderedWaitingList[i]
    waitingAheadMinutes += aheadPatient.durationMinutes || defaultServiceMinutes
  }

  const totalWaitMinutes = remainingCurrentMinutes + waitingAheadMinutes

  const entranceDate = new Date(Date.now() + totalWaitMinutes * 60000)
  const estimatedEntranceTime = formatCairo12Hour(entranceDate)

  return {
    peopleAhead,
    estimatedWaitMinutes: totalWaitMinutes,
    estimatedEntranceTime,
    isNext: peopleAhead === 0
  }
}
