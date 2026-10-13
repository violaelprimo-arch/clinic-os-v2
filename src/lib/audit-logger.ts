/**
 * Audit Logger for recording sensitive clinic events.
 * Logs are stored in the 'audit_logs' collection in Firestore.
 */

import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cairoDate } from '@/lib/clinic-domain'

export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'ROLE_CHANGE'
  | 'SERVICE_PRICE_UPDATE'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_DISCOUNT_APPLIED'
  | 'PRESCRIPTION_CREATED'
  | 'QUEUE_ORDER_CHANGE'
  | 'EXPENSE_RECORDED'
  | 'SETTINGS_UPDATED'
  | 'CLINIC_STATUS_TOGGLED'
  | 'BACKUP_EXPORTED'

export interface AuditLogEntry {
  action: AuditAction
  actorName: string
  actorRole: 'owner' | 'doctor' | 'assistant' | 'patient' | 'system'
  clinicId: string
  details: Record<string, any>
  createdAt?: string
  cairoDate?: string
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<string | null> {
  try {
    const payload = {
      ...entry,
      cairoDate: cairoDate(new Date()),
      createdAt: new Date().toISOString()
    }
    const docRef = await addDoc(collection(db, 'audit_logs'), payload)
    return docRef.id
  } catch (err) {
    console.error('Failed to write audit log:', err)
    return null
  }
}
