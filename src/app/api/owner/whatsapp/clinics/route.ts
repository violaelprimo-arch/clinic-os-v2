import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, apiFailure } from '@/lib/server/owner-access'
import { queryDocuments, readDocument } from '@/lib/server/firebase-rest'
import { DEFAULT_WHATSAPP_SETTINGS, ClinicWhatsAppConfig } from '@/lib/server/whatsapp-scheduler'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json'
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate Platform Owner
    await authenticateOwnerRequest(req)

    // 2. Fetch all registered clinics
    const rawClinics = await queryDocuments('clinics')
    const clinics = Array.isArray(rawClinics) ? rawClinics : []

    // 3. Fetch all whatsapp configs in parallel
    const clinicsWithWhatsApp = await Promise.all(
      clinics.map(async (c: any) => {
        const clinicId = String(c.id || '')
        let waConfig: ClinicWhatsAppConfig | null = null

        try {
          const rawConfig = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
          if (rawConfig) {
            waConfig = rawConfig as unknown as ClinicWhatsAppConfig
          }
        } catch {}

        const isLinkedFromClinic = Boolean(c.whatsappPhoneNumber)
        const status = waConfig?.status || (isLinkedFromClinic ? 'connected' : 'not_linked')
        const phoneNumber = waConfig?.phoneNumber || c.whatsappPhoneNumber || null

        return {
          id: clinicId,
          name: c.name || 'عيادة بدون اسم',
          doctorName: c.doctorName || c.ownerName || 'طبيب غير محدد',
          slug: c.slug || '',
          phone: c.phone || '',
          whatsapp: {
            status,
            phoneNumber,
            phoneNumberId: waConfig?.phoneNumberId || c.whatsappPhoneNumberId || null,
            wabaId: waConfig?.wabaId || c.whatsappWabaId || null,
            businessName: waConfig?.businessName || c.name || null,
            linkedAt: waConfig?.linkedAt || c.whatsappLinkedAt || null,
            lastSyncAt: waConfig?.lastSyncAt || null,
            lastError: waConfig?.lastError || null,
            stats: {
              sentCount: Number(waConfig?.stats?.sentCount || 0),
              deliveredCount: Number(waConfig?.stats?.deliveredCount || 0),
              readCount: Number(waConfig?.stats?.readCount || 0),
              failedCount: Number(waConfig?.stats?.failedCount || 0),
              totalCostEstimate: Number(waConfig?.stats?.totalCostEstimate || 0)
            },
            monthlyUsage: Number(waConfig?.monthlyUsage || 0),
            settings: waConfig?.settings || DEFAULT_WHATSAPP_SETTINGS
          }
        }
      })
    )

    return NextResponse.json({ clinics: clinicsWithWhatsApp }, { status: 200, headers: noStore })
  } catch (err) {
    return apiFailure(err)
  }
}
