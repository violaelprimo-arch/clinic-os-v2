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
    if (remMins > 0) {
      return `حوالي ${hours} ساعة و ${remMins} دقيقة`
    }
    return `حوالي ${hours} ساعة`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (remHours > 0 && remMins > 0) {
    return `حوالي ${days} يوم و ${remHours} ساعة و ${remMins} دقيقة`
  }
  if (remHours > 0) {
    return `حوالي ${days} يوم و ${remHours} ساعة`
  }
  if (remMins > 0) {
    return `حوالي ${days} يوم و ${remMins} دقيقة`
  }
  return `حوالي ${days} يوم`
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

export interface QueuePatternRule {
  serviceId: string
  serviceName?: string
  quota: number // 0 = Immediate Priority, >0 = Cases per cycle
}

/**
 * Sorts active waiting appointments into deterministic entry order.
 * Follows doctor's custom dynamic Queue Pattern (tied to actual clinic services)
 * or falls back to legacy triage ratio (Urgent, Normal, Consultation).
 */
export function sortQueue(appointments: any[], clinic?: any): any[] {
  // Only patients in 'waiting' state belong in the dynamic line
  const allWaiting = [...appointments]
    .filter((d: any) => d.status === 'waiting' || !d.status)

  // 0. High priority late-arrivals: skipped patients who arrived and are queued for immediate next turn
  const priorityAppts = allWaiting
    .filter((d: any) => d.priorityNext)
    .sort((a: any, b: any) => new Date(a.requeuedAt || 0).getTime() - new Date(b.requeuedAt || 0).getTime())

  // Regular waiting line
  const waiting = allWaiting
    .filter((d: any) => !d.priorityNext)
    .sort((a: any, b: any) => (Number(a.queue_number) || 0) - (Number(b.queue_number) || 0))

  const pattern: QueuePatternRule[] =
    Array.isArray(clinic?.queuePattern) && clinic.queuePattern.length > 0
      ? clinic.queuePattern
      : []

  if (pattern.length > 0) {
    const orderedWaiting: any[] = []
    const placedIds = new Set<string>()

    // 1. Immediate Priority (quota === 0): Cases enter immediately at next turn before any cycle
    const immediateRules = pattern.filter(r => Number(r.quota) === 0)
    for (const p of waiting) {
      if (placedIds.has(p.id)) continue
      const isPriority =
        immediateRules.some(r => String(r.serviceId) === String(p.serviceId)) ||
        (immediateRules.length > 0 && isUrgentCase(p))
      if (isPriority) {
        orderedWaiting.push(p)
        placedIds.add(p.id)
      }
    }

    // 2. In-cycle services (quota > 0)
    const cycleRules = pattern.filter(r => Number(r.quota) > 0)
    if (cycleRules.length > 0) {
      const groupsByService = new Map<string, any[]>()
      for (const p of waiting) {
        if (placedIds.has(p.id)) continue
        const sId = String(p.serviceId || 'default')
        if (!groupsByService.has(sId)) groupsByService.set(sId, [])
        groupsByService.get(sId)!.push(p)
      }

      let anyAddedInCycle = true
      while (anyAddedInCycle) {
        anyAddedInCycle = false
        for (const rule of cycleRules) {
          const list = groupsByService.get(String(rule.serviceId))
          if (list && list.length > 0) {
            const countToTake = Math.min(Number(rule.quota) || 1, list.length)
            for (let i = 0; i < countToTake; i++) {
              const patient = list.shift()!
              orderedWaiting.push(patient)
              placedIds.add(patient.id)
              anyAddedInCycle = true
            }
          }
        }
      }
    }

    // 3. Guarantee safety: Any remaining waiting patient not in pattern is appended in booking order
    for (const p of waiting) {
      if (!placedIds.has(p.id)) {
        orderedWaiting.push(p)
        placedIds.add(p.id)
      }
    }

    return [...priorityAppts, ...orderedWaiting]
  }

  // Legacy Fallback
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

  return [...priorityAppts, ...orderedWaiting]
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
  const target = targetAppointment || (Array.isArray(allTodayAppointments) ? allTodayAppointments.find(a => a.id === targetAppointmentId) : null)
  const clinicBranchObj = target?.branch_id && clinic?.branches
    ? clinic.branches.find((b: any) => b.id === target.branch_id)
    : null
  const avgMins = Number(clinicBranchObj?.slotDuration || clinicBranchObj?.averageVisitTime || clinic?.averageVisitTime || clinic?.average_consultation_time) || 15

  if (!target) {
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

  // 1. Branch isolation: filter appointments strictly by branch (A08 Fix: prevent undefined === undefined leakage)
  const targetBranchId = target.branch_id || target.branchId
  const branchFilteredAppts = targetBranchId
    ? allTodayAppointments.filter(a => {
        const aBranch = a.branch_id || a.branchId
        if (aBranch) return aBranch === targetBranchId
        if (target.branchName && a.branchName) {
          return a.branchName === target.branchName
        }
        return false
      })
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
  const rawStatus = target.status || 'waiting'

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
  const myQueueNum = Number(target.queue_number) || 1
  const priorAppts = branchFilteredAppts.filter(a => a.id !== targetAppointmentId && (Number(a.queue_number) || 0) < myQueueNum)
  const priorCompleted = priorAppts.filter(a => a.status === 'completed').length
  const priorSkipped = priorAppts.filter(a => a.status === 'skipped' || a.status === 'cancelled' || a.status === 'no_show').length
  const priorFinished = priorCompleted + priorSkipped
  const priorActive = priorAppts.filter(a => a.status === 'waiting' || a.status === 'in_progress' || !a.status).length

  // Calculate actual patients ahead based on sorted dynamic queue (A07 & A09 Fix: eliminate phantom tickets and preserve urgent priority)
  const totalAhead = (myIndex >= 0 ? myIndex : orderedWaiting.length) + (doctorBusyWithOther ? 1 : 0)

  // Is it truly their turn?
  const isCurrentTurn = totalAhead === 0 && !doctorBusyWithOther
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
