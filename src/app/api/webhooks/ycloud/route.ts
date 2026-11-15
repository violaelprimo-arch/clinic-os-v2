import { NextRequest, NextResponse } from 'next/server'
import {
  getYCloudWebhookSecret,
  verifyYCloudWebhookSignature,
  listWabaPhoneNumbers
} from '@/lib/server/ycloud-service'
import {
  readDocument,
  writeDocument,
  queryDocumentsByField
} from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json'
}

/**
 * Real YCloud Webhook Endpoint: https://yalla-clinic.com/api/webhooks/ycloud
 * Subscribes to events:
 * - whatsapp.business_account.updated
 * - whatsapp.message.updated
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Capture exact raw request body text before JSON parsing
    const rawBody = await req.text()
    if (!rawBody) {
      return NextResponse.json({ error: 'EMPTY_BODY' }, { status: 400, headers: noStore })
    }

    // 2. Verify YCloud-Signature header
    const signatureHeader =
      req.headers.get('ycloud-signature') || req.headers.get('YCloud-Signature')
    const webhookSecret = getYCloudWebhookSecret()

    if (webhookSecret) {
      const verification = verifyYCloudWebhookSignature(rawBody, signatureHeader, webhookSecret)
      if (!verification.valid) {
        console.warn('[YCloud Webhook] Signature verification failed:', verification.error)
        return NextResponse.json(
          { error: 'INVALID_SIGNATURE', reason: verification.error },
          { status: 401, headers: noStore }
        )
      }
    } else {
      console.warn(
        '[YCloud Webhook] YCLOUD_WEBHOOK_SECRET is not configured on server. Skipping cryptographic verification.'
      )
    }

    // 3. Parse JSON safely
    let event: any
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON_BODY' }, { status: 400, headers: noStore })
    }

    const eventId = String(event?.id || '').trim()
    const eventType = String(event?.type || '').trim()

    if (!eventId || !eventType) {
      return NextResponse.json({ error: 'MISSING_EVENT_METADATA' }, { status: 400, headers: noStore })
    }

    // 4. Idempotency check: prevent duplicate event processing
    try {
      const existingEvent = await readDocument(`whatsapp_webhook_events/${eventId}`)
      if (existingEvent) {
        return NextResponse.json({ received: true, deduplicated: true }, { status: 200, headers: noStore })
      }
      // Record event receipt immediately
      await writeDocument(
        `whatsapp_webhook_events/${eventId}`,
        {
          id: eventId,
          type: eventType,
          createTime: event?.createTime || new Date().toISOString(),
          processedAt: new Date().toISOString()
        },
        true
      )
    } catch (e) {
      console.warn('[YCloud Webhook] Idempotency record warning:', e)
    }

    // 5. Process Supported Event Types
    if (eventType === 'whatsapp.business_account.updated') {
      const waba = event.whatsappBusinessAccount || {}
      const wabaId = String(waba.id || '').trim()
      const partnerCustomerId = String(waba.partnerCustomerId || '').trim()

      if (partnerCustomerId) {
        console.log(`[YCloud Webhook] WABA updated for clinic ${partnerCustomerId} (WABA: ${wabaId})`)

        let clinicPhoneNumber: string | null = null
        let phoneNumberId: string | null = null
        let verifiedName: string | null = null
        let phoneStatus: string = 'CONNECTED'

        // Query YCloud to list actual registered phone numbers for this WABA
        if (wabaId) {
          try {
            const phones = await listWabaPhoneNumbers(wabaId)
            if (phones.length > 0) {
              const primary = phones[0]
              clinicPhoneNumber = primary.phoneNumber
              phoneNumberId = primary.id
              verifiedName = primary.verifiedName || null
              phoneStatus = primary.status || 'CONNECTED'
            }
          } catch (phoneErr) {
            console.warn('[YCloud Webhook] Fetch phone numbers warning:', phoneErr)
          }
        }

        const isConnected = phoneStatus.toUpperCase() === 'CONNECTED' && Boolean(clinicPhoneNumber)
        const now = new Date().toISOString()

        await writeDocument(
          `clinic_whatsapp_configs/${partnerCustomerId}`,
          {
            clinicId: partnerCustomerId,
            wabaId: wabaId || null,
            phoneNumber: clinicPhoneNumber || null,
            phoneNumberId: phoneNumberId || null,
            businessName: verifiedName || waba.name || null,
            status: isConnected ? 'connected' : 'linking',
            linkedAt: isConnected ? now : null,
            lastSyncAt: now,
            lastError: null
          },
          true
        ).catch(() => {})

        // Also reflect phone number in clinics root doc
        if (clinicPhoneNumber) {
          await writeDocument(
            `clinics/${partnerCustomerId}`,
            {
              whatsappPhoneNumber: clinicPhoneNumber,
              whatsappWabaId: wabaId || null,
              whatsappPhoneNumberId: phoneNumberId || null,
              whatsappLinkedAt: now
            },
            true
          ).catch(() => {})
        }
      }
    } else if (eventType === 'whatsapp.message.updated') {
      const msg = event.whatsappMessage || {}
      const messageId = String(msg.id || '').trim()
      const wamid = String(msg.wamid || '').trim()
      const status = String(msg.status || '').toLowerCase() // queued, accepted, sent, delivered, read, failed
      const errorMsg = msg.error?.message || msg.errorMessage || null

      console.log(`[YCloud Webhook] Message ${messageId || wamid} updated to status: ${status}`)

      // Find corresponding WhatsApp job in database
      let jobs: any[] = []
      if (messageId) {
        jobs = await queryDocumentsByField('whatsapp_jobs', 'ycloudMessageId', messageId, 5).catch(() => [])
      }
      if (jobs.length === 0 && wamid) {
        jobs = await queryDocumentsByField('whatsapp_jobs', 'ycloudWamid', wamid, 5).catch(() => [])
      }

      if (jobs.length > 0) {
        const job = jobs[0]
        const now = new Date().toISOString()
        const patch: Record<string, unknown> = {
          status,
          updatedAt: now
        }

        if (status === 'delivered') patch.deliveredAt = now
        if (status === 'failed') patch.lastError = errorMsg || 'MESSAGE_DELIVERY_FAILED'

        await writeDocument(`whatsapp_jobs/${job.id}`, patch, true).catch(() => {})

        // Update clinic statistics
        const clinicId = job.clinicId
        if (clinicId) {
          const statsPatch: Record<string, unknown> = { lastSyncAt: now }
          if (status === 'delivered') {
            statsPatch['stats.deliveredCount'] = (Number(job.stats?.deliveredCount) || 0) + 1
          } else if (status === 'read') {
            statsPatch['stats.readCount'] = (Number(job.stats?.readCount) || 0) + 1
          } else if (status === 'failed') {
            statsPatch['stats.failedCount'] = (Number(job.stats?.failedCount) || 0) + 1
          }
          await writeDocument(`clinic_whatsapp_configs/${clinicId}`, statsPatch, true).catch(() => {})
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200, headers: noStore })
  } catch (err: any) {
    console.error('[YCloud Webhook] Handler error:', err)
    return NextResponse.json(
      { error: 'WEBHOOK_INTERNAL_ERROR', detail: err?.message || '' },
      { status: 500, headers: noStore }
    )
  }
}

/**
 * Handle GET for webhook test / status verification
 */
export async function GET() {
  const hasSecret = Boolean(getYCloudWebhookSecret())
  const hasApiKey = Boolean(process.env.YCLOUD_API_KEY)
  return NextResponse.json(
    {
      service: 'YCloud WhatsApp Webhook',
      status: 'active',
      configured: {
        apiKey: hasApiKey,
        webhookSecret: hasSecret
      },
      supportedEvents: ['whatsapp.business_account.updated', 'whatsapp.message.updated'],
      timestamp: new Date().toISOString()
    },
    { headers: noStore }
  )
}
