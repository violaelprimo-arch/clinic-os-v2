/**
 * Yalla Clinic - Intelligent Queue & Turn Calculation Engine
 * Strictly distinguishes between static ticket number (queue_number) and dynamic entry position (effective_queue_position).
 * Handles all edge cases: in_progress exams, skipped, no_show, completed, cancelled, and branch isolation.
 */

export interface QueuePatient {
  id: string
  queue_number: number
  patientName: string
  status?: 'waiting' | 'in_progress' | 'completed' | 'skipped' | 'no_show' | 'cancelled'
  isUrgent?: boolean
  serviceName?: string
  serviceId?: string | number
  branch_id?: string
  date?: string
  createdAt?: string
}

export function calculateWaitTime(aheadCount: number, averageServiceMins = 15): number {
  return Math.max(0, aheadCount * averageServiceMins)
}

export function formatEstimatedTime(minutesToAdd: number): string {
  const future = new Date(Date.now() + minutesToAdd * 60000)
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Cairo'
  }).format(future)
}

export function formatWaitDuration(mins: number, isCurrentTurn = false): string {
  if (isCurrentTurn) return 'دورك الآن'
  if (mins <= 0) return 'خلال دقائق معدودة'
  if (mins < 60) return `حوالي ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) {
    return `حوالي ${hours} ساعة و ${remMins} دقيقة`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return `حوالي ${days} يوم و ${remHours} ساعة`
}

export const isUrgentCase = (d: any): boolean =>
  Boolean(
    d?.isUrgent ||
    (d?.serviceName && (d.serviceName.includes('مستعجل') || d.serviceName.includes('طوارئ'))) ||
    String(d?.serviceId) === '3'
  )

export const isConsultCase = (d: any): boolean =>
  Boolean(
    !isUrgentCase(d) &&
    ((d?.serviceName && (d.serviceName.includes('استشارة') || d.serviceName.includes('متابعة'))) ||
      String(d?.serviceId) === '2' ||
      String(d?.serviceId) === '4')
  )

export const isNormalCase = (d: any): boolean => Boolean(!isUrgentCase(d) && !isConsultCase(d))

/**
 * Sorts active waiting appointments into deterministic entry order.
 * Follows doctor's triage ratio (Urgent, Normal, Consultation).
 */
export function sortQueue(appointments: any[], clinic?: any): any[] {
  // Only patients in 'waiting' state belong in the dynamic line
  const waiting = [...appointments]
    .filter((d: any) => d.status === 'waiting' || !d.status)
    .sort((a: any, b: any) => (Number(a.queue_number) || 0) - (Number(b.queue_number) || 0))

  const qUrgent = clinic?.queueUrgent !== undefined ? Number(clinic.queueUrgent) : 0
  const qNormal = clinic?.queueNormal !== undefined ? Number(clinic.queueNormal) : 3
  const qConsult = clinic?.queueConsult !== undefined ? Number(clinic.queueConsult) : 2

  const urgentQueue = waiting.filter(isUrgentCase)
  const normalQueue = waiting.filter(isNormalCase)
  const consultQueue = waiting.filter(isConsultCase)

  const orderedWaiting: any[] = []

  if (qUrgent === 0) {
    // 0 means: Urgent cases enter IMMEDIATELY before ANY other service
    orderedWaiting.push(...urgentQueue)

    let nIdx = 0, cIdx = 0
    while (nIdx < normalQueue.length || cIdx < consultQueue.length) {
      const prevN = nIdx, prevC = cIdx
      for (let i = 0; i < (qNormal || 1) && nIdx < normalQueue.length; i++) {
        orderedWaiting.push(normalQueue[nIdx++])
      }
      for (let i = 0; i < (qConsult || 1) && cIdx < consultQueue.length; i++) {
        orderedWaiting.push(consultQueue[cIdx++])
      }
      if (nIdx === prevN && cIdx === prevC) {
        while (nIdx < normalQueue.length) orderedWaiting.push(normalQueue[nIdx++])
        while (cIdx < consultQueue.length) orderedWaiting.push(consultQueue[cIdx++])
        break
      }
    }
  } else {
    // Round-robin cycle according to configured ratios
    let uIdx = 0, nIdx = 0, cIdx = 0
    while (uIdx < urgentQueue.length || nIdx < normalQueue.length || cIdx < consultQueue.length) {
      const prevU = uIdx, prevN = nIdx, prevC = cIdx
      for (let i = 0; i < (qUrgent || 1) && uIdx < urgentQueue.length; i++) {
        orderedWaiting.push(urgentQueue[uIdx++])
      }
      for (let i = 0; i < (qNormal || 1) && nIdx < normalQueue.length; i++) {
        orderedWaiting.push(normalQueue[nIdx++])
      }
      for (let i = 0; i < (qConsult || 1) && cIdx < consultQueue.length; i++) {
        orderedWaiting.push(consultQueue[cIdx++])
      }
      if (uIdx === prevU && nIdx === prevN && cIdx === prevC) {
        while (uIdx < urgentQueue.length) orderedWaiting.push(urgentQueue[uIdx++])
        while (nIdx < normalQueue.length) orderedWaiting.push(normalQueue[nIdx++])
        while (cIdx < consultQueue.length) orderedWaiting.push(consultQueue[cIdx++])
        break
      }
    }
  }

  return orderedWaiting
}

export interface PatientQueueStatusResult {
  status: 'in_progress' | 'waiting' | 'completed' | 'skipped' | 'no_show' | 'cancelled' | 'not_found'
  statusLabel: string
  isCurrentTurn: boolean
  isNextInLine: boolean
  aheadCount: number
  effectivePosition: number
  averageVisitMins: number
  estimatedWaitMins: number
  formattedWaitTime: string
  currentPatientExamining: {
    queueNumber?: number
    patientName?: string
  } | null
}

/**
 * TASK 2: Comprehensive Patient Queue Position Calculator
 * Completely eliminates the bug `const aheadCount = myIndex >= 0 ? myIndex : 0`.
 * Accurately determines if doctor is busy, if patient is next, or if it is legitimately their turn.
 */
export function calculatePatientLivePosition({
  targetAppointmentId,
  targetAppointment,
  allTodayAppointments,
  clinic
}: {
  targetAppointmentId: string
  targetAppointment: any
  allTodayAppointments: any[]
  clinic?: any
}): PatientQueueStatusResult {
  const avgMins = Number(clinic?.averageVisitTime) || Number(clinic?.average_consultation_time) || 15

  if (!targetAppointment) {
    return {
      status: 'not_found',
      statusLabel: 'غير مسجل',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: '—',
      currentPatientExamining: null
    }
  }

  // 1. Branch isolation: filter appointments by target's branch_id (if branch_id exists)
  const branchFilteredAppts = targetAppointment.branch_id
    ? allTodayAppointments.filter(a => !a.branch_id || a.branch_id === targetAppointment.branch_id || a.branchName === targetAppointment.branchName)
    : allTodayAppointments

  // 2. Identify currently examining patient in this branch
  const inProgressAppt = branchFilteredAppts.find(a => a.status === 'in_progress')
  const currentExamining = inProgressAppt
    ? {
        queueNumber: inProgressAppt.queue_number,
        patientName: inProgressAppt.patientName
      }
    : null

  // 3. Handle non-waiting explicit statuses
  const rawStatus = targetAppointment.status || 'waiting'

  if (rawStatus === 'completed') {
    return {
      status: 'completed',
      statusLabel: 'تم الكشف الطبي بنجاح',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: 'تم الانتهاء',
      currentPatientExamining: currentExamining
    }
  }

  if (rawStatus === 'in_progress') {
    return {
      status: 'in_progress',
      statusLabel: 'دورك الآن — تفضل بالدخول للطبيب',
      isCurrentTurn: true,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 1,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: 'دورك الآن',
      currentPatientExamining: currentExamining
    }
  }

  if (rawStatus === 'cancelled') {
    return {
      status: 'cancelled',
      statusLabel: 'تم إلغاء الحجز',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: 'ملغي',
      currentPatientExamining: currentExamining
    }
  }

  if (rawStatus === 'skipped' || rawStatus === 'no_show') {
    return {
      status: rawStatus,
      statusLabel: 'تم تخطي الموعد — يرجى مراجعة الاستقبال',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: 'مؤجل / تم التخطي',
      currentPatientExamining: currentExamining
    }
  }

  // 4. Patient is in 'waiting' status: Calculate dynamic position among active waiting list
  const orderedWaiting = sortQueue(branchFilteredAppts, clinic)
  const myIndex = orderedWaiting.findIndex(a => a.id === targetAppointmentId)

  // Doctor busy with someone else
  const doctorBusyWithOther = Boolean(inProgressAppt && inProgressAppt.id !== targetAppointmentId)

  // How many prior queue tickets exist and what is their status?
  const myQueueNum = Number(targetAppointment.queue_number) || 1
  const priorAppts = branchFilteredAppts.filter(a => a.id !== targetAppointmentId && (Number(a.queue_number) || 0) < myQueueNum)
  const priorCompleted = priorAppts.filter(a => a.status === 'completed').length
  const priorSkipped = priorAppts.filter(a => a.status === 'skipped' || a.status === 'cancelled' || a.status === 'no_show').length
  const priorFinished = priorCompleted + priorSkipped
  const priorActive = priorAppts.filter(a => a.status === 'waiting' || a.status === 'in_progress' || !a.status).length

  // Calculate actual patients ahead:
  let totalAhead = (myIndex >= 0 ? myIndex : orderedWaiting.length) + (doctorBusyWithOther ? 1 : 0)

  if (priorActive > 0 && totalAhead < priorActive) {
    totalAhead = priorActive
  } else if (totalAhead === 0 && myQueueNum > 1 && priorFinished === 0) {
    totalAhead = myQueueNum - 1
  }

  // Is it truly their turn?
  const isCurrentTurn = totalAhead === 0 && (myQueueNum <= 1 || priorFinished >= myQueueNum - 1)
  const isNextInLine = !isCurrentTurn && totalAhead === 1

  const waitMins = isCurrentTurn ? 0 : totalAhead * avgMins
  const statusLabel = isCurrentTurn
    ? 'دورك الآن — تفضل بالدخول'
    : isNextInLine
    ? 'أنت المريض التالي — استعد للدخول'
    : `أمامك ${totalAhead} مريض في الانتظار`

  return {
    status: 'waiting',
    statusLabel,
    isCurrentTurn,
    isNextInLine,
    aheadCount: totalAhead,
    effectivePosition: (myIndex >= 0 ? myIndex : orderedWaiting.length) + 1,
    averageVisitMins: avgMins,
    estimatedWaitMins: waitMins,
    formattedWaitTime: isCurrentTurn ? 'دورك الآن' : formatWaitDuration(waitMins, false),
    currentPatientExamining: currentExamining
  }
}
