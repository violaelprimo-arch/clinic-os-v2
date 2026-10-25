import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  runTransaction
} from 'firebase/firestore'

export interface AtomicAppointmentInput {
  clinic_id: string
  branch_id?: string | null
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
  transferNumber?: string
  transferReference?: string
  transferProofUrl?: string
  [key: string]: any
}

/**
 * Atomically generates the next sequential queue number and creates the appointment doc
 * inside a single Firestore transaction.
 *
 * This completely prevents race-condition collisions when multiple patients
 * submit booking requests simultaneously.
 */
export async function createAtomicAppointment(
  data: AtomicAppointmentInput
): Promise<{ id: string; queueNumber: number }> {
  const clinicId = data.clinic_id
  const dateStr = data.date

  if (!clinicId || !dateStr) {
    throw new Error('clinic_id and date are required for atomic appointment booking.')
  }

  // Counter document path per clinic & date
  const counterRef = doc(db, 'clinic_daily_counters', `${clinicId}_${dateStr}`)

  // 1. Read existing appointments as a fallback baseline (outside transaction)
  // in case this is the first booking of the day or counters were not initialized yet
  const q = query(
    collection(db, 'appointments'),
    where('clinic_id', '==', clinicId),
    where('date', '==', dateStr)
  )
  const snap = await getDocs(q)
  const existingNums = snap.docs.map((d) => Number(d.data().queue_number) || 0)
  const maxExisting = existingNums.length > 0 ? Math.max(0, ...existingNums) : 0

  // 2. Run Firestore transaction to atomically lock the counter and write the appointment
  const result = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef)
    let currentCounter = 0
    if (counterSnap.exists()) {
      currentCounter = Number(counterSnap.data()?.lastQueueNumber) || 0
    }

    const assignedQueueNumber = Math.max(currentCounter, maxExisting) + 1

    // Atomically increment counter
    transaction.set(
      counterRef,
      {
        clinicId,
        date: dateStr,
        lastQueueNumber: assignedQueueNumber,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    )

    // Prepare appointment document
    const newDocRef = doc(collection(db, 'appointments'))
    const newApptData = {
      ...data,
      queue_number: assignedQueueNumber,
      status: data.status || 'waiting',
      createdAt: data.createdAt || new Date().toISOString()
    }

    transaction.set(newDocRef, newApptData)

    return {
      id: newDocRef.id,
      queueNumber: assignedQueueNumber
    }
  })

  return result
}
