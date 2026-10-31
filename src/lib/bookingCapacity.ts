/**
 * Unified Booking Capacity & Scheduling Utilities
 * Single source of truth across Clinic Settings, Branch Management,
 * In-Clinic Booking, Online Booking Modal, and Queue Processing.
 */

export const CAPACITY_FULL_MESSAGE = 'اكتمل الحد الأقصى للحجوزات لهذا اليوم. برجاء اختيار موعد آخر.'

export const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
export const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]
export const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * Returns YYYY-MM-DD formatted date in Africa/Cairo timezone.
 */
export function getCairoDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

/**
 * Returns current date and time components in Africa/Cairo timezone.
 */
export function getCairoNow(customDate?: Date): {
  dateStr: string
  timeStr: string
  dayKey: string
  dayIndex: number
  hours: number
  minutes: number
  totalMinutes: number
} {
  const d = customDate || new Date()
  const dateStr = getCairoDateString(d)

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const timeParts = timeFormatter.format(d).split(':')
  const hours = parseInt(timeParts[0], 10) || 0
  const minutes = parseInt(timeParts[1], 10) || 0
  const totalMinutes = hours * 60 + minutes
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    weekday: 'long'
  })
  const dayKey = dayFormatter.format(d).toLowerCase()
  const dayIndex = DAY_KEYS.indexOf(dayKey) >= 0 ? DAY_KEYS.indexOf(dayKey) : 0

  return { dateStr, timeStr, dayKey, dayIndex, hours, minutes, totalMinutes }
}

/**
 * Parse YYYY-MM-DD string into a Date object at UTC midnight.
 */
export function parseDateSafe(dateStr: string): Date {
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    return new Date(Date.UTC(y, m, d))
  }
  return new Date()
}

/**
 * Converts a 24-hour time string (e.g. '14:30' or '09:00') into 12-hour format with Arabic or English suffix.
 */
export function formatTime12H(time24?: string, isRtl: boolean = true): string {
  if (!time24) return ''
  const parts = time24.split(':')
  let h = parseInt(parts[0], 10)
  if (isNaN(h)) return time24
  const m = parts[1] ? String(parts[1]).padStart(2, '0') : '00'
  const isPM = h >= 12
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  const period = isRtl ? (isPM ? 'م' : 'ص') : (isPM ? 'PM' : 'AM')
  return `${h}:${m} ${period}`
}

/**
 * Converts 'HH:mm' string to total minutes from start of day.
 */
export function parseTimeToMinutes(t?: string): number {
  if (!t) return 0
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10) || 0
  const m = parseInt(mStr, 10) || 0
  return h * 60 + m
}

export interface ScheduleShift {
  start: string        // e.g. '09:00'
  end: string          // e.g. '22:00'
  startMinutes: number // 9 * 60 = 540
  endMinutes: number   // 22 * 60 = 1320
  isOvernight: boolean // e.g. start: '20:00', end: '02:00' -> endMinutes < startMinutes
}

export interface DayScheduleItem {
  id?: string
  dayKey?: string
  day?: string
  isOpen?: boolean
  start?: string
  end?: string
  start2?: string
  end2?: string
  shifts?: Array<{ start: string; end: string }>
}

/**
 * Extracts all shifts (single, multiple, or split) from a DayScheduleItem.
 */
export function extractDayShifts(daySched?: DayScheduleItem): ScheduleShift[] {
  if (!daySched || daySched.isOpen === false) return []
  const shifts: ScheduleShift[] = []

  const addShift = (s?: string, e?: string) => {
    if (!s || !e) return
    const sMin = parseTimeToMinutes(s)
    const eMin = parseTimeToMinutes(e)
    const isOvernight = eMin < sMin
    shifts.push({
      start: s,
      end: e,
      startMinutes: sMin,
      endMinutes: eMin,
      isOvernight
    })
  }

  if (Array.isArray(daySched.shifts) && daySched.shifts.length > 0) {
    daySched.shifts.forEach((s) => addShift(s.start, s.end))
  } else {
    addShift(daySched.start, daySched.end)
    if (daySched.start2 && daySched.end2) {
      addShift(daySched.start2, daySched.end2)
    }
  }

  return shifts
}

/**
 * Checks whether all reception periods/shifts for TODAY have already ended.
 * Returns true if all shifts have concluded; false if at least one shift is active or upcoming today.
 */
export function isDayReceptionEnded(shifts: ScheduleShift[], currentTotalMinutes: number): boolean {
  if (shifts.length === 0) return true

  // If ANY shift is currently active or in the future today, reception is NOT ended
  const hasActiveOrFuture = shifts.some((shift) => {
    if (!shift.isOvernight) {
      // Standard daytime shift: e.g. 09:00 - 22:00
      return currentTotalMinutes <= shift.endMinutes
    } else {
      // Overnight shift: e.g. 20:00 - 02:00
      // Active during late evening (>= 20:00) OR early morning next day (<= 02:00)
      return currentTotalMinutes >= shift.startMinutes || currentTotalMinutes <= shift.endMinutes
    }
  })

  return !hasActiveOrFuture
}

/**
 * Formats shifts into readable working hours text.
 */
export function formatShiftsSummary(shifts: ScheduleShift[], isRtl: boolean = true): string {
  if (shifts.length === 0) return isRtl ? 'إجازة' : 'Closed'
  return shifts.map((s) => `${formatTime12H(s.start, isRtl)} - ${formatTime12H(s.end, isRtl)}`).join(' • ')
}

/**
 * Unifies resolution of maxDailyBookings across clinic and branch.
 * For single-branch clinics (or when clinic has multiple branches disabled),
 * the clinic setting takes strict precedence over any legacy branch document value.
 */
export function resolveEffectiveDailyLimit(
  clinic: { maxDailyBookings?: number | string; branchesEnabled?: boolean } | null | undefined,
  branch?: { maxDailyBookings?: number | string; isMain?: boolean } | null | undefined,
  hasMultipleBranches: boolean = false
): number {
  const clinicLimit = Math.max(0, Number(clinic?.maxDailyBookings) || 0)
  const branchLimit = Math.max(0, Number(branch?.maxDailyBookings) || 0)

  // 1. If multi-branch mode is active and this specific sub-branch has its own distinct limit > 0
  if (hasMultipleBranches && branch && branchLimit > 0 && !branch.isMain) {
    return branchLimit
  }

  // 2. Main clinic setting is the primary source of truth
  if (clinicLimit > 0) {
    return clinicLimit
  }

  // 3. Fallback to branch limit if clinic limit is not set
  if (branchLimit > 0) {
    return branchLimit
  }

  return 0
}

/**
 * Determines whether an appointment occupies daily capacity.
 * Waiting, in_progress, examining, and completed all occupy daily quota.
 * Cancelled or no_show statuses do NOT occupy capacity.
 */
export function isAppointmentActive(status?: string | null): boolean {
  if (!status) return true
  const lower = status.toLowerCase()
  return lower !== 'cancelled' && lower !== 'canceled' && lower !== 'no_show'
}

export type DayStatus =
  | 'available'        // Open for new bookings
  | 'full'             // Daily capacity reached
  | 'holiday'          // Day off or vacation
  | 'reception_ended'  // Today's operating hours passed
  | 'paused'           // Booking manually paused
  | 'past'             // Date has already passed

export interface DayAvailabilityInfo {
  iso: string
  dateStr: string
  dayKey: string
  dayName: string
  label: string
  subLabel: string
  formattedDate: string
  status: DayStatus
  statusLabel: string
  isSelectable: boolean
  isFull: boolean
  bookedCount: number
  limit: number
  shifts: ScheduleShift[]
  workingHoursLabel: string
  reason?: string
}

export type AvailableDayItem = DayAvailabilityInfo

/**
 * Evaluates the full availability status of a given date (YYYY-MM-DD).
 */
export function evaluateDayAvailability(options: {
  dateStr: string
  clinic?: {
    isClinicOpen?: boolean
    isAcceptingBookings?: boolean
    weeklySchedule?: DayScheduleItem[]
    vacations?: string[]
    holidays?: string[]
    closedDates?: string[]
    maxDailyBookings?: number | string
  } | null
  branch?: {
    isOpen?: boolean
    weeklySchedule?: DayScheduleItem[]
    vacations?: string[]
    holidays?: string[]
    maxDailyBookings?: number | string
  } | null
  limit: number
  dailyCounts?: Record<string, number>
  customNowDate?: Date
  isRtl?: boolean
}): DayAvailabilityInfo {
  const {
    dateStr,
    clinic,
    branch,
    limit,
    dailyCounts = {},
    customNowDate,
    isRtl = true
  } = options

  const cairoNow = getCairoNow(customNowDate)
  const curDate = parseDateSafe(dateStr)

  const dayIndex = curDate.getUTCDay()
  const dayKey = DAY_KEYS[dayIndex]
  const dayName = isRtl ? DAY_NAMES_AR[dayIndex] : DAY_NAMES_EN[dayIndex]
  const monthName = isRtl ? MONTH_NAMES_AR[curDate.getUTCMonth()] : MONTH_NAMES_EN[curDate.getUTCMonth()]
  const dayNum = curDate.getUTCDate()
  const subLabel = `${dayNum} ${monthName}`
  const formattedDate = `${dayName} (${dayNum} ${monthName})`

  let label = dayName
  if (dateStr === cairoNow.dateStr) {
    label = isRtl ? 'اليوم' : 'Today'
  } else {
    // Tomorrow check
    const tomorrowDate = new Date(parseDateSafe(cairoNow.dateStr).getTime() + 86400000)
    if (dateStr === getCairoDateString(tomorrowDate)) {
      label = isRtl ? 'غداً' : 'Tomorrow'
    }
  }

  const bookedCount = Number(dailyCounts[dateStr]) || 0
  const isFull = limit > 0 && bookedCount >= limit

  // 1. Check if date is in the past
  if (dateStr < cairoNow.dateStr) {
    return {
      iso: dateStr,
      dateStr,
      dayKey,
      dayName,
      label,
      subLabel,
      formattedDate,
      status: 'past',
      statusLabel: isRtl ? 'تاريخ سابق' : 'Past Date',
      isSelectable: false,
      isFull,
      bookedCount,
      limit,
      shifts: [],
      workingHoursLabel: isRtl ? 'غير متاح' : 'Unavailable',
      reason: isRtl ? 'لا يمكن حجز موعد في تاريخ سابق' : 'Cannot book appointments in past dates'
    }
  }

  // 2. Check manual pause (Clinic or Branch level)
  const isClinicPaused = clinic?.isClinicOpen === false || clinic?.isAcceptingBookings === false
  const isBranchPaused = branch?.isOpen === false
  if (isClinicPaused || isBranchPaused) {
    return {
      iso: dateStr,
      dateStr,
      dayKey,
      dayName,
      label,
      subLabel,
      formattedDate,
      status: 'paused',
      statusLabel: isRtl ? 'مغلق مؤقتاً' : 'Temporarily Closed',
      isSelectable: false,
      isFull,
      bookedCount,
      limit,
      shifts: [],
      workingHoursLabel: isRtl ? 'الحجز متوقف' : 'Booking Paused',
      reason: isRtl ? 'استقبال الحجوزات متوقف مؤقتاً بتعليمات العيادة' : 'Booking is temporarily suspended'
    }
  }

  // 3. Check official vacations / holidays / closed dates list
  const vacations = [
    ...(clinic?.vacations || []),
    ...(clinic?.holidays || []),
    ...(clinic?.closedDates || []),
    ...(branch?.vacations || []),
    ...(branch?.holidays || [])
  ]
  if (vacations.includes(dateStr)) {
    return {
      iso: dateStr,
      dateStr,
      dayKey,
      dayName,
      label,
      subLabel,
      formattedDate,
      status: 'holiday',
      statusLabel: isRtl ? 'إجازة' : 'Holiday',
      isSelectable: false,
      isFull,
      bookedCount,
      limit,
      shifts: [],
      workingHoursLabel: isRtl ? 'إجازة رسمية' : 'Holiday',
      reason: isRtl ? 'هذا التاريخ إجازة رسمية بالعيادة' : 'This date is a scheduled clinic holiday'
    }
  }

  // 4. Check weekly schedule
  const weeklySchedule = branch?.weeklySchedule?.length
    ? branch.weeklySchedule
    : clinic?.weeklySchedule?.length
    ? clinic.weeklySchedule
    : []

  let daySched: DayScheduleItem | undefined
  if (weeklySchedule.length > 0) {
    daySched = weeklySchedule.find((s) => (s.id || s.dayKey)?.toLowerCase() === dayKey)
  }

  if (weeklySchedule.length > 0 && (!daySched || daySched.isOpen === false)) {
    return {
      iso: dateStr,
      dateStr,
      dayKey,
      dayName,
      label,
      subLabel,
      formattedDate,
      status: 'holiday',
      statusLabel: isRtl ? 'إجازة' : 'Day Off',
      isSelectable: false,
      isFull,
      bookedCount,
      limit,
      shifts: [],
      workingHoursLabel: isRtl ? 'عطلة أسبوعية' : 'Weekly Day Off',
      reason: isRtl ? 'العيادة مغلقة في هذا اليوم وفق جدول العمل الأسبوعي' : 'Clinic is closed on this weekday'
    }
  }

  const shifts = extractDayShifts(daySched)
  const workingHoursLabel = formatShiftsSummary(shifts, isRtl)

  // 5. If booking for TODAY: check if all operating shifts have already concluded
  if (dateStr === cairoNow.dateStr && shifts.length > 0) {
    if (isDayReceptionEnded(shifts, cairoNow.totalMinutes)) {
      return {
        iso: dateStr,
        dateStr,
        dayKey,
        dayName,
        label,
        subLabel,
        formattedDate,
        status: 'reception_ended',
        statusLabel: isRtl ? 'انتهى الحجز' : 'Closed for Today',
        isSelectable: false,
        isFull,
        bookedCount,
        limit,
        shifts,
        workingHoursLabel,
        reason: isRtl ? 'انتهت مواعيد استقبال الحجوزات لهذا اليوم' : "Today's operating hours have ended"
      }
    }
  }

  // 6. Check daily booking capacity
  if (isFull) {
    return {
      iso: dateStr,
      dateStr,
      dayKey,
      dayName,
      label,
      subLabel,
      formattedDate,
      status: 'full',
      statusLabel: isRtl ? 'مكتمل' : 'Full',
      isSelectable: false,
      isFull: true,
      bookedCount,
      limit,
      shifts,
      workingHoursLabel,
      reason: CAPACITY_FULL_MESSAGE
    }
  }

  // 7. Day is OPEN & AVAILABLE
  return {
    iso: dateStr,
    dateStr,
    dayKey,
    dayName,
    label,
    subLabel,
    formattedDate,
    status: 'available',
    statusLabel: isRtl ? 'متاح' : 'Available',
    isSelectable: true,
    isFull: false,
    bookedCount,
    limit,
    shifts,
    workingHoursLabel
  }
}

/**
 * Builds the full calendar display list for the booking form.
 * Returns each visible day with its real status (available, full, holiday, reception_ended, paused).
 */
export function filterAvailableDays(options: {
  startDateStr?: string
  maxDaysToScan?: number
  targetCount?: number
  limit: number
  dailyCounts: Record<string, number>
  schedule?: DayScheduleItem[]
  clinic?: any
  branch?: any
  isRtl?: boolean
  customNowDate?: Date
  includeNonSelectable?: boolean
}): DayAvailabilityInfo[] {
  const {
    startDateStr,
    maxDaysToScan = 14,
    targetCount = 6,
    limit,
    dailyCounts = {},
    schedule,
    clinic,
    branch,
    isRtl = true,
    customNowDate,
    includeNonSelectable = false
  } = options

  const cairoNow = getCairoNow(customNowDate)
  const baseDate = startDateStr ? parseDateSafe(startDateStr) : parseDateSafe(cairoNow.dateStr)

  const effectiveClinic = clinic || (schedule ? { weeklySchedule: schedule } : null)
  const effectiveBranch = branch || (schedule ? { weeklySchedule: schedule } : null)

  const list: DayAvailabilityInfo[] = []
  let availableFound = 0

  for (let i = 0; i < maxDaysToScan; i++) {
    const cur = new Date(baseDate.getTime() + i * 86400000)
    const year = cur.getUTCFullYear()
    const month = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cur.getUTCDate()).padStart(2, '0')
    const iso = `${year}-${month}-${day}`

    const info = evaluateDayAvailability({
      dateStr: iso,
      clinic: effectiveClinic,
      branch: effectiveBranch,
      limit,
      dailyCounts,
      customNowDate,
      isRtl
    })

    if (info.isSelectable) {
      availableFound++
      list.push(info)
    } else if (includeNonSelectable) {
      list.push(info)
    }

    // Stop scanning once we've gathered enough available days or reached max target
    if (availableFound >= targetCount && list.length >= targetCount) {
      break
    }
  }

  return list
}

/**
 * Builds the comprehensive booking calendar list including all days
 * with their full evaluation status (available, full, holiday, reception_ended, paused).
 */
export function buildBookingCalendar(options: Parameters<typeof filterAvailableDays>[0]): DayAvailabilityInfo[] {
  return filterAvailableDays({ ...options, includeNonSelectable: true })
}

export interface NearestDateResult {
  nearestDateStr: string
  iso: string
  label: string
  subLabel: string
  formattedDate: string
  wasRequestedDateFull: boolean
  wasRequestedDateClosed: boolean
  reasonMessage: string
  shifts: ScheduleShift[]
}

/**
 * Finds the nearest available date starting from requestedDateStr/startDateStr.
 * Scans forward skipping full days, holidays, closed shifts, and paused dates.
 * Returns null if no dates are available within maxDaysToScan.
 */
export function findNearestAvailableDate(options: {
  requestedDateStr?: string
  startDateStr?: string
  limit: number
  dailyCounts?: Record<string, number>
  schedule?: DayScheduleItem[]
  clinic?: any
  branch?: any
  maxDaysToScan?: number
  isRtl?: boolean
  customNowDate?: Date
}): NearestDateResult | null {
  const {
    requestedDateStr,
    startDateStr,
    limit,
    dailyCounts = {},
    schedule,
    clinic,
    branch,
    maxDaysToScan = 30,
    isRtl = true,
    customNowDate
  } = options

  const cairoNow = getCairoNow(customNowDate)
  const initialDateStr = requestedDateStr || startDateStr || cairoNow.dateStr

  const effectiveClinic = clinic || (schedule ? { weeklySchedule: schedule } : null)
  const effectiveBranch = branch || (schedule ? { weeklySchedule: schedule } : null)

  // Evaluate the initial requested date
  const requestedEval = evaluateDayAvailability({
    dateStr: initialDateStr,
    clinic: effectiveClinic,
    branch: effectiveBranch,
    limit,
    dailyCounts,
    customNowDate,
    isRtl
  })

  // If initial requested date is available, return it directly
  if (requestedEval.isSelectable) {
    return {
      nearestDateStr: requestedEval.iso,
      iso: requestedEval.iso,
      label: requestedEval.label,
      subLabel: requestedEval.subLabel,
      formattedDate: requestedEval.formattedDate,
      wasRequestedDateFull: false,
      wasRequestedDateClosed: false,
      reasonMessage: '',
      shifts: requestedEval.shifts
    }
  }

  const wasRequestedDateFull = requestedEval.status === 'full'
  const wasRequestedDateClosed = requestedEval.status !== 'available'

  let reasonMessage = ''
  if (requestedEval.status === 'full') {
    reasonMessage = isRtl
      ? `اكتملت حجوزات هذا اليوم، تم اختيار أقرب يوم متاح:`
      : `Today's bookings are full. Nearest available date selected:`
  } else if (requestedEval.status === 'reception_ended') {
    reasonMessage = isRtl
      ? `انتهت مواعيد استقبال الحجوزات لهذا اليوم، تم اختيار أقرب يوم متاح:`
      : `Reception hours ended for today. Nearest available date selected:`
  } else if (requestedEval.status === 'holiday') {
    reasonMessage = isRtl
      ? `هذا اليوم إجازة رسمية، تم اختيار أقرب يوم متاح:`
      : `This day is a scheduled holiday. Nearest available date selected:`
  } else if (requestedEval.status === 'paused') {
    reasonMessage = isRtl
      ? `استقبال الحجوزات متوقف لهذا اليوم، تم اختيار أقرب يوم متاح:`
      : `Bookings are paused for this date. Nearest available date selected:`
  } else {
    reasonMessage = isRtl
      ? `الموعد غير متاح، تم اختيار أقرب يوم متاح:`
      : `Selected date unavailable. Nearest available date selected:`
  }

  // Scan ahead to find the next open day with capacity
  const baseDate = parseDateSafe(initialDateStr)
  for (let i = 1; i < maxDaysToScan; i++) {
    const cur = new Date(baseDate.getTime() + i * 86400000)
    const year = cur.getUTCFullYear()
    const month = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cur.getUTCDate()).padStart(2, '0')
    const candidateIso = `${year}-${month}-${day}`

    const candEval = evaluateDayAvailability({
      dateStr: candidateIso,
      clinic: effectiveClinic,
      branch: effectiveBranch,
      limit,
      dailyCounts,
      customNowDate,
      isRtl
    })

    if (candEval.isSelectable) {
      return {
        nearestDateStr: candEval.iso,
        iso: candEval.iso,
        label: candEval.label,
        subLabel: candEval.subLabel,
        formattedDate: candEval.formattedDate,
        wasRequestedDateFull,
        wasRequestedDateClosed,
        reasonMessage: `${reasonMessage} ${candEval.label} (${candEval.subLabel})`,
        shifts: candEval.shifts
      }
    }
  }

  return null
}

/**
 * Unified Server-Side Availability Validator.
 * Re-validates date, hours, schedule, vacations, pause state, and capacity
 * at the moment of booking submission.
 */
export function validateBookingAvailability(options: {
  bookingDate: string
  clinic: any
  branch?: any
  hasMultipleBranches?: boolean
  currentActiveBookings: number
  isRtl?: boolean
  customNowDate?: Date
}): {
  isValid: boolean
  error?: string
  status: DayStatus
  effectiveLimit: number
  nextAvailableDate?: string | null
  nextAvailableFormatted?: string | null
} {
  const {
    bookingDate,
    clinic,
    branch,
    hasMultipleBranches = false,
    currentActiveBookings,
    isRtl = true,
    customNowDate
  } = options

  const effectiveLimit = resolveEffectiveDailyLimit(clinic, branch, hasMultipleBranches)
  const dailyCounts = { [bookingDate]: currentActiveBookings }

  const evalResult = evaluateDayAvailability({
    dateStr: bookingDate,
    clinic,
    branch,
    limit: effectiveLimit,
    dailyCounts,
    customNowDate,
    isRtl
  })

  if (evalResult.isSelectable) {
    return {
      isValid: true,
      status: 'available',
      effectiveLimit
    }
  }

  // Not valid: find nearest available suggestion
  const nearest = findNearestAvailableDate({
    requestedDateStr: bookingDate,
    limit: effectiveLimit,
    dailyCounts,
    clinic,
    branch,
    isRtl,
    customNowDate
  })

  let localizedError = evalResult.reason || 'الموعد المحدد غير متاح للحجز حالياً'
  if (evalResult.status === 'full') {
    localizedError = CAPACITY_FULL_MESSAGE
  } else if (evalResult.status === 'reception_ended') {
    localizedError = isRtl
      ? 'انتهت مواعيد استقبال الحجوزات لهذا اليوم. برجاء اختيار موعد آخر.'
      : "Today's operating hours have ended. Please choose another date."
  } else if (evalResult.status === 'holiday') {
    localizedError = isRtl
      ? 'العيادة مغلقة في هذا التاريخ (عطلة أو إجازة رسمية). برجاء اختيار موعد آخر.'
      : 'Clinic is closed on this date (Holiday or Day Off).'
  } else if (evalResult.status === 'paused') {
    localizedError = isRtl
      ? 'استقبال الحجوزات متوقف مؤقتاً في هذا الفرع. برجاء المحاولة لاحقاً.'
      : 'Booking is temporarily paused for this branch.'
  } else if (evalResult.status === 'past') {
    localizedError = isRtl
      ? 'لا يمكن حجز موعد في تاريخ سابق.'
      : 'Cannot book appointments in past dates.'
  }

  return {
    isValid: false,
    error: localizedError,
    status: evalResult.status,
    effectiveLimit,
    nextAvailableDate: nearest?.nearestDateStr || null,
    nextAvailableFormatted: nearest?.formattedDate || null
  }
}
