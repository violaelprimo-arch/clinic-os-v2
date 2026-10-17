import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  writeBatch
} from 'firebase/firestore'
import { Branch, BranchScheduleDay } from '@/types/clinic'

export const DEFAULT_WEEKLY_SCHEDULE: BranchScheduleDay[] = [
  { id: 'saturday', day: 'السبت', isOpen: true, start: '09:00', end: '22:00' },
  { id: 'sunday', day: 'الأحد', isOpen: true, start: '09:00', end: '22:00' },
  { id: 'monday', day: 'الاثنين', isOpen: true, start: '09:00', end: '22:00' },
  { id: 'tuesday', day: 'الثلاثاء', isOpen: true, start: '09:00', end: '22:00' },
  { id: 'wednesday', day: 'الأربعاء', isOpen: true, start: '09:00', end: '22:00' },
  { id: 'thursday', day: 'الخميس', isOpen: true, start: '09:00', end: '22:00' },
  { id: 'friday', day: 'الجمعة', isOpen: false, start: '09:00', end: '22:00' }
]

/**
 * Calculates approximate straight-line distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10 // Rounded to 1 decimal place
}

/**
 * Checks if two time intervals overlap (e.g., '14:00' - '18:00' and '16:00' - '20:00').
 */
export function doTimeIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && startB < endA
}

/**
 * Detects schedule conflicts between branches for the same doctor.
 * Returns an array of human-readable conflict messages in Arabic.
 */
export function checkScheduleConflicts(
  branches: Branch[],
  candidateBranch?: Partial<Branch>
): string[] {
  const conflicts: string[] = []
  const allBranches = candidateBranch?.id
    ? branches.map((b) => (b.id === candidateBranch.id ? { ...b, ...candidateBranch } : b))
    : candidateBranch
    ? [...branches, candidateBranch as Branch]
    : branches

  const activeBranches = allBranches.filter((b) => b.isOpen && !b.isArchived)

  for (let i = 0; i < activeBranches.length; i++) {
    for (let j = i + 1; j < activeBranches.length; j++) {
      const bA = activeBranches[i]
      const bB = activeBranches[j]

      for (const dayA of bA.weeklySchedule || []) {
        if (!dayA.isOpen) continue
        const dayB = (bB.weeklySchedule || []).find((d) => d.id === dayA.id)
        if (dayB && dayB.isOpen) {
          if (doTimeIntervalsOverlap(dayA.start, dayA.end, dayB.start, dayB.end)) {
            conflicts.push(
              `تعارض مواعيد يوم (${dayA.day}): فرع "${bA.name}" (${dayA.start} - ${dayA.end}) يتعارض مع فرع "${bB.name}" (${dayB.start} - ${dayB.end})`
            )
          }
        }
      }
    }
  }

  return conflicts
}

/**
 * Ensures that a clinic has at least one default branch ("الفرع الرئيسي")
 * and securely links existing appointments without losing IDs or historic data.
 */
export async function ensureClinicHasMainBranch(clinic: any): Promise<Branch> {
  const clinicId = clinic.id || clinic.slug
  const branchesRef = collection(db, 'branches')
  const q = query(branchesRef, where('clinicId', '==', clinicId))
  const snap = await getDocs(q)

  if (!snap.empty) {
    const existingBranches = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Branch[]
    const mainBranch = existingBranches.find((b) => b.isMain) || existingBranches[0]
    if (clinic.weeklySchedule && clinic.weeklySchedule.length > 0 && (!mainBranch.weeklySchedule || mainBranch.weeklySchedule.length === 0)) {
      mainBranch.weeklySchedule = clinic.weeklySchedule
    }
    return mainBranch
  }

  // Create default main branch
  const schedule = clinic.weeklySchedule && clinic.weeklySchedule.length > 0
    ? clinic.weeklySchedule
    : DEFAULT_WEEKLY_SCHEDULE

  const defaultBranchData: Omit<Branch, 'id'> = {
    clinicId,
    name: 'الفرع الرئيسي',
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: clinic.clinicAddress || 'المقر الرئيسي',
    address: clinic.clinicAddress || 'عنوان العيادة الرئيسي',
    mapsLink: clinic.mapsLink || '',
    phone: clinic.clinicPhone || (clinic.clinicPhones?.[0] || '01012345678'),
    whatsapp: clinic.clinicPhone || '',
    weeklySchedule: schedule,
    workingHours: formatWeeklyScheduleSummary(schedule, true),
    slotDuration: clinic.averageVisitTime || 15,
    maxDailyBookings: clinic.maxDailyBookings || 0,
    services: clinic.services || [
      { id: '1', name: 'كشف عادي', price: 250, duration: '15 دقيقة' },
      { id: '2', name: 'استشارة', price: 150, duration: '10 دقائق' },
      { id: '3', name: 'كشف مستعجل', price: 400, duration: 'فوري' }
    ],
    isOpen: clinic.isClinicOpen !== false,
    isArchived: false,
    isMain: true,
    createdAt: new Date().toISOString()
  }

  const newDocRef = await addDoc(branchesRef, defaultBranchData)
  const createdBranch: Branch = { id: newDocRef.id, ...defaultBranchData }

  // Gracefully link unassigned appointments to this main branch in batches
  try {
    const apptsRef = collection(db, 'appointments')
    const apptsQuery = query(apptsRef, where('clinic_id', '==', clinicId))
    const apptsSnap = await getDocs(apptsQuery)

    const unassigned = apptsSnap.docs.filter((d) => !d.data().branch_id)
    if (unassigned.length > 0) {
      const batch = writeBatch(db)
      unassigned.forEach((docSnap) => {
        batch.update(doc(db, 'appointments', docSnap.id), {
          branch_id: newDocRef.id,
          branchName: 'الفرع الرئيسي'
        })
      })
      await batch.commit()
    }
  } catch (err) {
    console.warn('Branch backfill warning:', err)
  }

  return createdBranch
}

/**
 * Fetches all active (non-archived) branches for a clinic.
 */
export async function getClinicBranches(clinicId: string): Promise<Branch[]> {
  try {
    const branchesRef = collection(db, 'branches')
    const q = query(branchesRef, where('clinicId', '==', clinicId))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Branch[]
  } catch (err) {
    console.error('Error fetching branches:', err)
    return []
  }
}

/**
 * Formats a 24-hour time string (e.g. '09:00', '22:00', '14:30') into 12-hour format ('9:00 ص', '10:00 م', '2:30 م').
 */
export function formatTime12h(time24: string, isRtl: boolean = true): string {
  if (!time24 || !time24.includes(':')) return time24 || ''
  const [hourStr, minStr] = time24.split(':')
  let hour = parseInt(hourStr, 10)
  const mins = minStr || '00'
  if (isNaN(hour)) return time24

  const isPm = hour >= 12
  if (hour === 0) {
    hour = 12
  } else if (hour > 12) {
    hour -= 12
  }

  if (isRtl) {
    return `${hour}:${mins} ${isPm ? 'م' : 'ص'}`
  } else {
    return `${hour}:${mins} ${isPm ? 'PM' : 'AM'}`
  }
}

export interface WeeklyScheduleDisplayGroup {
  daysLabel: string
  hoursLabel: string
  isOpen: boolean
}

/**
 * Groups consecutive days with identical operating hours into clean display groups.
 */
export function getWeeklyScheduleDisplayGroups(
  schedule?: any[],
  isRtl: boolean = true
): WeeklyScheduleDisplayGroup[] {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return [
      {
        daysLabel: isRtl ? 'السبت - الخميس' : 'Sat - Thu',
        hoursLabel: isRtl ? '9:00 ص - 10:00 م' : '9:00 AM - 10:00 PM',
        isOpen: true
      },
      {
        daysLabel: isRtl ? 'الجمعة' : 'Friday',
        hoursLabel: isRtl ? 'مغلق' : 'Closed',
        isOpen: false
      }
    ]
  }

  const dayOrder = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  const dayNamesAr: Record<string, string> = {
    saturday: 'السبت',
    sunday: 'الأحد',
    monday: 'الإثنين',
    tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء',
    thursday: 'الخميس',
    friday: 'الجمعة'
  }
  const dayNamesEn: Record<string, string> = {
    saturday: 'Sat',
    sunday: 'Sun',
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri'
  }

  const sorted = [...schedule].sort((a, b) => {
    const idxA = dayOrder.indexOf(a.id || a.dayKey || '')
    const idxB = dayOrder.indexOf(b.id || b.dayKey || '')
    return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99)
  })

  const groups: { days: string[]; isOpen: boolean; start: string; end: string }[] = []

  for (const item of sorted) {
    const dayKey = item.id || item.dayKey || item.day
    const isOpen = item.isOpen !== false
    const start = item.start || '09:00'
    const end = item.end || '22:00'

    const lastGroup = groups[groups.length - 1]
    if (
      lastGroup &&
      lastGroup.isOpen === isOpen &&
      (!isOpen || (lastGroup.start === start && lastGroup.end === end))
    ) {
      lastGroup.days.push(dayKey)
    } else {
      groups.push({
        days: [dayKey],
        isOpen,
        start,
        end
      })
    }
  }

  return groups.map((g) => {
    const firstKey = g.days[0]
    const lastKey = g.days[g.days.length - 1]
    const firstName = isRtl ? dayNamesAr[firstKey] || firstKey : dayNamesEn[firstKey] || firstKey
    const lastName = isRtl ? dayNamesAr[lastKey] || lastKey : dayNamesEn[lastKey] || lastKey

    let daysLabel = ''
    if (g.days.length === 7) {
      daysLabel = isRtl ? 'طوال أيام الأسبوع' : 'Everyday'
    } else if (g.days.length === 1) {
      daysLabel = firstName
    } else {
      daysLabel = `${firstName} - ${lastName}`
    }

    let hoursLabel = ''
    if (!g.isOpen) {
      hoursLabel = isRtl ? 'مغلق' : 'Closed'
    } else {
      hoursLabel = `${formatTime12h(g.start, isRtl)} - ${formatTime12h(g.end, isRtl)}`
    }

    return { daysLabel, hoursLabel, isOpen: g.isOpen }
  })
}

/**
 * Returns a single-line human-readable summary of weekly operating hours.
 */
export function formatWeeklyScheduleSummary(schedule?: any[], isRtl: boolean = true): string {
  const groups = getWeeklyScheduleDisplayGroups(schedule, isRtl)
  const openGroups = groups.filter((g) => g.isOpen)
  if (openGroups.length === 0) {
    return isRtl ? 'مغلق حالياً' : 'Currently closed'
  }
  return openGroups.map((g) => `${g.daysLabel}: ${g.hoursLabel}`).join(' • ')
}

/**
 * Checks whether the clinic or branch is currently open right now according to its schedule.
 */
export function isClinicOpenNow(schedule?: any[]): boolean {
  if (!Array.isArray(schedule) || schedule.length === 0) return true
  const now = new Date()
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayKey = dayKeys[now.getDay()]
  const daySchedule = schedule.find((s) => (s.id || s.dayKey) === todayKey)
  if (!daySchedule || daySchedule.isOpen === false) return false

  const curHour = now.getHours()
  const curMin = now.getMinutes()
  const curMins = curHour * 60 + curMin

  const [startH, startM] = (daySchedule.start || '00:00').split(':').map(Number)
  const [endH, endM] = (daySchedule.end || '23:59').split(':').map(Number)

  const startMins = (isNaN(startH) ? 0 : startH) * 60 + (isNaN(startM) ? 0 : startM)
  const endMins = (isNaN(endH) ? 23 : endH) * 60 + (isNaN(endM) ? 59 : endM)

  return curMins >= startMins && curMins <= endMins
}

/**
 * Synchronizes the updated clinic weekly schedule and working hours to the clinic's main branch.
 */
export async function syncClinicScheduleToMainBranch(
  clinicId: string,
  weeklySchedule: BranchScheduleDay[],
  workingHoursSummary?: string
): Promise<void> {
  try {
    const branchesRef = collection(db, 'branches')
    const q = query(branchesRef, where('clinicId', '==', clinicId))
    const snap = await getDocs(q)
    if (snap.empty) return

    const summary = workingHoursSummary || formatWeeklyScheduleSummary(weeklySchedule)
    const batch = writeBatch(db)

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data()
      // If it's the main branch, or if the clinic only has 1 branch, sync schedule
      if (data.isMain || snap.docs.length === 1) {
        batch.update(doc(db, 'branches', docSnap.id), {
          weeklySchedule,
          workingHours: summary
        })
      }
    })

    await batch.commit()
  } catch (err) {
    console.warn('Failed to sync clinic schedule to main branch:', err)
  }
}

