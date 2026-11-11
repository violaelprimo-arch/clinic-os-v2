import 'server-only'
import {
  queryDocumentsByField, readDocument, writeDocument,
  acquireFirestoreLease, releaseFirestoreLease,
} from '@/lib/server/firebase-rest'
import { sendWebPushNotification, getVapidConfig } from '@/lib/webPushServer'

/** Retry temporary Web Push gateway failures from Cloudflare's scheduled handler. */
export async function processPendingPushOutbox(maxBatch = 20) {
  const pending = await queryDocumentsByField('push_outbox', 'status', 'pending', 100)
  const eligible = pending.filter((item: any) => !item.nextAttemptAt ||
    Date.parse(String(item.nextAttemptAt)) <= Date.now()).slice(0, Math.min(maxBatch, 50))
  let delivered = 0, failed = 0
  for (const item of eligible) {
    const id = String(item.id)
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) continue
    const runId = crypto.randomUUID()
    const lockPath = `sync_locks/push_retry_${id}`
    const lease = await acquireFirestoreLease(lockPath, runId, 'push_outbox_cron', 120000)
    if (!lease.acquired) continue
    try {
      const fresh = await readDocument(`push_outbox/${id}`)
      if (!fresh || fresh.status !== 'pending') continue
      const attempts = Math.max(1, Number(fresh.attempts || 1)) + 1
      if (attempts > 5) {
        await writeDocument(`push_outbox/${id}`, { status:'failed', attempts }, true)
        failed++
        continue
      }
      const subscriptionId = String(fresh.subscriptionId || '')
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(subscriptionId)) {
        await writeDocument(`push_outbox/${id}`, { status:'expired' }, true)
        failed++
        continue
      }
      const subscription = await readDocument(`push_subscriptions/${subscriptionId}`)
      const role = fresh.recipientType === 'staff' ? 'staff' : 'patient'
      const valid = subscription?.status === 'active' &&
        subscription?.vapidPublicKey === getVapidConfig().publicKey &&
        subscription?.clinicId === fresh.clinicId && subscription?.role === role &&
        (role === 'staff' ||
          (Array.isArray(subscription?.appointmentIds) &&
            subscription.appointmentIds.includes(fresh.appointmentId)))
      if (!valid || !fresh.payload || typeof fresh.payload !== 'object') {
        await writeDocument(`push_outbox/${id}`, {
          status:'expired', lastError:'SUBSCRIPTION_NOT_ACTIVE',
        }, true)
        failed++
        continue
      }
      const payload = fresh.payload as Record<string, any>
      if (typeof payload.title !== 'string' || typeof payload.body !== 'string') {
        await writeDocument(`push_outbox/${id}`, { status: 'expired' }, true)
        failed++
        continue
      }
      const result = await sendWebPushNotification({
        endpoint: String(subscription!.endpoint),
        keys: subscription!.keys as { p256dh: string; auth: string },
      }, {
        title: payload.title, body: payload.body,
        icon: payload.icon, badge: payload.badge,
        url: payload.url, tag: payload.tag, type: payload.type,
        appointmentId: payload.appointmentId, ttl: payload.ttl,
        urgency: payload.urgency,
      })
      if (result.success) {
        delivered++
        await writeDocument(`push_outbox/${id}`, {
          status:'delivered', deliveredAt:new Date().toISOString(), attempts,
        }, true)
        await writeDocument(`push_subscriptions/${subscriptionId}`, {
          lastDeliveryAt:new Date().toISOString(), failureCount:0,
        }, true)
      } else {
        failed++
        const exhausted = attempts >= 5
        await writeDocument(`push_outbox/${id}`, {
          status: result.gone ? 'expired' : exhausted ? 'failed' : 'pending',
          attempts, lastError:String(result.error || 'GATEWAY_FAILED').slice(0,150),
          nextAttemptAt:new Date(Date.now() + Math.min(15, 2 ** attempts) * 60000).toISOString(),
        }, true)
        if (result.gone) await writeDocument(`push_subscriptions/${subscriptionId}`, {
          status:'expired', updatedAt:new Date().toISOString(),
        }, true)
      }
    } catch (error) {
      failed++
      console.warn('[push-outbox] Retry error:', error instanceof Error ? error.message : 'UNKNOWN')
    } finally {
      await releaseFirestoreLease(lockPath, runId).catch(() => {})
    }
  }
  return { processed: eligible.length, delivered, failed }
}
