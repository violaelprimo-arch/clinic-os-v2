import 'server-only'
import {
  createDocument, queryDocumentsByField, readDocument, writeDocument,
} from '@/lib/server/firebase-rest'

export type NotificationRecord = {
  id: string
  clinicId: string
  branchId?: string | null
  recipientType: 'staff' | 'doctor' | 'patient'
  recipientTarget: string
  title: string
  body: string
  type: string
  eventId?: string | null
  appointmentId?: string | null
  isRead: boolean
  createdAt: string
}

export async function listServerNotifications(
  clinicId: string,
  recipientType: 'staff' | 'patient',
  recipientTarget?: string,
  branchId?: string,
): Promise<NotificationRecord[]> {
  const records = await queryDocumentsByField('notifications', 'clinicId', clinicId, 100)
  const normalizedTarget = String(recipientTarget || '').replace(/\D/g, '').replace(/^20/, '0')
  return records.filter((n: any) => {
    if (recipientType === 'staff') {
      return (n.recipientType === 'staff' || n.recipientType === 'doctor') &&
        (!branchId || branchId === 'all' || !n.branchId || n.branchId === branchId)
    }
    return n.recipientType === 'patient' &&
      String(n.recipientTarget || '').replace(/\D/g, '').replace(/^20/, '0') === normalizedTarget
  }).map((n: any) => ({
    id: String(n.id),
    clinicId: String(n.clinicId),
    branchId: n.branchId || null,
    recipientType: n.recipientType,
    recipientTarget: String(n.recipientTarget || ''),
    title: String(n.title || ''),
    body: String(n.body || ''),
    type: String(n.type || 'system'),
    eventId: n.eventId || null,
    appointmentId: n.appointmentId || null,
    isRead: n.isRead === true,
    createdAt: String(n.createdAt || ''),
  })).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0,50)
}

export async function createServerNotification(
  event: Omit<NotificationRecord,'id'|'isRead'|'createdAt'> & { eventId: string },
): Promise<string> {
  if (!event.eventId || !event.clinicId) throw new Error('INVALID_NOTIFICATION_EVENT')
  const raw = new TextEncoder().encode(`${event.clinicId}:${event.eventId}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw))
  const id = 'event_' + [...digest].map(v => v.toString(16).padStart(2, '0')).join('').slice(0,48)
  // Existing event? Avoid re-creating it every five-second feed poll.
  if (await readDocument(`notifications/${id}`)) return id
  try {
    await createDocument('notifications', {
      ...event, isRead: false, createdAt: new Date().toISOString(),
    }, id)
  } catch (error) {
    // Conflict on the deterministic document ID means this event already exists.
    // Any other database failure must be surfaced and logged by its caller.
    if (!(error instanceof Error) || error.message !== 'RATE_LIMITED') throw error
  }
  return id
}

export async function markServerNotificationRead(
  id: string,
  clinicId: string,
  recipientType: 'staff' | 'patient',
  recipientTarget?: string,
): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return false
  const item = await readDocument(`notifications/${id}`)
  if (!item || item.clinicId !== clinicId) return false
  if (recipientType === 'patient') {
    const normalize = (p: unknown) => String(p || '').replace(/\D/g, '').replace(/^20/, '0')
    if (item.recipientType !== 'patient' || normalize(item.recipientTarget) !== normalize(recipientTarget)) return false
  } else if (item.recipientType !== 'doctor' && item.recipientType !== 'staff') {
    return false
  }
  await writeDocument(`notifications/${id}`, { isRead: true }, true)
  return true
}
