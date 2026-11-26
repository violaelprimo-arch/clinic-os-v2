import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import {
  getClinicWhatsAppConfig,
  getPlatformWhatsAppDefaults,
} from '@/lib/server/whatsapp-scheduler'
import { getClinicDocumentWhatsAppStatus } from '@/lib/server/send-clinic-document'
import { getPublicWpSenderSummary } from '@/lib/server/wp-sender'
import { resolveEffectiveWhatsAppPolicy } from '@/lib/whatsapp-policy'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * Authoritative policy & document delivery status endpoint for BOTH Doctor and Assistant.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401, headers: noStore })
  }

  const [waConfig, platformDefaults] = await Promise.all([
    getClinicWhatsAppConfig(staff.clinicId),
    getPlatformWhatsAppDefaults(),
  ])
  const policy = resolveEffectiveWhatsAppPolicy({
    platformDefaults,
    clinic: staff.clinic,
    waConfig,
  })

  const docType = req.nextUrl.searchParams.get('docType')
  const docId = req.nextUrl.searchParams.get('docId')
  let documentStatus: any = null

  if ((docType === 'prescription' || docType === 'invoice') && docId) {
    const feat = policy.features[docType]
    if (!policy.sectionVisible || !feat.visible || !feat.enabled) {
      return NextResponse.json(
        { error: 'الميزة مخفية أو معطلة من إدارة المنصة.', code: 'WHATSAPP_FEATURE_DISABLED', policy },
        { status: 403, headers: noStore },
      )
    }
    documentStatus = await getClinicDocumentWhatsAppStatus(staff.clinicId, docId, docType)
  }

  return NextResponse.json(
    {
      policy,
      wpSender: getPublicWpSenderSummary(staff.clinicId),
      sessionStatus: waConfig?.sessionStatus || 'unknown',
      documentStatus,
    },
    { headers: noStore },
  )
}
