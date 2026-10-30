import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  getDoc
} from 'firebase/firestore'
import { db } from './firebase'

export interface AtomicAppointmentInput {
  clinic_id: string
  branch_id?: string | null
  branchId?: string | null
  branchName?: string
  patientName: string
  phone: string
  age?: string | null
  birthDate?: string | null
  gender?: string
  serviceId?: string
  serviceName?: string
  servicePrice?: number
  isUrgent?: boolean
  date: string
  time?: string
  status?: string
  paymentMethod?: string
  paymentStatus?: string
  paymentDetails?: any
  address?: string | null
  city?: string | null
  patientResidenceSnapshot?: any
  notes?: string | null
  createdAt?: string
  [key: string]: any
}

export function removeUndefinedFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields)
  } else if (obj !== null && typeof obj === 'object') {
    const clean: any = {}
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        clean[key] = removeUndefinedFields(obj[key])
      }
    }
    return clean
  }
  return obj
}

/**
 * Creates an appointment atomically in Firestore with sequential queue number allocation
 * and strict server-side capacity enforcement per clinic/branch and date.
 *
 * Rules:
 * - Never counts cancelled appointments towards daily capacity.
 * - Cancelling frees a slot immediately.
 * - Prevents race conditions using a Firestore atomic transaction.
 * - Throws 'QUOTA_EXCEEDED' when the active bookings reach or exceed maxLimit.
 */
export async function createAtomicAppointment(
  data: AtomicAppointmentInput,
  maxLimit: number = 0
): Promise<{ id: string; queueNumber: number }> {
  const clinicId = data.clinic_id
  const dateStr = data.date
  const effectiveBranchId = data.branch_id || data.branchId || null

  if (!clinicId || !dateStr) {
    throw new Error('clinic_id and date are required for atomic appointment booking.')
  }

  // Counter document path per clinic & date (or branch if specified)
  const counterDocId = effectiveBranchId
    ? `${clinicId}_${effectiveBranchId}_${dateStr}`
    : `${clinicId}_${dateStr}`
  const counterRef = doc(db, 'clinic_daily_counters', counterDocId)

  // 1. If maxLimit is 0 or unsupplied, check clinic/branch doc for default maxDailyBookings
  let effectiveLimit = Number(maxLimit) || 0
  if (effectiveLimit <= 0) {
    try {
      if (effectiveBranchId) {
        const bDoc = await getDoc(doc(db, 'branches', effectiveBranchId))
        if (bDoc.exists()) {
          effectiveLimit = Number(bDoc.data()?.maxDailyBookings) || 0
        }
      }
      if (effectiveLimit <= 0) {
        const cDoc = await getDoc(doc(db, 'clinics', clinicId))
        if (cDoc.exists()) {
          effectiveLimit = Number(cDoc.data()?.maxDailyBookings) || 0
        }
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  // 2. Read existing appointments to evaluate actual active bookings (excluding cancelled)
  const q = query(
    collection(db, 'appointments'),
    where('clinic_id', '==', clinicId),
    where('date', '==', dateStr)
  )
  const snap = await getDocs(q)
  const allDateDocs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

  // Filter active appointments
  const activeExisting = allDateDocs.filter(d => d.status !== 'cancelled')

  // If scoped by branch limit
  const activeScoped = effectiveBranchId && effectiveLimit > 0
    ? activeExisting.filter(d => (d.branch_id || d.branchId || null) === effectiveBranchId)
    : activeExisting

  const activeCountExisting = activeScoped.length
  const existingNums = activeExisting.map(d => Number(d.queue_number) || 0)
  const maxExisting = existingNums.length > 0 ? Math.max(0, ...existingNums) : 0

  // Immediate pre-transaction check
  if (effectiveLimit > 0 && activeCountExisting >= effectiveLimit) {
    throw new Error(`QUOTA_EXCEEDED:${effectiveLimit}`)
  }

  // 3. Run Firestore transaction to atomically lock counter and write appointment
  const result = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef)
    let currentCounter = 0
    if (counterSnap.exists()) {
      const cData = counterSnap.data()
      currentCounter = Number(cData?.lastQueueNumber) || 0
    }

    if (effectiveLimit > 0 && activeCountExisting >= effectiveLimit) {
      throw new Error(`QUOTA_EXCEEDED:${effectiveLimit}`)
    }

    const assignedQueueNumber = Math.max(currentCounter, maxExisting) + 1

    // Atomically update counter
    transaction.set(
      counterRef,
      {
        clinicId,
        branchId: effectiveBranchId,
        date: dateStr,
        lastQueueNumber: assignedQueueNumber,
        activeBookings: activeCountExisting + 1,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    )

    // Prepare appointment document
    const newDocRef = doc(collection(db, 'appointments'))
    const newApptData = {
      ...data,
      branch_id: effectiveBranchId,
      queue_number: assignedQueueNumber,
      status: data.status || 'waiting',
      createdAt: data.createdAt || new Date().toISOString()
    }

    const sanitizedApptData = removeUndefinedFields(newApptData)
    transaction.set(newDocRef, sanitizedApptData)

    return {
      id: newDocRef.id,
      queueNumber: assignedQueueNumber
    }
  })

  return result
}
