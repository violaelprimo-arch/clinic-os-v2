import 'server-only'
import { readDocument, writeDocument, createDocument, queryDocumentsByField } from '@/lib/server/firebase-rest'
import { isValidPushEndpoint, sendWebPushNotification, getVapidConfig } from '@/lib/webPushServer'

export interface PushSubscriptionRecord {
  id: string
  clinicId: string
  role: 'patient' | 'staff'
  endpoint: string
  keys: { p256dh: string; auth: string }
  appointmentIds: string[]
  status: 'active' | 'deactivated' | 'expired'
  userAgent?: string
  vapidPublicKey?: string
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
  const currentVapidKey = getVapidConfig().publicKey
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
    vapidPublicKey: currentVapidKey,
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
  const currentVapidKey = getVapidConfig().publicKey
  return rows.filter((row: any) =>
    row.status === 'active' && row.role === recipientType &&
    row.vapidPublicKey === currentVapidKey &&
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

export interface PushDispatchDeps {
  readDocument: typeof readDocument
  writeDocument: typeof writeDocument
  createDocument: typeof createDocument
  queryDocumentsByField: typeof queryDocumentsByField
  sendWebPushNotification: typeof sendWebPushNotification
  getVapidConfig: typeof getVapidConfig
  now?: () => number
}

const defaultDispatchDeps: PushDispatchDeps = {
  readDocument,
  writeDocument,
  createDocument,
  queryDocumentsByField,
  sendWebPushNotification,
  getVapidConfig,
  now: () => Date.now(),
}

const SHORT_PUSH_TAG_PREFIX: Record<string, string> = {
  approaching_turn: 'appr',
  turn_ready: 'turn',
  booking_confirmed: 'book',
  booking_cancelled: 'cncl',
  booking_rescheduled: 'rsch',
  test_notification: 'push-test',
}

function sanitizeTagPart(value: string, maxLen: number): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(-maxLen)
}

/** Build an RFC 8030 Topic-safe tag (<= 32 chars) preserving trailing ID entropy. */
export function buildPushTag(type: string, targetId?: string, salt?: string): string {
  const prefix = SHORT_PUSH_TAG_PREFIX[type] || sanitizeTagPart(type, 8) || 'msg'
  const idPart = sanitizeTagPart(String(targetId || 'staff'), 14) || 's'
  const saltPart = salt ? sanitizeTagPart(String(salt), 8) : ''
  return (saltPart ? `${prefix}-${idPart}-${saltPart}` : `${prefix}-${idPart}`).slice(0, 32)
}

/** Generate a unique <= 32-char tag per test push so consecutive tests never collapse. */
export function buildDeviceTestTag(): string {
  return `push-test-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 32)
}

/** Canonical idempotency key for an appointment approaching_turn step. */
export function getApproachingEventId(appt: Record<string, any>, ahead: number): string {
  const cycle = appt.requeuedAt ? `_${String(appt.requeuedAt)}` : ''
  return `approaching_${appt.id}_${ahead}${cycle}`
}

/** Canonical idempotency key for a turn_ready call vs explicit recall. */
export function getTurnReadyEventId(
  appt: Record<string, any>,
  action: 'start' | 'skip' | 'recall',
  calledAt: string,
): string {
  if (action === 'recall') {
    return `turn_ready_${appt.id}_recall_${calledAt}`
  }
  const cycle = String(appt.requeuedAt || appt.skippedAt || appt.noShowAt || '0')
  return `turn_ready_${appt.id}_call_${cycle}`
}

/** Immediately send a verified test notification to a registered device with zero cooldown. */
export async function executeDeviceTestPush({
  endpoint,
  clinicId,
  clinicSlug,
  appointmentId,
  role = 'patient',
}: {
  endpoint: string
  clinicId: string
  clinicSlug?: string
  appointmentId?: string
  role?: 'patient' | 'staff'
}, deps: Partial<PushDispatchDeps> = {}): Promise<
  | { ok: true; status: 200; gatewayStatus?: number; tag: string; message: string }
  | { ok: false; status: 403 | 502; error: string; gatewayStatus?: number }
> {
  const io = { ...defaultDispatchDeps, ...deps }
  const id = await getSubscriptionId(endpoint)
  const path = `push_subscriptions/${id}`
  const sub = await io.readDocument(path)
  if (
    !sub || sub.endpoint !== endpoint || sub.status !== 'active' ||
    sub.clinicId !== clinicId || sub.role !== role ||
    sub.vapidPublicKey !== io.getVapidConfig().publicKey ||
    (role === 'patient' && (!Array.isArray(sub.appointmentIds) ||
      !appointmentId || !sub.appointmentIds.includes(appointmentId)))
  ) {
    return { ok: false, status: 403, error: 'DEVICE_NOT_REGISTERED_FOR_THIS_BOOKING' }
  }

  const tag = buildDeviceTestTag()
  const result = await io.sendWebPushNotification({
    endpoint: String(sub.endpoint),
    keys: sub.keys as { p256dh: string; auth: string },
  }, {
    title: 'اختبار إشعارات Yalla Clinic',
    body: 'تم إرسال تنبيه تجريبي لجهازك. إذا ظهر في شريط النظام فالخدمة تعمل.',
    url: role === 'patient' && appointmentId && clinicSlug
      ? `/clinic/${encodeURIComponent(String(clinicSlug))}/track/${encodeURIComponent(String(appointmentId))}`
      : '/',
    type: 'test_notification',
    tag,
    ttl: 120,
    urgency: 'high',
  })

  const nowIso = new Date(io.now ? io.now() : Date.now()).toISOString()
  if (!result.success) {
    if (result.gone) {
      await io.writeDocument(path, { status: 'expired', updatedAt: nowIso }, true).catch(() => {})
    }
    return {
      ok: false,
      status: 502,
      error: result.error || 'PUSH_GATEWAY_REJECTED',
      gatewayStatus: result.status,
    }
  }

  await io.writeDocument(path, {
    lastTestAt: nowIso,
    lastDeliveryAt: nowIso,
    failureCount: 0,
  }, true).catch(() => {})

  return {
    ok: true,
    status: 200,
    gatewayStatus: result.status,
    tag,
    message: 'تم قبول الإشعار بواسطة خدمة Push، تأكد من وصوله لشريط إشعارات جهازك.',
  }
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
}, deps: Partial<PushDispatchDeps> = {}) {
  if (!clinicId || !title || !body || !['patient','staff'].includes(recipientType) ||
      (recipientType === 'patient' && !appointmentId)) throw new Error('INVALID_PUSH_DISPATCH')
  const io = { ...defaultDispatchDeps, ...deps }
  const subscribers = deps.queryDocumentsByField || deps.getVapidConfig
    ? ((await io.queryDocumentsByField('push_subscriptions', 'clinicId', clinicId, 100)).filter((row: any) =>
      row.status === 'active' && row.role === recipientType &&
      row.vapidPublicKey === io.getVapidConfig().publicKey &&
      isValidPushEndpoint(row.endpoint) && row.keys?.p256dh && row.keys?.auth &&
      (recipientType === 'staff' || (
        appointmentId && Array.isArray(row.appointmentIds) &&
        row.appointmentIds.includes(appointmentId)
      ))
    ) as unknown as PushSubscriptionRecord[])
    : await findSubscribersForAppointment({ appointmentId, clinicId, recipientType })
  let deliveredCount = 0, failedCount = 0
  const nowMs = io.now ? io.now() : Date.now()
  for (const sub of subscribers) {
    const eventKey = `${clinicId}:${eventId || type + '_' + appointmentId}:${sub.id}`
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(eventKey)))
    const outboxId = 'push_' + [...digest].map(x => x.toString(16).padStart(2,'0')).join('').slice(0, 40)
    const path = `push_outbox/${outboxId}`
    const old = await io.readDocument(path)
    if (old?.status === 'delivered') { deliveredCount++; continue }
    if (old?.status === 'expired' || old?.status === 'failed') continue
    if (old?.status === 'processing') {
      const createdAtMs = old.createdAt ? Date.parse(String(old.createdAt)) : Number.NaN
      if (!Number.isFinite(createdAtMs) || nowMs - createdAtMs < 60000) continue
    }
    const resolvedTag = tag ? tag.slice(0, 32) : buildPushTag(type, appointmentId)
    const payload = {
      title: title.slice(0, 100), body: body.slice(0, 300),
      icon: icon || '/brand/yalla-clinic/app-icon.png',
      badge: '/favicon-32x32.png',
      url: url || '/', tag: resolvedTag,
      type, appointmentId, ttl: ttl || 900, urgency: urgency || 'normal' as const,
    }
    if (!old) {
      try {
        await io.createDocument('push_outbox', {
          idempotencyKey: eventKey, clinicId, appointmentId: appointmentId || null,
          subscriptionId: sub.id, status: 'processing', attempts: 1,
          recipientType, payload,
          nextAttemptAt: new Date(nowMs + 60000).toISOString(),
          createdAt: new Date(nowMs).toISOString(),
        }, outboxId)
      } catch (e) {
        if (!(e instanceof Error) || e.message !== 'RATE_LIMITED') throw e
        // Another runner created the same event. Do not send it twice.
        continue
      }
    } else {
      await io.writeDocument(path, {
        status: 'processing',
        attempts: Math.max(1, Number(old.attempts || 1)) + 1,
        createdAt: new Date(nowMs).toISOString(),
      }, true).catch(() => {})
    }
    const result = await io.sendWebPushNotification(
      { endpoint: sub.endpoint, keys: sub.keys }, payload)
    const now = new Date(io.now ? io.now() : Date.now()).toISOString()
    if (result.success) {
      deliveredCount++
      await io.writeDocument(path, { status: 'delivered', deliveredAt: now }, true)
      await io.writeDocument(`push_subscriptions/${sub.id}`, {
        lastDeliveryAt: now, failureCount: 0,
      }, true)
    } else {
      failedCount++
      await io.writeDocument(path, {
        status: result.gone ? 'expired' : 'pending',
        lastError: String(result.error || 'PUSH_GATEWAY_FAILED').slice(0, 150),
        nextAttemptAt: new Date(nowMs + 60000).toISOString(),
      }, true)
      if (result.gone) await io.writeDocument(`push_subscriptions/${sub.id}`, {
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
