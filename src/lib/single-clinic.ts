/**
 * Single Clinic Configuration & Enforcement
 * Clinic OS V2 is locked strictly to a Single Clinic System.
 */

import { collection, query, where, getDocs, limit, Firestore } from 'firebase/firestore'

export const SINGLE_CLINIC_SLUG = 'zizo'

export interface SingleClinicMeta {
  slug: string
  id?: string
  clinicName: string
  doctorName: string
  isLocked: boolean
}

/**
 * Fetch the single active clinic document from Firestore.
 */
export async function getSingleClinic(db: Firestore): Promise<any | null> {
  const q = query(collection(db, 'clinics'), where('slug', '==', SINGLE_CLINIC_SLUG), limit(1))
  const snap = await getDocs(q)
  if (!snap.empty) {
    const doc = snap.docs[0]
    return { id: doc.id, ...doc.data() }
  }

  // Fallback: fetch any first clinic doc if slug is slightly different
  const allQ = query(collection(db, 'clinics'), limit(1))
  const allSnap = await getDocs(allQ)
  if (!allSnap.empty) {
    const doc = allSnap.docs[0]
    return { id: doc.id, ...doc.data() }
  }

  return null
}

/**
 * Enforce that no second clinic can be created in the database.
 * Throws an error if an attempt is made to create an additional clinic.
 */
export async function assertCanCreateClinic(db: Firestore, targetSlug: string = SINGLE_CLINIC_SLUG): Promise<void> {
  const snap = await getDocs(collection(db, 'clinics'))
  if (snap.size >= 1) {
    throw new Error('SINGLE_CLINIC_VIOLATION: هذا النظام مخصص لعيادة واحدة فقط. لا يمكن إنشاء عيادة إضافية.')
  }
}
