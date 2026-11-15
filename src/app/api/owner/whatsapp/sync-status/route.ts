import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { listWabaPhoneNumbers } from '@/lib/server/ycloud-service'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json'
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Platform Owner
    await authenticateOwnerRequest(req)

    const body = await readJson(req)
    const clinicId = String(body?.clinicId || '').trim()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId مطلوب' }, { status: 400, headers: noStore })
    }

    const config = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
    const clinic = await readDocument(`clinics/${clinicId}`)

    if (!config && !clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404, headers: noStore })
    }

    const wabaId = String(config?.wabaId || clinic?.whatsappWabaId || '').trim()

    if (!wabaId) {
      return NextResponse.json(
        {
          success: true,
          status: config?.status || 'not_linked',
          message: 'لم يتم ربط حساب WABA بعد لهذه العيادة.'
        },
        { status: 200, headers: noStore }
      )
    }

    // Query YCloud for phone numbers under this WABA
    const phones = await listWabaPhoneNumbers(wabaId)
    const now = new Date().toISOString()

    if (phones.length > 0) {
      const primary = phones[0]
      const isConnected = (primary.status || '').toUpperCase() === 'CONNECTED'
      const status = isConnected ? 'connected' : 'error'

      await writeDocument(
        `clinic_whatsapp_configs/${clinicId}`,
        {
          phoneNumber: primary.phoneNumber,
          phoneNumberId: primary.id,
          businessName: primary.verifiedName || config?.businessName || clinic?.name,
          status,
          lastSyncAt: now,
          lastError: isConnected ? null : `Phone status: ${primary.status}`
        },
        true
      )

      await writeDocument(
        `clinics/${clinicId}`,
        {
          whatsappPhoneNumber: primary.phoneNumber,
          whatsappPhoneNumberId: primary.id,
          whatsappLinkedAt: now
        },
        true
      ).catch(() => {})

      return NextResponse.json(
        {
          success: true,
          status,
          phoneNumber: primary.phoneNumber,
          verifiedName: primary.verifiedName,
          qualityRating: primary.qualityRating
        },
        { status: 200, headers: noStore }
      )
    }

    return NextResponse.json(
      {
        success: true,
        status: config?.status || 'linking',
        message: 'الحساب قيد المراجعة ولم يتم العثور على أرقام مسجلة بعد في YCloud.'
      },
      { status: 200, headers: noStore }
    )
  } catch (err) {
    return apiFailure(err)
  }
}
