import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Meta WhatsApp Webhook Endpoint
 * Handles verification handshake (GET) and delivery status receipts (POST).
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'clinic-os-meta-webhook-verify-token-2026'

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification token mismatch' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Process delivery statuses from Meta Cloud API
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (value?.statuses && Array.isArray(value.statuses)) {
      for (const statusObj of value.statuses) {
        const messageId = statusObj.id
        const newStatus = statusObj.status // 'sent', 'delivered', 'read', 'failed'
        const timestamp = statusObj.timestamp

        // Update corresponding record in notification_outbox
        try {
          const q = query(
            collection(db, 'notification_outbox'),
            where('providerMessageId', '==', messageId)
          )
          const snap = await getDocs(q)
          if (!snap.empty) {
            const outboxDoc = snap.docs[0]
            await updateDoc(doc(db, 'notification_outbox', outboxDoc.id), {
              status: newStatus,
              updatedAt: new Date().toISOString(),
              metaStatusTimestamp: timestamp
            })
          }
        } catch (updateErr) {
          console.error('Failed to update outbox status for msg:', messageId, updateErr)
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 400 })
  }
}
