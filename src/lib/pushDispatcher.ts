import 'server-only'
import { readDocument, writeDocument, createDocument, queryDocumentsByField } from '@/lib/server/firebase-rest'
import { isValidPushEndpoint, sendWebPushNotification } from '@/lib/webPushServer'

export interface PushSubscriptionRecord {
  id: string
  clinicId: string
  role: 'patient' | 'staff'
  endpoint: string
  keys: { p256dh: string; auth: string }
  appointmentIds: string[]
  status: 'active' | 'deactivated' | 'expired'
  userAgent?: string
  createdAt: string
  updatedAt: string
  lastDeliveryAt?: string
  lastTestAt?: string
  failureCount?: number
}

export async function getSubscriptionId(endpoint: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))
  return 'sub_' + [...bytes].map(v => v.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export async function registerDeviceSubscription({
  subscription, appointmentId, clinicId, userAgent, role = 'patient',
}: {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  appointmentId?: string
  clinicId?: string
  patientPhone?: string
  userAgent?: string
  role?: 'patient' | 'staff'
}): Promise<{ success: boolean; subscriptionId: string }> {
  if (!clinicId || !/^[A-Za-z0-9_-]{1,128}$/.test(clinicId) ||
      !isValidPushEndpoint(subscription?.endpoint) ||
      !subscription?.keys?.p256dh || !subscription?.keys?.auth ||
      subscription.keys.p256dh.length > 256 || subscription.keys.auth.length > 256 ||
      (role === 'patient' && !appointmentId)) {
    throw new Error('INVALID_PUSH_SUBSCRIPTION')
  }
  const id = await getSubscriptionId(subscription.endpoint)
  const existing = await readDocument(`push_subscriptions/${id}`)
  // An endpoint is a device credential. On a new authorization, replace any
  // prior clinic ownership; never leak alerts across clinic accounts.
  const sameScope = existing?.clinicId === clinicId && existing.role === role
  const appointmentIds = sameScope && Array.isArray(existing?.appointmentIds)
    ? existing.appointmentIds.filter((a: unknown): a is string => typeof a === 'string')
    : []
  if (appointmentId && !appointmentIds.includes(appointmentId)) appointmentIds.push(appointmentId)
  const now = new Date().toISOString()
  await writeDocument(`push_subscriptions/${id}`, {
    id, clinicId, role,
    endpoint: subscription.endpoint, keys: subscription.keys,
    appointmentIds: appointmentIds.slice(-50),
    status: 'active', userAgent: String(userAgent || '').slice(0, 256),
    createdAt: sameScope && existing?.createdAt ? existing.createdAt : now,
    updatedAt: now, lastDeliveryAt: sameScope ? (existing?.lastDeliveryAt || null) : null,
    lastTestAt: sameScope ? (existing?.lastTestAt || null) : null,
    failureCount: 0,
  })
  return { success: true, subscriptionId: id }
}

export async function findSubscribersForAppointment({
  appointmentId, clinicId, recipientType = 'patient',
}: {
  appointmentId?: string
  patientPhone?: string
  clinicId?: string
  recipientType?: 'patient' | 'staff'
}): Promise<PushSubscriptionRecord[]> {
  if (!clinicId) return []
  const rows = await queryDocumentsByField('push_subscriptions', 'clinicId', clinicId, 100)
  return rows.filter((row: any) =>
    row.status === 'active' && row.role === recipientType &&
    isValidPushEndpoint(row.endpoint) && row.keys?.p256dh && row.keys?.auth &&
    (recipientType === 'staff' || (
      appointmentId && Array.isArray(row.appointmentIds) &&
      row.appointmentIds.includes(appointmentId)
    ))
  ) as unknown as PushSubscriptionRecord[]
}

export async function unsubscribeDevice({
  endpoint, appointmentId, clinicId, role,
}: {
  endpoint: string
  appointmentId?: string
  clinicId?: string
  role?: 'patient' | 'staff'
}) {
  const id = await getSubscriptionId(endpoint)
  const record = await readDocument(`push_subscriptions/${id}`)
  if (!record || record.clinicId !== clinicId || record.role !== role) {
    return { success: false }
  }
  const remaining = (Array.isArray(record.appointmentIds) ? record.appointmentIds : [])
    .filter((a: unknown) => a !== appointmentId)
  const shouldDeactivate = role === 'staff' || remaining.length === 0
  await writeDocument(`push_subscriptions/${id}`, {
    appointmentIds: remaining,
    status: shouldDeactivate ? 'deactivated' : 'active',
    updatedAt: new Date().toISOString(),
  }, true)
  return { success: true }
}

export async function dispatchPatientPushNotification({
  type, appointmentId, clinicId, title, body, icon, url, tag, eventId,
  ttl, urgency, recipientType = 'patient',
}: {
  type: string
  appointmentId?: string
  clinicId: string
  branchId?: string
  patientPhone?: string
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
  eventId?: string
  ttl?: number
  urgency?: 'low' | 'normal' | 'high'
  recipientType?: 'patient' | 'staff'
}) {
  if (!clinicId || !title || !body || !['patient','staff'].includes(recipientType) ||
      (recipientType === 'patient' && !appointmentId)) throw new Error('INVALID_PUSH_DISPATCH')
  const subscribers = await findSubscribersForAppointment({ appointmentId, clinicId, recipientType })
  let deliveredCount = 0, failedCount = 0
  for (const sub of subscribers) {
    const eventKey = `${clinicId}:${eventId || type + '_' + appointmentId}:${sub.id}`
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(eventKey)))
    const outboxId = 'push_' + [...digest].map(x => x.toString(16).padStart(2,'0')).join('').slice(0, 40)
    const path = `push_outbox/${outboxId}`
    const old = await readDocument(path)
    if (old?.status === 'delivered') { deliveredCount++; continue }
    const payload = {
      title: title.slice(0, 100), body: body.slice(0, 300),
      icon: icon || '/brand/yalla-clinic/app-icon.png',
      badge: '/favicon-32x32.png',
      url: url || '/', tag: tag || `yalla-${type}-${appointmentId || 'staff'}`,
      type, appointmentId, ttl: ttl || 900, urgency: urgency || 'normal' as const,
    }
    if (!old) {
      try {
        await createDocument('push_outbox', {
          idempotencyKey: eventKey, clinicId, appointmentId: appointmentId || null,
          subscriptionId: sub.id, status: 'processing', attempts: 1,
          createdAt: new Date().toISOString(),
        }, outboxId)
      } catch (e) {
        if (!(e instanceof Error) || e.message !== 'RATE_LIMITED') throw e
        // Another runner created the same event. Do not send it twice.
        continue
      }
    }
    const result = await sendWebPushNotification(
      { endpoint: sub.endpoint, keys: sub.keys }, payload)
    const now = new Date().toISOString()
    if (result.success) {
      deliveredCount++
      await writeDocument(path, { status: 'delivered', deliveredAt: now }, true)
      await writeDocument(`push_subscriptions/${sub.id}`, {
        lastDeliveryAt: now, failureCount: 0,
      }, true)
    } else {
      failedCount++
      await writeDocument(path, {
        status: result.gone ? 'expired' : 'pending',
        lastError: String(result.error || 'PUSH_GATEWAY_FAILED').slice(0, 150),
        nextAttemptAt: new Date(Date.now() + 60000).toISOString(),
      }, true)
      if (result.gone) await writeDocument(`push_subscriptions/${sub.id}`, {
        status: 'expired', updatedAt: now,
      }, true)
    }
  }
  return {
    success: failedCount === 0 && subscribers.length > 0,
    matchedSubscribers: subscribers.length, deliveredCount, failedCount,
    message: subscribers.length === 0 ? 'NO_REGISTERED_DEVICES' :
      `PUSH_GATEWAY_ACCEPTED:${deliveredCount};FAILED:${failedCount}`,
  }
}
