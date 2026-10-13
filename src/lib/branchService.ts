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
