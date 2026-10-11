import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppNotification, WhatsAppPayload } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as WhatsAppPayload

    if (!body.to || !body.type || !body.appointmentId || !body.idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing required fields: to, type, appointmentId, idempotencyKey' },
        { status: 400 }
      )
    }

    const result = await sendWhatsAppNotification(body)
    return NextResponse.json(result, { status: result.success ? 200 : 202 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Dispatch error' }, { status: 500 })
  }
}
