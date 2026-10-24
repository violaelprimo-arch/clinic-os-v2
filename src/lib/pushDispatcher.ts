import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  addDoc,
  limit,
} from 'firebase/firestore'
import { sendWebPushNotification, WebPushSendResult } from './webPushServer'

export interface PushSubscriptionRecord {
  id: string
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  appointments?: Record<
    string,
    {
      clinicId: string
      branchId?: string
      patientPhone?: string
      subscribedAt: string
      active: boolean
    }
  >
  appointmentIds?: string[]
  clinicIds?: string[]
  phones?: string[]
  status: 'active' | 'deactivated' | 'expired'
  userAgent?: string
  createdAt: string
  updatedAt: string
  lastDeliveryAt?: string
  failureCount?: number
}

export interface PushOutboxTask {
  id?: string
  idempotencyKey: string
  type: string
  appointmentId?: string
  clinicId: string
  branchId?: string
  patientPhone?: string
  subscriptionId: string
  endpoint: string
  payload: {
    title: string
    body: string
    icon?: string
    badge?: string
    url?: string
    tag?: string
    type?: string
    appointmentId?: string
    ttl?: number
    urgency?: 'low' | 'normal' | 'high'
  }
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'expired'
  attempts: number
  nextAttemptAt: string
  lastError?: string
  createdAt: string
  deliveredAt?: string
}

/**
 * Computes a deterministic SHA-256 hash for a push endpoint.
 */
export async function getSubscriptionId(endpoint: string): Promise<string> {
  const enc = new TextEncoder().encode(endpoint)
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sub_${hex.slice(0, 32)}`
}

/**
 * Finds all active subscriptions registered for a given appointment or patient phone.
 * Supports both modern unified schema and backwards-compatible legacy records.
 */
export async function findSubscribersForAppointment({
  appointmentId,
  patientPhone,
  clinicId,
}: {
  appointmentId?: string
  patientPhone?: string
  clinicId?: string
}): Promise<PushSubscriptionRecord[]> {
  const subscribersMap = new Map<string, PushSubscriptionRecord>()

  // 1. Query modern unified push_subscriptions by appointmentId
  if (appointmentId) {
    try {
      const q = query(
        collection(db, 'push_subscriptions'),
        where('appointmentIds', 'array-contains', appointmentId),
        where('status', '==', 'active')
      )
      const snap = await getDocs(q)
      snap.forEach((d) => {
        subscribersMap.set(d.id, { id: d.id, ...(d.data() as any) })
      })
    } catch (err) {
      console.warn('Error querying push_subscriptions by appointmentId:', err)
    }
  }

  // 2. Query legacy pushSubscriptions collection by appointmentId for compatibility
  if (appointmentId) {
    try {
      const qLegacy = query(
        collection(db, 'pushSubscriptions'),
        where('appointmentId', '==', appointmentId)
      )
      const legacySnap = await getDocs(qLegacy)
      for (const d of legacySnap.docs) {
        const data = d.data() as any
        const endpoint = data.endpoint || data.subscription?.endpoint
        const keys = data.keys || data.subscription?.keys
        if (endpoint && keys?.p256dh && keys?.auth) {
          const subId = await getSubscriptionId(endpoint)
          if (!subscribersMap.has(subId)) {
            subscribersMap.set(subId, {
              id: subId,
              endpoint,
              keys,
              appointmentIds: [appointmentId],
              status: 'active',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            })
          }
        }
      }
    } catch (err) {
      console.warn('Error querying legacy pushSubscriptions:', err)
    }
  }

  // 3. Fallback: Query by patient phone if no subscribers found by appointmentId
  if (subscribersMap.size === 0 && patientPhone) {
    const cleanPhone = patientPhone.trim().replace(/\s+/g, '')
    try {
      const qPhone = query(
        collection(db, 'push_subscriptions'),
        where('phones', 'array-contains', cleanPhone),
        where('status', '==', 'active')
      )
      const phoneSnap = await getDocs(qPhone)
      phoneSnap.forEach((d) => {
        subscribersMap.set(d.id, { id: d.id, ...(d.data() as any) })
      })
    } catch (err) {
      console.warn('Error querying push_subscriptions by phone:', err)
    }
  }

  return Array.from(subscribersMap.values())
}

/**
 * Registers or updates a device subscription with appointment linking.
 * Never wipes out previously linked appointments on the same device.
 */
export async function registerDeviceSubscription({
  subscription,
  appointmentId,
  clinicId,
  patientPhone,
  userAgent,
}: {
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
  appointmentId?: string
  clinicId?: string
  patientPhone?: string
  userAgent?: string
}): Promise<{ success: boolean; subscriptionId: string }> {
  const subId = await getSubscriptionId(subscription.endpoint)
  const docRef = doc(db, 'push_subscriptions', subId)
  const now = new Date().toISOString()

  let existingData: Partial<PushSubscriptionRecord> = {}
  try {
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      existingData = snap.data() as PushSubscriptionRecord
    }
  } catch (err) {
    console.warn('Error reading existing subscription record:', err)
  }

  const appointments = existingData.appointments || {}
  const appointmentIdsSet = new Set(existingData.appointmentIds || [])
  const clinicIdsSet = new Set(existingData.clinicIds || [])
  const phonesSet = new Set(existingData.phones || [])

  if (appointmentId) {
    appointments[appointmentId] = {
      clinicId: clinicId || '',
      patientPhone: patientPhone || '',
      subscribedAt: now,
      active: true,
    }
    appointmentIdsSet.add(appointmentId)
  }

  if (clinicId) clinicIdsSet.add(clinicId)
  if (patientPhone) phonesSet.add(patientPhone.trim().replace(/\s+/g, ''))

  const record: PushSubscriptionRecord = {
    id: subId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    appointments,
    appointmentIds: Array.from(appointmentIdsSet),
    clinicIds: Array.from(clinicIdsSet),
    phones: Array.from(phonesSet),
    status: 'active',
    userAgent: userAgent || existingData.userAgent || '',
    createdAt: existingData.createdAt || now,
    updatedAt: now,
    failureCount: 0,
  }

  await setDoc(docRef, record, { merge: true })

  // Also maintain backwards-compatible doc in legacy pushSubscriptions
  try {
    const legacyDocRef = doc(db, 'pushSubscriptions', subId)
    await setDoc(
      legacyDocRef,
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        subscription: {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        appointmentId: appointmentId || null,
        clinicId: clinicId || null,
        phone: patientPhone || null,
        updatedAt: now,
      },
      { merge: true }
    )
  } catch {}

  return { success: true, subscriptionId: subId }
}

/**
 * Unsubscribes a device from a specific appointment or deactivates it completely.
 */
export async function unsubscribeDevice({
  endpoint,
  appointmentId,
}: {
  endpoint: string
  appointmentId?: string
}): Promise<{ success: boolean }> {
  const subId = await getSubscriptionId(endpoint)
  const docRef = doc(db, 'push_subscriptions', subId)

  try {
    const snap = await getDoc(docRef)
    if (!snap.exists()) return { success: true }

    const data = snap.data() as PushSubscriptionRecord
    const now = new Date().toISOString()

    if (appointmentId && data.appointments && data.appointments[appointmentId]) {
      data.appointments[appointmentId].active = false
      const updatedApptIds = (data.appointmentIds || []).filter((id) => id !== appointmentId)

      await updateDoc(docRef, {
        [`appointments.${appointmentId}.active`]: false,
        appointmentIds: updatedApptIds,
        updatedAt: now,
      })
    } else {
      // Deactivate entire subscription
      await updateDoc(docRef, {
        status: 'deactivated',
        updatedAt: now,
      })
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error during unsubscribe:', err)
    return { success: false }
  }
}

/**
 * Dispatches a centralized patient push notification with Outbox persistence and deduplication.
 */
export async function dispatchPatientPushNotification({
  type,
  appointmentId,
  clinicId,
  branchId,
  patientPhone,
  title,
  body,
  icon,
  url,
  tag,
  ttl,
  urgency,
  eventId,
}: {
  type:
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'booking_rescheduled'
    | 'approaching_turn'
    | 'turn_ready'
    | 'clinic_intake_paused'
    | 'clinic_intake_resumed'
    | 'payment_confirmed'
    | 'prescription_ready'
    | 'test_notification'
  appointmentId?: string
  clinicId: string
  branchId?: string
  patientPhone?: string
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
  ttl?: number
  urgency?: 'low' | 'normal' | 'high'
  eventId?: string
}): Promise<{
  success: boolean
  matchedSubscribers: number
  deliveredCount: number
  failedCount: number
  message: string
}> {
  const idempotencyKey = eventId || `push_${type}_${appointmentId || patientPhone || Date.now()}`

  // Check if this exact idempotencyKey has already been recorded in push_outbox
  if (idempotencyKey) {
    try {
      const qExisting = query(
        collection(db, 'push_outbox'),
        where('idempotencyKey', '==', idempotencyKey),
        limit(1)
      )
      const existingSnap = await getDocs(qExisting)
      if (!existingSnap.empty) {
        const existingData = existingSnap.docs[0].data()
        if (existingData.status === 'delivered') {
          return {
            success: true,
            matchedSubscribers: 1,
            deliveredCount: 1,
            failedCount: 0,
            message: 'Notification previously delivered (idempotency key matched)',
          }
        }
      }
    } catch {}
  }

  // Find target subscribers
  const subscribers = await findSubscribersForAppointment({
    appointmentId,
    patientPhone,
    clinicId,
  })

  if (subscribers.length === 0) {
    return {
      success: true,
      matchedSubscribers: 0,
      deliveredCount: 0,
      failedCount: 0,
      message: 'No active push subscribers found for target appointment/patient',
    }
  }

  let deliveredCount = 0
  let failedCount = 0

  const notificationPayload = {
    title,
    body,
    icon: icon || '/brand/yalla-clinic/app-icon.png',
    badge: '/favicon-32x32.png',
    url: url || (appointmentId ? `/clinic/track/${appointmentId}` : '/'),
    tag: tag || `yalla-${type}-${appointmentId || Date.now()}`,
    type,
    appointmentId,
    ttl: ttl || (type === 'turn_ready' ? 600 : type === 'approaching_turn' ? 300 : 3600),
    urgency: urgency || (type === 'turn_ready' ? 'high' : 'normal'),
  }

  const now = new Date().toISOString()

  // Iterate over each subscriber device
  for (const subscriber of subscribers) {
    const taskKey = `${idempotencyKey}_${subscriber.id}`

    // Create Outbox Task entry
    let outboxRef: any
    try {
      outboxRef = await addDoc(collection(db, 'push_outbox'), {
        idempotencyKey: taskKey,
        type,
        appointmentId: appointmentId || null,
        clinicId,
        branchId: branchId || null,
        patientPhone: patientPhone || null,
        subscriptionId: subscriber.id,
        endpoint: subscriber.endpoint,
        payload: notificationPayload,
        status: 'processing',
        attempts: 1,
        nextAttemptAt: now,
        createdAt: now,
      })
    } catch (err) {
      console.warn('Failed to record outbox entry:', err)
    }

    // Execute send directly
    const result: WebPushSendResult = await sendWebPushNotification(
      {
        endpoint: subscriber.endpoint,
        keys: subscriber.keys,
      },
      notificationPayload
    )

    if (result.success) {
      deliveredCount++
      if (outboxRef) {
        try {
          await updateDoc(outboxRef, {
            status: 'delivered',
            deliveredAt: new Date().toISOString(),
          })
        } catch {}
      }

      // Update subscriber lastDeliveryAt
      try {
        await updateDoc(doc(db, 'push_subscriptions', subscriber.id), {
          lastDeliveryAt: new Date().toISOString(),
          failureCount: 0,
        })
      } catch {}
    } else {
      failedCount++
      const statusUpdate: any = {
        lastError: result.error || 'Unknown gateway error',
      }

      if (result.gone) {
        // Subscription is expired / user uninstalled / revoked permission
        statusUpdate.status = 'expired'
        try {
          await updateDoc(doc(db, 'push_subscriptions', subscriber.id), {
            status: 'expired',
            updatedAt: new Date().toISOString(),
          })
        } catch {}
      } else {
        // Temporary failure: schedule retry
        statusUpdate.status = 'pending'
        statusUpdate.nextAttemptAt = new Date(Date.now() + 60 * 1000).toISOString()
      }

      if (outboxRef) {
        try {
          await updateDoc(outboxRef, statusUpdate)
        } catch {}
      }
    }
  }

  return {
    success: deliveredCount > 0 || (subscribers.length > 0 && failedCount === 0),
    matchedSubscribers: subscribers.length,
    deliveredCount,
    failedCount,
    message: `Push notification dispatched: ${deliveredCount} delivered, ${failedCount} failed`,
  }
}
