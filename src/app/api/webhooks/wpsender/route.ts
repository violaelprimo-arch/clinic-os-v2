import { NextRequest, NextResponse } from 'next/server'
import { handleWpSenderWebhookEvent } from '@/lib/server/whatsapp-scheduler'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

function constantTimeEquals(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function POST(req: NextRequest) {
  const configuredSecret = (process.env.WPSENDER_WEBHOOK_SECRET || '').trim()
  if (configuredSecret) {
    const provided =
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-wp-sender-secret') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
      req.nextUrl.searchParams.get('secret') ||
      ''
    if (!constantTimeEquals(provided, configuredSecret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403, headers: noStore })
    }
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400, headers: noStore })
  }

  const payload = (body.data && typeof body.data === 'object' ? { ...body.data, event: body.event || body.data.event } : body) as Record<string, any>
  const res = await handleWpSenderWebhookEvent({
    event: payload.event ? String(payload.event) : undefined,
    status: payload.status ? String(payload.status) : undefined,
    messageId: payload.message_id || payload.messageId ? String(payload.message_id || payload.messageId) : undefined,
    sessionId: payload.session_id || payload.sessionId ? String(payload.session_id || payload.sessionId) : undefined,
    clinicId: payload.clinic_id || payload.clinicId ? String(payload.clinic_id || payload.clinicId) : undefined,
    timestamp: payload.timestamp ? String(payload.timestamp) : undefined,
    error: payload.error ? String(payload.error) : undefined,
  })

  return NextResponse.json({ success: true, ...res }, { headers: noStore })
}
