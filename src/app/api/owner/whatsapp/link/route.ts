import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { createEmbeddedSignupLink } from '@/lib/server/ycloud-service'
import { DEFAULT_WHATSAPP_SETTINGS } from '@/lib/server/whatsapp-scheduler'

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

    // 2. Verify clinic exists in database
    const clinic = await readDocument(`clinics/${clinicId}`)
    if (!clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404, headers: noStore })
    }

    // 3. Generate dynamic YCloud Partner Embedded Signup Link
    // Uses partnerCustomerId = clinicId and onboardingType = WHATSAPP_BUSINESS_APP (Coexistence mode)
    const result = await createEmbeddedSignupLink({
      partnerCustomerId: clinicId,
      locale: 'ar'
    })

    // 4. Mark status as 'linking' in clinic_whatsapp_configs
    const now = new Date().toISOString()
    await writeDocument(
      `clinic_whatsapp_configs/${clinicId}`,
      {
        clinicId,
        clinicSlug: clinic.slug || '',
        businessName: clinic.name || null,
        status: 'linking',
        lastSyncAt: now,
        lastError: null,
        settings: DEFAULT_WHATSAPP_SETTINGS
      },
      true
    ).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        url: result.url,
        linkId: result.id,
        clinicId
      },
      { status: 200, headers: noStore }
    )
  } catch (err) {
    return apiFailure(err)
  }
}
