import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { createWpSenderSession, getWpSenderQrCode } from '@/lib/server/wp-sender'
import { DEFAULT_WHATSAPP_SETTINGS } from '@/lib/server/whatsapp-scheduler'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json',
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Platform Owner
    await authenticateOwnerRequest(req)

    const body = await readJson(req)
    const clinicId = String(body?.clinicId || '').trim()
    const senderNumber = body?.senderNumber ? String(body.senderNumber).trim() : undefined

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId مطلوب' }, { status: 400, headers: noStore })
    }

    // 2. Verify clinic exists in database
    const clinic = await readDocument(`clinics/${clinicId}`)
    if (!clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404, headers: noStore })
    }

    // 3. Initialize WP Sender session and retrieve QR code
    const result = await createWpSenderSession(clinicId, senderNumber)
    let qr = result.qrCode
    if (!qr && result.success) {
      const qrRes = await getWpSenderQrCode(clinicId)
      qr = qrRes.qrCode
    }

    // 4. Mark status as 'linking' / update session details in clinic_whatsapp_configs
    const now = new Date().toISOString()
    await writeDocument(
      `clinic_whatsapp_configs/${clinicId}`,
      {
        clinicId,
        clinicSlug: clinic.slug || '',
        businessName: clinic.name || null,
        sessionId: result.sessionId || null,
        senderNumber: result.senderNumber || null,
        sessionStatus: result.connected ? 'connected' : 'linking',
        status: result.connected ? 'connected' : 'linking',
        lastSyncAt: now,
        lastError: result.error || null,
        settings: DEFAULT_WHATSAPP_SETTINGS,
      },
      true,
    ).catch(() => {})

    return NextResponse.json(
      {
        success: result.success,
        clinicId,
        sessionId: result.sessionId,
        senderNumber: result.senderNumber,
        qrCode: qr,
        connected: result.connected,
        error: result.error,
      },
      { status: 200, headers: noStore },
    )
  } catch (err) {
    return apiFailure(err)
  }
}
