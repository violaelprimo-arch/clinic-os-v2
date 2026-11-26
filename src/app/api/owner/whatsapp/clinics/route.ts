import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, apiFailure } from '@/lib/server/owner-access'
import { queryDocuments, readDocument } from '@/lib/server/firebase-rest'
import { DEFAULT_WHATSAPP_SETTINGS, ClinicWhatsAppConfig, cairoUsageMonth } from '@/lib/server/whatsapp-scheduler'

import { getWpSenderConfig } from '@/lib/server/wp-sender'

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
        let waConfig: any = null

        try {
          const rawConfig = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
          if (rawConfig) {
            waConfig = rawConfig as any
          }
        } catch {}

        const wp = getWpSenderConfig(clinicId)
        const isLinkedFromClinic = Boolean(c.whatsappPhoneNumber)
        const status = wp ? (wp.mode === 'off' ? 'not_linked' : 'connected') : waConfig?.status || (isLinkedFromClinic ? 'connected' : 'not_linked')
        const phoneNumber = wp ? wp.senderNumber || null : waConfig?.phoneNumber || c.whatsappPhoneNumber || null

        return {
          id: clinicId,
          name: c.clinicName || c.name || 'عيادة بدون اسم',
          doctorName: c.doctorName || c.ownerName || 'طبيب غير محدد',
          slug: c.slug || '',
          phone: c.phone || '',
          whatsapp: {
            status,
            wpSenderMode: wp?.mode || null,
            phoneNumber,
            phoneNumberId: wp ? null : waConfig?.phoneNumberId || c.whatsappPhoneNumberId || null,
            wabaId: wp ? null : waConfig?.wabaId || c.whatsappWabaId || null,
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
            monthlyUsage: wp?.mode === 'mock' ? (waConfig?.wpMockMonth === cairoUsageMonth() ? Number(waConfig.wpMockUsage || 0) : 0) : wp
              ? (waConfig?.wpUsageMonth === cairoUsageMonth() ? Number(waConfig?.wpMonthlyUsage || 0) : 0)
              : Number(waConfig?.monthlyUsage || 0),
            settings: { ...DEFAULT_WHATSAPP_SETTINGS, ...waConfig?.settings }
          }
        }
      })
    )

    return NextResponse.json({ clinics: clinicsWithWhatsApp }, { status: 200, headers: noStore })
  } catch (err) {
    return apiFailure(err)
  }
}
