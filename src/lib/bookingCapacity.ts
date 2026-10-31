/**
 * Unified Booking Capacity & Scheduling Utilities
 * Ensures single source of truth across Clinic Settings, Branch Management,
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

export interface DayScheduleItem {
  id?: string
  dayKey?: string
  isOpen?: boolean
}

export interface AvailableDayItem {
  iso: string
  label: string
  subLabel: string
  formattedDate: string
  dayName: string
  isFull: boolean
  bookedCount: number
  limit: number
}

/**
 * Filters available booking days from a start date, skipping scheduled holidays
 * and completely excluding days that have reached capacity.
 */
export function filterAvailableDays(options: {
  startDateStr?: string
  maxDaysToScan?: number
  targetCount?: number
  limit: number
  dailyCounts: Record<string, number>
  schedule?: DayScheduleItem[]
  isRtl?: boolean
}): AvailableDayItem[] {
  const {
    startDateStr,
    maxDaysToScan = 14,
    targetCount = 6,
    limit,
    dailyCounts,
    schedule = [],
    isRtl = true,
  } = options

  const list: AvailableDayItem[] = []
  const baseDate = startDateStr ? parseDateSafe(startDateStr) : parseDateSafe(getCairoDateString())

  for (let i = 0; i < maxDaysToScan; i++) {
    const cur = new Date(baseDate.getTime() + i * 86400000)
    const year = cur.getUTCFullYear()
    const month = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cur.getUTCDate()).padStart(2, '0')
    const iso = `${year}-${month}-${day}`

    const dayIndex = cur.getUTCDay()
    const dayKey = DAY_KEYS[dayIndex]
    const dayName = isRtl ? DAY_NAMES_AR[dayIndex] : DAY_NAMES_EN[dayIndex]

    // 1. Check weekly schedule: if closed/holiday, skip
    if (schedule && schedule.length > 0) {
      const daySched = schedule.find((s) => (s.id || s.dayKey) === dayKey)
      if (daySched && daySched.isOpen === false) {
        continue
      }
    }

    // 2. Check capacity: if booked >= limit, exclude completely from available list
    const booked = Number(dailyCounts[iso]) || 0
    const isFull = limit > 0 && booked >= limit
    if (isFull) {
      continue
    }

    let label = dayName
    if (i === 0) label = isRtl ? 'اليوم' : 'Today'
    else if (i === 1) label = isRtl ? 'غداً' : 'Tomorrow'

    const monthName = isRtl ? MONTH_NAMES_AR[cur.getUTCMonth()] : MONTH_NAMES_EN[cur.getUTCMonth()]
    const subLabel = `${cur.getUTCDate()} ${monthName}`
    const formattedDate = `${cur.getUTCDate()} ${monthName}`

    list.push({
      iso,
      label,
      subLabel,
      formattedDate,
      dayName,
      isFull: false,
      bookedCount: booked,
      limit,
    })

    if (list.length >= targetCount) break
  }

  return list
}

export interface NearestDateResult {
  nearestDateStr: string
  iso: string
  label: string
  subLabel: string
  wasRequestedDateFull: boolean
  formattedDate: string
}

/**
 * Finds the nearest available date starting from requestedDateStr/startDateStr.
 * If the requested date is full or closed, scans ahead to find the next open day with capacity.
 * Returns null if no dates are available within maxDaysToScan.
 */
export function findNearestAvailableDate(options: {
  requestedDateStr?: string
  startDateStr?: string
  limit: number
  dailyCounts: Record<string, number>
  schedule?: DayScheduleItem[]
  maxDaysToScan?: number
  isRtl?: boolean
}): NearestDateResult | null {
  const {
    requestedDateStr,
    startDateStr,
    limit,
    dailyCounts,
    schedule = [],
    maxDaysToScan = 30,
    isRtl = true,
  } = options

  const initialDateStr = requestedDateStr || startDateStr || getCairoDateString()
  const baseDate = parseDateSafe(initialDateStr)

  // Check if initial requested date was full
  const requestedBooked = Number(dailyCounts[initialDateStr]) || 0
  const isInitialFull = limit > 0 && requestedBooked >= limit

  for (let i = 0; i < maxDaysToScan; i++) {
    const cur = new Date(baseDate.getTime() + i * 86400000)
    const year = cur.getUTCFullYear()
    const month = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cur.getUTCDate()).padStart(2, '0')
    const iso = `${year}-${month}-${day}`

    const dayIndex = cur.getUTCDay()
    const dayKey = DAY_KEYS[dayIndex]

    // Skip closed schedule days
    if (schedule && schedule.length > 0) {
      const daySched = schedule.find((s) => (s.id || s.dayKey) === dayKey)
      if (daySched && daySched.isOpen === false) {
        continue
      }
    }

    // Check capacity
    const booked = Number(dailyCounts[iso]) || 0
    if (limit <= 0 || booked < limit) {
      const monthName = isRtl ? MONTH_NAMES_AR[cur.getUTCMonth()] : MONTH_NAMES_EN[cur.getUTCMonth()]
      const dayName = isRtl ? DAY_NAMES_AR[dayIndex] : DAY_NAMES_EN[dayIndex]
      const dayNum = cur.getUTCDate()
      const formatted = `${dayName} (${dayNum} ${monthName})`
      return {
        nearestDateStr: iso,
        iso,
        label: dayName,
        subLabel: `${dayNum} ${monthName}`,
        wasRequestedDateFull: isInitialFull || i > 0,
        formattedDate: formatted,
      }
    }
  }

  return null
}
