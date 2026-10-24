import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  limit,
} from 'firebase/firestore'
import { sendWebPushNotification } from '@/lib/webPushServer'
import { getSubscriptionId, PushSubscriptionRecord } from '@/lib/pushDispatcher'

/**
 * Background worker/cron endpoint for processing pending outbox push tasks
 * POST /api/push/outbox/process
 */
export async function POST() {
  try {
    const now = new Date().toISOString()
    const q = query(
      collection(db, 'push_outbox'),
      where('status', '==', 'pending'),
      where('nextAttemptAt', '<=', now),
      limit(25)
    )

    const snap = await getDocs(q)
    let processed = 0
    let delivered = 0
    let failed = 0

    for (const taskDoc of snap.docs) {
      const task = taskDoc.data() as any
      processed++

      // Lock task
      await updateDoc(doc(db, 'push_outbox', taskDoc.id), {
        status: 'processing',
        attempts: (task.attempts || 1) + 1,
      })

      // Get current subscriber keys
      const subSnap = await getDocs(
        query(
          collection(db, 'push_subscriptions'),
          where('endpoint', '==', task.endpoint),
          limit(1)
        )
      )

      if (subSnap.empty || subSnap.docs[0].data().status !== 'active') {
        await updateDoc(doc(db, 'push_outbox', taskDoc.id), {
          status: 'expired',
          lastError: 'Subscriber no longer active',
        })
        failed++
        continue
      }

      const subscriber = subSnap.docs[0].data() as PushSubscriptionRecord
      const result = await sendWebPushNotification(
        {
          endpoint: subscriber.endpoint,
          keys: subscriber.keys,
        },
        task.payload
      )

      if (result.success) {
        delivered++
        await updateDoc(doc(db, 'push_outbox', taskDoc.id), {
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
        })
      } else {
        failed++
        const attempts = (task.attempts || 1) + 1
        if (result.gone || attempts >= 5) {
          await updateDoc(doc(db, 'push_outbox', taskDoc.id), {
            status: result.gone ? 'expired' : 'failed',
            lastError: result.error,
          })
          if (result.gone) {
            await updateDoc(doc(db, 'push_subscriptions', subscriber.id), {
              status: 'expired',
              updatedAt: new Date().toISOString(),
            })
          }
        } else {
          const delayMinutes = Math.pow(2, attempts) // 2, 4, 8, 16 mins
          await updateDoc(doc(db, 'push_outbox', taskDoc.id), {
            status: 'pending',
            nextAttemptAt: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
            lastError: result.error,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      delivered,
      failed,
    })
  } catch (err: any) {
    console.error('Error in outbox processor:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
