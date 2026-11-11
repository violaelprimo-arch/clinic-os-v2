/**
 * Yalla Clinic - Unified Intelligent Clinical Queue, Schedule & Turn Calculation Engine
 * Single source of truth across Doctor Dashboard, Booking Modal, In-Clinic Booking,
 * Patient Tracking Screen, Patient Portal, TV Screen, and Real-Time Notifications.
 *
 * Strictly distinguishes between:
 * 1. Booking Date (date: string 'YYYY-MM-DD')
 * 2. Static Assigned Ticket Number (queue_number: number)
 * 3. Dynamic Current Line Position (effectivePosition: number)
 * 4. Cases Ahead (aheadCount: number)
 * 5. Estimated Arrival & Entrance Datetime (estimatedEntranceTime12H & estimatedEntranceDateTime)
 */

import {
  getCairoNow,
  getCairoDateString,
  extractDayShifts,
  formatTime12H,
  isDayReceptionEnded,
  DAY_KEYS,
  parseDateSafe,
  ScheduleShift,
  DayScheduleItem,
} from './bookingCapacity'

export interface QueuePatient {
  id: string
  queue_number: number
  patientName?: string
  phone?: string
  servicePrice?: number
  serviceName?: string
  serviceId?: string | number
  durationMinutes?: number
  isUrgent?: boolean
  fivePatientsAlertSent?: boolean
  status?: 'waiting' | 'in_progress' | 'completed' | 'skipped' | 'no_show' | 'cancelled'
  startedAt?: string
  calledAt?: string
  createdAt?: string
  branch_id?: string
  branchId?: string
  branchName?: string
  date?: string
  priorityNext?: boolean
  requeuedAt?: string
}

export interface QueuePatternRule {
  serviceId: string
  serviceName?: string
  quota: number // 0 = Immediate Priority, >0 = Cases per cycle
}

/**
 * Format total minutes from start of day (e.g. 1065 = 17:45) into 12-hour Arabic/English format.
 */
export function formatMinutesTo12H(totalMinutes: number, isRtl: boolean = true): string {
  const normalized = Math.max(0, Math.floor(totalMinutes))
  const h24 = Math.floor(normalized / 60) % 24
  const m = normalized % 60
  const isPM = h24 >= 12
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const period = isRtl ? (isPM ? 'م' : 'ص') : isPM ? 'PM' : 'AM'
  const mStr = String(m).padStart(2, '0')
  return `${h12}:${mStr} ${period}`
}

/**
 * Format timestamp into 12-hour Arabic/English time string in Cairo timezone.
 */
export function formatCairo12Hour(date: Date, isRtl: boolean = true): string {
  try {
    return new Intl.DateTimeFormat(isRtl ? 'ar-EG' : 'en-US', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    return formatMinutesTo12H(hours * 60 + minutes, isRtl)
  }
}

/**
 * Interpret a clinic's wall-clock appointment time as Africa/Cairo, not the
 * browser's or Cloudflare Worker's own timezone. This handles winter UTC+2
 * and summer UTC+3, including upcoming DST changes.
 */
export function cairoWallClockEpochMs(dateStr: string, totalMinutes: number): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day || !Number.isFinite(totalMinutes)) {
    throw new Error('INVALID_CAIRO_APPOINTMENT_TIME')
  }
  const localAsUtc = Date.UTC(year, month - 1, day) +
    Math.floor(totalMinutes) * 60_000
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', timeZoneName: 'longOffset',
  })
  const offsetMinutesAt = (epoch: number): number => {
    const label = formatter.formatToParts(new Date(epoch))
      .find(part => part.type === 'timeZoneName')?.value || ''
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(label)
    if (!match) throw new Error('CAIRO_TIMEZONE_UNAVAILABLE')
    const minutes = Number(match[2]) * 60 + Number(match[3])
    return match[1] === '-' ? -minutes : minutes
  }
  let epoch = localAsUtc - offsetMinutesAt(localAsUtc) * 60_000
  // At a daylight-saving boundary, the offset at UTC noon can differ from
  // the offset at the desired Cairo-local hour.
  epoch = localAsUtc - offsetMinutesAt(epoch) * 60_000
  return epoch
}

/**
 * Converts estimated minutes to 12-hour formatted time in Cairo timezone.
 * Backwards compatible with legacy calls.
 */
export function formatEstimatedTime(minutesToAdd: number, baseDate?: Date, isRtl: boolean = true): string {
  const base = baseDate || new Date()
  const future = new Date(base.getTime() + minutesToAdd * 60000)
  return formatCairo12Hour(future, isRtl)
}

/**
 * Human-readable wait duration formatted in Arabic or English with days, hours, and minutes.
 */
export function formatWaitDuration(mins: number, isCurrentTurn = false, isRtl: boolean = true): string {
  if (isCurrentTurn) return isRtl ? 'دورك الآن' : 'Your turn now'
  if (mins <= 0) return isRtl ? 'خلال دقائق معدودة' : 'In a few minutes'
  if (mins < 60) return isRtl ? `حوالي ${mins} دقيقة` : `Around ${mins} mins`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) {
    if (remMins > 0) {
      return isRtl
        ? `حوالي ${hours} ساعة و ${remMins} دقيقة`
        : `Around ${hours} hr ${remMins} mins`
    }
    return isRtl ? `حوالي ${hours} ساعة` : `Around ${hours} hr`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (remHours > 0 && remMins > 0) {
    return isRtl
      ? `حوالي ${days} يوم و ${remHours} ساعة و ${remMins} دقيقة`
      : `Around ${days} days ${remHours} hr ${remMins} mins`
  }
  if (remHours > 0) {
    return isRtl ? `حوالي ${days} يوم و ${remHours} ساعة` : `Around ${days} days ${remHours} hr`
  }
  if (remMins > 0) {
    return isRtl ? `حوالي ${days} يوم و ${remMins} دقيقة` : `Around ${days} days ${remMins} mins`
  }
  return isRtl ? `حوالي ${days} يوم` : `Around ${days} days`
}

/**
 * Clinical case classification helpers
 */
export const isUrgentCase = (d: any): boolean =>
  Boolean(
    d?.isUrgent ||
      (d?.serviceName &&
        (d.serviceName.includes('مستعجل') ||
          d.serviceName.includes('طوارئ') ||
          d.serviceName.toLowerCase().includes('urgent') ||
          d.serviceName.toLowerCase().includes('emergency'))) ||
      String(d?.serviceId) === '3'
  )

export const isConsultCase = (d: any): boolean =>
  Boolean(
    !isUrgentCase(d) &&
      ((d?.serviceName &&
        (d.serviceName.includes('استشارة') ||
          d.serviceName.includes('متابعة') ||
          d.serviceName.toLowerCase().includes('consult') ||
          d.serviceName.toLowerCase().includes('followup'))) ||
        String(d?.serviceId) === '2' ||
        String(d?.serviceId) === '4')
  )

export const isNormalCase = (d: any): boolean => Boolean(!isUrgentCase(d) && !isConsultCase(d))

/**
 * Resolves expected consultation/service duration for an appointment.
 */
export function getCaseDuration(appt: any, branch?: any, clinic?: any): number {
  if (Number(appt?.durationMinutes) > 0) return Number(appt.durationMinutes)
  if (Number(appt?.serviceDuration) > 0) return Number(appt.serviceDuration)

  const sId = String(appt?.serviceId || '')
  const sName = String(appt?.serviceName || '').trim()

  const serviceList = branch?.services || clinic?.services || []
  if (Array.isArray(serviceList)) {
    const found = serviceList.find(
      (s: any) => String(s.id) === sId || String(s.name || '').trim() === sName
    )
    if (found && Number(found.duration) > 0) return Number(found.duration)
    if (found && Number(found.durationMinutes) > 0) return Number(found.durationMinutes)
  }

  const bDuration = Number(branch?.slotDuration || branch?.averageVisitTime)
  if (bDuration > 0) return bDuration

  const cDuration = Number(clinic?.slotDuration || clinic?.averageVisitTime || clinic?.average_consultation_time)
  if (cDuration > 0) return cDuration

  return 15
}

/**
 * Sorts active waiting appointments into deterministic clinical entry order.
 * Follows doctor's custom dynamic Queue Pattern (tied to actual clinic services)
 * or falls back to legacy triage ratio (Urgent, Normal, Consultation).
 */
export function sortQueue(appointments: any[], clinic?: any): any[] {
  // Only patients in active waiting state belong in the dynamic line
  const allWaiting = [...appointments].filter(
    (d: any) =>
      (d.status === 'waiting' || (!d.status && (d.queue_number || d.queueNumber))) &&
      (d.queue_number !== undefined || d.queueNumber !== undefined || d.patientName)
  )

  // 0. High priority late-arrivals: skipped patients who arrived and are queued for immediate next turn
  const priorityAppts = allWaiting
    .filter((d: any) => d.priorityNext)
    .sort((a: any, b: any) => new Date(a.requeuedAt || 0).getTime() - new Date(b.requeuedAt || 0).getTime())

  // Regular waiting line
  const waiting = allWaiting
    .filter((d: any) => !d.priorityNext)
    .sort(
      (a: any, b: any) =>
        (Number(a.queue_number ?? a.queueNumber) || 0) -
        (Number(b.queue_number ?? b.queueNumber) || 0)
    )

  const pattern: QueuePatternRule[] =
    Array.isArray(clinic?.queuePattern) && clinic.queuePattern.length > 0
      ? clinic.queuePattern
      : []

  if (pattern.length > 0) {
    const orderedWaiting: any[] = []
    const placedIds = new Set<string>()

    // 1. Immediate Priority (quota === 0): Cases enter immediately at next turn before any cycle
    const immediateRules = pattern.filter((r) => Number(r.quota) === 0)
    for (const p of waiting) {
      if (placedIds.has(p.id)) continue
      const isPriority =
        immediateRules.some((r) => String(r.serviceId) === String(p.serviceId)) ||
        (immediateRules.length > 0 && isUrgentCase(p))
      if (isPriority) {
        orderedWaiting.push(p)
        placedIds.add(p.id)
      }
    }

    // 2. In-cycle services (quota > 0)
    const cycleRules = pattern.filter((r) => Number(r.quota) > 0)
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
    orderedWaiting.push(...urgentQueue)

    let nIdx = 0,
      cIdx = 0
    while (nIdx < normalQueue.length || cIdx < consultQueue.length) {
      const prevN = nIdx,
        prevC = cIdx
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
    let uIdx = 0,
      nIdx = 0,
      cIdx = 0
    while (uIdx < urgentQueue.length || nIdx < normalQueue.length || cIdx < consultQueue.length) {
      const prevU = uIdx,
        prevN = nIdx,
        prevC = cIdx
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

/**
 * Core Clinical Queue Timeline Simulation Engine
 * Calculates exact estimated entry time starting from valid reception sessions,
 * handling breaks, multiple shifts, doctor delays, and future bookings.
 */
export function simulateQueueTimeline(options: {
  bookingDateStr: string
  targetAppointmentId?: string
  targetServiceId?: string | number
  targetDurationMinutes?: number
  allDateAppointments: any[]
  clinic?: any
  branch?: any
  customNowDate?: Date
  isRtl?: boolean
}) {
  const {
    bookingDateStr,
    targetAppointmentId,
    allDateAppointments,
    clinic,
    branch,
    customNowDate,
    isRtl = true,
  } = options

  const cairoNow = getCairoNow(customNowDate)
  const todayStr = cairoNow.dateStr
  const nowMinutes = cairoNow.totalMinutes
  const isToday = bookingDateStr === todayStr
  const isFuture = bookingDateStr > todayStr
  const isPast = bookingDateStr < todayStr

  // 1. Resolve Day Schedule & Shifts
  const dayDate = parseDateSafe(bookingDateStr)
  const dayKey = DAY_KEYS[dayDate.getUTCDay()]

  const scheduleList: DayScheduleItem[] =
    branch?.weeklySchedule || clinic?.weeklySchedule || []
  const daySched = scheduleList.find(
    (s) => (s.dayKey || s.day || '').toLowerCase() === dayKey.toLowerCase()
  )
  const rawShifts = extractDayShifts(daySched)

  // Fallback shift if schedule not defined: 17:00 (5:00 PM) to 22:00 (10:00 PM) or 09:00 to 21:00
  const shifts: ScheduleShift[] =
    rawShifts.length > 0
      ? rawShifts
      : [
          {
            start: '17:00',
            end: '22:00',
            startMinutes: 17 * 60,
            endMinutes: 22 * 60,
            isOvernight: false,
          },
        ]

  // Check holiday/vacations/closed
  const vacations = [...(clinic?.vacations || []), ...(branch?.vacations || [])]
  const holidays = [...(clinic?.holidays || []), ...(branch?.holidays || [])]
  const isHoliday = vacations.includes(bookingDateStr) || holidays.includes(bookingDateStr)
  const isPaused = Boolean(clinic?.isPaused || branch?.isPaused || clinic?.isAcceptingBookings === false)

  // 2. Filter Active Appointments in Branch on Booking Date
  const targetBranchId = branch?.id
  const branchAppts = allDateAppointments.filter((a) => {
    if (a.date !== bookingDateStr) return false
    const aBranch = a.branch_id || a.branchId
    if (targetBranchId && aBranch && aBranch !== targetBranchId) return false
    // Only active waiting or in_progress cases occupy queue
    return a.status === 'waiting' || a.status === 'in_progress' || !a.status
  })

  // 3. Find in-progress examining patient
  const inProgressAppt = isToday
    ? branchAppts.find((a) => a.status === 'in_progress' || a.status === 'examining') || null
    : null

  // 4. Sort waiting queue using doctor's prioritized order
  const orderedWaiting = sortQueue(branchAppts, clinic)

  // 5. Locate target patient in ordered list
  let myIndex = -1
  if (targetAppointmentId) {
    myIndex = orderedWaiting.findIndex((p) => p.id === targetAppointmentId)
  }

  // If patient is currently in the exam room right now
  if (inProgressAppt && targetAppointmentId && inProgressAppt.id === targetAppointmentId) {
    return {
      orderedWaiting,
      inProgressAppt,
      aheadCount: 0,
      effectivePosition: 1,
      estimatedEntranceMinutes: nowMinutes,
      estimatedEntranceTime12H: isRtl ? 'بالداخل الآن' : 'In Examination Room',
      estimatedEntranceDateTime: `${bookingDateStr}T${cairoNow.timeStr}:00`,
      isEstimateConfirmed: true,
      isCurrentTurn: true,
      isNextInLine: false,
      remainingTotalMinutes: 0,
      sessionExceeded: false,
      isHoliday,
      isPaused,
    }
  }

  // Patients ahead in line
  const patientsAhead =
    myIndex >= 0
      ? orderedWaiting.slice(0, myIndex)
      : orderedWaiting // if simulating for a new booking, all current waiting patients are ahead

  const doctorBusyWithOther = Boolean(isToday && inProgressAppt && inProgressAppt.id !== targetAppointmentId)
  const aheadCount = patientsAhead.length + (doctorBusyWithOther ? 1 : 0)
  const effectivePosition = aheadCount + 1

  // 6. Compute Timeline Starting Cursor
  let cursorMinutes = 0
  let currentShiftIdx = 0
  let sessionExceeded = false
  let unconfirmedReason: string | undefined = undefined

  if (isPaused) {
    unconfirmedReason = isRtl ? 'الحجز متوقف مؤقتاً بالعيادة' : 'Bookings paused'
  } else if (isHoliday) {
    unconfirmedReason = isRtl ? 'العيادة في عطلة رسمية في هذا التاريخ' : 'Clinic holiday'
  }

  if (isFuture) {
    // For future dates, simulation starts at the opening time of the first shift on that date!
    cursorMinutes = shifts[0].startMinutes
    currentShiftIdx = 0
  } else if (isToday) {
    // Check if we are BEFORE the first shift of today (e.g. 10:00 AM, opens at 5:00 PM)
    if (nowMinutes < shifts[0].startMinutes) {
      cursorMinutes = shifts[0].startMinutes
      currentShiftIdx = 0
    } else if (isDayReceptionEnded(shifts, nowMinutes)) {
      // Reception ended for today
      sessionExceeded = true
      unconfirmedReason = isRtl ? 'انتهت ساعات العمل اليوم' : 'Working hours ended'
      cursorMinutes = shifts[shifts.length - 1].endMinutes
      currentShiftIdx = shifts.length - 1
    } else {
      // We are within today's operating hours! Find current shift or break
      let foundShift = false
      for (let k = 0; k < shifts.length; k++) {
        const s = shifts[k]
        if (!s.isOvernight) {
          if (nowMinutes >= s.startMinutes && nowMinutes <= s.endMinutes) {
            cursorMinutes = nowMinutes
            currentShiftIdx = k
            foundShift = true
            break
          }
          if (k < shifts.length - 1 && nowMinutes > s.endMinutes && nowMinutes < shifts[k + 1].startMinutes) {
            // We are in a break between shifts! Next reception resumes at next shift start
            cursorMinutes = shifts[k + 1].startMinutes
            currentShiftIdx = k + 1
            foundShift = true
            break
          }
        } else {
          // Overnight shift handling
          cursorMinutes = nowMinutes
          currentShiftIdx = k
          foundShift = true
          break
        }
      }
      if (!foundShift) {
        cursorMinutes = nowMinutes
        currentShiftIdx = 0
      }
    }
  } else {
    // Past date
    sessionExceeded = true
    unconfirmedReason = isRtl ? 'حجز سابق منتهي' : 'Past appointment'
    cursorMinutes = 0
  }

  // Doctor announced delay
  const doctorDelay = Number(clinic?.doctorDelayMinutes || branch?.doctorDelayMinutes) || 0
  if (doctorDelay > 0 && isToday) {
    cursorMinutes += doctorDelay
  }

  // Helper to advance cursor through shifts and break intervals
  const advanceCursorBy = (durationMins: number) => {
    let remaining = durationMins
    while (remaining > 0 && currentShiftIdx < shifts.length) {
      const shift = shifts[currentShiftIdx]
      const availableInShift = shift.endMinutes - cursorMinutes
      if (availableInShift >= remaining) {
        cursorMinutes += remaining
        remaining = 0
      } else if (availableInShift > 0) {
        remaining -= availableInShift
        if (currentShiftIdx < shifts.length - 1) {
          currentShiftIdx++
          cursorMinutes = shifts[currentShiftIdx].startMinutes
        } else {
          // No more shifts today
          if (clinic?.allowOvertime || clinic?.allowSessionOverflow) {
            cursorMinutes += remaining
            remaining = 0
          } else {
            sessionExceeded = true
            cursorMinutes += remaining
            remaining = 0
          }
        }
      } else {
        if (currentShiftIdx < shifts.length - 1) {
          currentShiftIdx++
          cursorMinutes = shifts[currentShiftIdx].startMinutes
        } else {
          sessionExceeded = true
          cursorMinutes += remaining
          remaining = 0
        }
      }
    }
  }

  // 7. Advance time for currently examining patient
  if (doctorBusyWithOther && inProgressAppt) {
    const examDuration = getCaseDuration(inProgressAppt, branch, clinic)
    let remainingExamMins = Math.max(2, Math.floor(examDuration / 2))
    const startTimestamp = inProgressAppt.calledAt || inProgressAppt.startedAt
    if (startTimestamp) {
      const elapsedMs = (customNowDate || new Date()).getTime() - new Date(startTimestamp).getTime()
      const elapsedMins = Math.floor(elapsedMs / 60000)
      if (elapsedMins >= 0 && elapsedMins < examDuration) {
        remainingExamMins = Math.max(2, examDuration - elapsedMins)
      } else if (elapsedMins >= examDuration) {
        remainingExamMins = 2 // Wrap up soon
      }
    }
    advanceCursorBy(remainingExamMins)
  }

  // 8. Advance time through all patients ahead in line
  for (const patientAhead of patientsAhead) {
    const pDur = getCaseDuration(patientAhead, branch, clinic)
    advanceCursorBy(pDur)
  }

  // 9. Format Entrance Datetime & 12H Time
  const entranceMinutes = cursorMinutes
  const estimatedEntranceTime12H = formatMinutesTo12H(entranceMinutes, isRtl)

  const h24 = Math.floor(entranceMinutes / 60) % 24
  const m24 = entranceMinutes % 60
  const estimatedEntranceDateTime = `${bookingDateStr}T${String(h24).padStart(2, '0')}:${String(m24).padStart(2, '0')}:00`

  // 10. Calculate Remaining Time Countdown using Cairo civil time.
  // Parsing an offset-less YYYY-MM-DDTHH:mm in a Cloudflare Worker (UTC)
  // used to add two hours to the displayed wait time in winter.
  const targetEpoch = cairoWallClockEpochMs(bookingDateStr, entranceMinutes)
  const nowEpoch = (customNowDate || new Date()).getTime()
  const diffMs = Math.max(0, targetEpoch - nowEpoch)
  const remainingTotalMinutes = Math.floor(diffMs / 60000)

  const isCurrentTurn = Boolean(
    isToday &&
      aheadCount === 0 &&
      !doctorBusyWithOther &&
      !sessionExceeded &&
      !isPaused &&
      nowMinutes >= shifts[0].startMinutes
  )
  const isNextInLine = Boolean(isToday && aheadCount === 1 && !sessionExceeded && !isPaused)
  const isEstimateConfirmed = !isPaused && !isHoliday && !sessionExceeded

  return {
    orderedWaiting,
    inProgressAppt,
    aheadCount,
    effectivePosition,
    estimatedEntranceMinutes: entranceMinutes,
    estimatedEntranceTime12H,
    estimatedEntranceDateTime,
    isEstimateConfirmed,
    unconfirmedReason,
    isCurrentTurn,
    isNextInLine,
    remainingTotalMinutes,
    sessionExceeded,
    isToday,
    isFuture,
    isPast,
    isHoliday,
    isPaused,
  }
}

export interface PatientQueueStatusResult {
  status:
    | 'in_progress'
    | 'waiting'
    | 'completed'
    | 'skipped'
    | 'no_show'
    | 'cancelled'
    | 'not_found'
    | 'upcoming'
    | 'holiday'
    | 'paused'
    | 'closed'
  statusLabel: string
  isCurrentTurn: boolean
  isNextInLine: boolean
  aheadCount: number
  effectivePosition: number
  averageVisitMins: number
  estimatedWaitMins: number
  formattedWaitTime: string
  estimatedEntranceTime12H: string
  estimatedEntranceDateTime: string
  isEstimateConfirmed: boolean
  unconfirmedReason?: string
  isFuture: boolean
  isToday: boolean
  isPast: boolean
  remainingDays: number
  remainingHours: number
  remainingMinutes: number
  remainingTotalMinutes: number
  currentPatientExamining: {
    queueNumber?: number
    patientName?: string
  } | null
}

/**
 * Universal Patient Queue Position & Entry Time Calculator
 * Evaluates live position, cases ahead, and schedule-anchored estimated entry datetime.
 */
export function calculatePatientLivePosition(options: {
  targetAppointmentId?: string
  targetAppointment?: any
  allTodayAppointments?: any[]
  clinic?: any
  branch?: any
  bookingDateStr?: string
  customNowDate?: Date
  isRtl?: boolean
}): PatientQueueStatusResult {
  const {
    targetAppointmentId,
    targetAppointment,
    allTodayAppointments = [],
    clinic,
    branch,
    bookingDateStr,
    customNowDate,
    isRtl = true,
  } = options

  const target =
    targetAppointment ||
    (Array.isArray(allTodayAppointments)
      ? allTodayAppointments.find((a) => a.id === targetAppointmentId)
      : null)

  const cairoNow = getCairoNow(customNowDate)
  const todayCairoStr = cairoNow.dateStr
  const targetDateStr = bookingDateStr || target?.date || todayCairoStr

  const isToday = targetDateStr === todayCairoStr
  const isFuture = targetDateStr > todayCairoStr
  const isPast = targetDateStr < todayCairoStr

  const clinicBranchObj =
    branch ||
    (target?.branch_id && clinic?.branches
      ? clinic.branches.find((b: any) => b.id === target.branch_id)
      : null)

  const avgMins = getCaseDuration(target, clinicBranchObj, clinic)

  if (!target) {
    return {
      status: 'not_found',
      statusLabel: isRtl ? 'غير مسجل' : 'Not Registered',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: '—',
      estimatedEntranceTime12H: '—',
      estimatedEntranceDateTime: '',
      isEstimateConfirmed: false,
      isFuture: false,
      isToday: true,
      isPast: false,
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingTotalMinutes: 0,
      currentPatientExamining: null,
    }
  }

  // Raw status handling
  const rawStatus = target.status || 'waiting'

  if (rawStatus === 'completed') {
    return {
      status: 'completed',
      statusLabel: isRtl ? 'تم الكشف الطبي بنجاح' : 'Consultation Completed',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: isRtl ? 'تم الانتهاء' : 'Finished',
      estimatedEntranceTime12H: isRtl ? 'انتهى الكشف' : 'Finished',
      estimatedEntranceDateTime: '',
      isEstimateConfirmed: true,
      isFuture,
      isToday,
      isPast,
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingTotalMinutes: 0,
      currentPatientExamining: null,
    }
  }

  if (rawStatus === 'cancelled') {
    return {
      status: 'cancelled',
      statusLabel: isRtl ? 'تم إلغاء الحجز' : 'Booking Cancelled',
      isCurrentTurn: false,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 0,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: isRtl ? 'ملغي' : 'Cancelled',
      estimatedEntranceTime12H: isRtl ? 'ملغي' : 'Cancelled',
      estimatedEntranceDateTime: '',
      isEstimateConfirmed: false,
      isFuture,
      isToday,
      isPast,
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingTotalMinutes: 0,
      currentPatientExamining: null,
    }
  }

  if (rawStatus === 'skipped' || rawStatus === 'no_show') {
    if (!target.priorityNext) {
      return {
        status: rawStatus,
        statusLabel: isRtl
          ? 'تم تخطي الموعد — يرجى مراجعة الاستقبال'
          : 'Turn skipped — please consult reception',
        isCurrentTurn: false,
        isNextInLine: false,
        aheadCount: 0,
        effectivePosition: 0,
        averageVisitMins: avgMins,
        estimatedWaitMins: 0,
        formattedWaitTime: isRtl ? 'مؤجل / تم التخطي' : 'Skipped / Deferred',
        estimatedEntranceTime12H: isRtl ? 'بانتظار الحضور' : 'Awaiting Arrival',
        estimatedEntranceDateTime: '',
        isEstimateConfirmed: false,
        isFuture,
        isToday,
        isPast,
        remainingDays: 0,
        remainingHours: 0,
        remainingMinutes: 0,
        remainingTotalMinutes: 0,
        currentPatientExamining: null,
      }
    }
  }

  // Run comprehensive schedule timeline simulation
  const simulation = simulateQueueTimeline({
    bookingDateStr: targetDateStr,
    targetAppointmentId: target.id,
    targetServiceId: target.serviceId,
    targetDurationMinutes: avgMins,
    allDateAppointments: allTodayAppointments,
    clinic,
    branch: clinicBranchObj,
    customNowDate,
    isRtl,
  })

  const currentExamining = simulation.inProgressAppt
    ? {
        queueNumber: simulation.inProgressAppt.queue_number,
        patientName: simulation.inProgressAppt.patientName,
      }
    : null

  // In-progress status
  if (rawStatus === 'in_progress' && isToday) {
    return {
      status: 'in_progress',
      statusLabel: isRtl ? 'دورك الآن — تفضل بالدخول للطبيب' : 'Your turn now — please enter',
      isCurrentTurn: true,
      isNextInLine: false,
      aheadCount: 0,
      effectivePosition: 1,
      averageVisitMins: avgMins,
      estimatedWaitMins: 0,
      formattedWaitTime: isRtl ? 'دورك الآن' : 'Your turn now',
      estimatedEntranceTime12H: isRtl ? 'بالداخل الآن' : 'Inside Now',
      estimatedEntranceDateTime: simulation.estimatedEntranceDateTime,
      isEstimateConfirmed: true,
      isFuture: false,
      isToday: true,
      isPast: false,
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingTotalMinutes: 0,
      currentPatientExamining: currentExamining,
    }
  }

  // Countdown decomposition
  const totalMins = simulation.remainingTotalMinutes
  const remDays = Math.floor(totalMins / (24 * 60))
  const remHours = Math.floor((totalMins % (24 * 60)) / 60)
  const remMinutes = totalMins % 60

  let formattedWait = ''
  if (simulation.isCurrentTurn) {
    formattedWait = isRtl ? 'دورك الآن' : 'Your turn now'
  } else if (isFuture) {
    formattedWait =
      remDays === 1
        ? isRtl
          ? `غداً (${simulation.estimatedEntranceTime12H})`
          : `Tomorrow (${simulation.estimatedEntranceTime12H})`
        : isRtl
        ? `خلال ${remDays} يوم (${simulation.estimatedEntranceTime12H})`
        : `In ${remDays} days (${simulation.estimatedEntranceTime12H})`
  } else {
    formattedWait = formatWaitDuration(totalMins, false, isRtl)
  }

  let statusLabel = ''
  if (isFuture) {
    statusLabel = isRtl
      ? `موعد قادم مؤكد يوم ${targetDateStr}`
      : `Upcoming Confirmed: ${targetDateStr}`
  } else if (simulation.isCurrentTurn) {
    statusLabel = isRtl ? 'دورك الآن — تفضل بالدخول' : 'Your turn now — please enter'
  } else if (simulation.isNextInLine) {
    statusLabel = isRtl ? 'أنت المريض التالي — استعد للدخول' : 'You are next in line'
  } else if (simulation.aheadCount > 0) {
    statusLabel = isRtl
      ? `أمامك ${simulation.aheadCount} مريض في الانتظار`
      : `${simulation.aheadCount} patients ahead in queue`
  } else {
    statusLabel = isRtl ? 'استعد للدخول' : 'Prepare to enter'
  }

  return {
    status: isFuture ? 'upcoming' : 'waiting',
    statusLabel,
    isCurrentTurn: simulation.isCurrentTurn,
    isNextInLine: simulation.isNextInLine,
    aheadCount: simulation.aheadCount,
    effectivePosition: simulation.effectivePosition,
    averageVisitMins: avgMins,
    estimatedWaitMins: totalMins,
    formattedWaitTime: formattedWait,
    estimatedEntranceTime12H: simulation.estimatedEntranceTime12H,
    estimatedEntranceDateTime: simulation.estimatedEntranceDateTime,
    isEstimateConfirmed: simulation.isEstimateConfirmed,
    unconfirmedReason: simulation.unconfirmedReason,
    isFuture,
    isToday,
    isPast,
    remainingDays: remDays,
    remainingHours: remHours,
    remainingMinutes: remMinutes,
    remainingTotalMinutes: totalMins,
    currentPatientExamining: currentExamining,
  }
}
