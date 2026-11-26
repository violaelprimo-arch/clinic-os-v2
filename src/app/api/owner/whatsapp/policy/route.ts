import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, assertSameOrigin, apiFailure } from '@/lib/server/owner-access'
import { queryDocuments, readDocument, writeDocument } from '@/lib/server/firebase-rest'
import {
  getClinicWhatsAppConfig,
  getPlatformWhatsAppDefaults,
  requeueWaitingJobsForClinic,
} from '@/lib/server/whatsapp-scheduler'
import {
  normalizePlatformWhatsAppDefaults,
  normalizeOwnerPolicyInput,
  resolveEffectiveWhatsAppPolicy,
  ALL_WHATSAPP_SUB_FEATURES,
} from '@/lib/whatsapp-policy'
import { updateClinicMetaInRoom } from '@/lib/server/queue-room-client'
import { getPublicWpSenderSummary } from '@/lib/server/wp-sender'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    await authenticateOwnerRequest(req)
    const [platformDefaults, clinics] = await Promise.all([
      getPlatformWhatsAppDefaults(),
      queryDocuments('clinics').catch(() => []),
    ])

    const clinicPolicies = await Promise.all(
      clinics.map(async (c: any) => {
        const waConfig = await getClinicWhatsAppConfig(c.id).catch(() => null)
        const effective = resolveEffectiveWhatsAppPolicy({
          platformDefaults,
          clinic: c,
          waConfig,
        })
        return {
          clinicId: c.id,
          slug: c.slug,
          clinicName: c.clinicName || c.name || c.slug,
          rawPolicy: c.whatsappPolicy || waConfig?.ownerPolicy || null,
          effectivePolicy: effective,
          sessionStatus: waConfig?.sessionStatus || 'unknown',
          wpSender: getPublicWpSenderSummary(c.id),
        }
      }),
    )

    return NextResponse.json(
      { platformDefaults, clinics: clinicPolicies },
      { headers: noStore },
    )
  } catch (err) {
    return apiFailure(err)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const owner = await authenticateOwnerRequest(req)
    assertSameOrigin(req)
    const body = await req.json().catch(() => ({}))
    const nowIso = new Date().toISOString()

    // 1. Update platform-wide default policy
    if (body?.scope === 'platform') {
      const normalized = normalizePlatformWhatsAppDefaults(body.platformDefaults)
      await writeDocument(
        'platform_config/global',
        {
          whatsappDefaults: normalized,
          updatedAt: nowIso,
          updatedBy: owner.uid,
        },
        true,
      )
      return NextResponse.json({ success: true, platformDefaults: normalized }, { headers: noStore })
    }

    // 2. Update a specific clinic's WhatsApp Owner Governance Policy (preserving saved texts/settings!)
    if (body?.scope === 'clinic' && typeof body.clinicId === 'string' && body.clinicId.trim()) {
      const clinicId = body.clinicId.trim()
      const clinic = await readDocument(`clinics/${clinicId}`)
      if (!clinic) {
        return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404, headers: noStore })
      }
      const platformDefaults = await getPlatformWhatsAppDefaults()
      const normalized = normalizeOwnerPolicyInput(body.policy, platformDefaults)

      // Keep clinic hiddenTabs / hiddenSections aligned cleanly for defense-in-depth UI hiding
      const existingHiddenTabs = Array.isArray(clinic.hiddenTabs) ? [...clinic.hiddenTabs] : []
      const existingHiddenSections = Array.isArray(clinic.hiddenSections) ? [...clinic.hiddenSections] : []

      const nextHiddenTabs =
        normalized.sectionVisible === false
          ? Array.from(new Set([...existingHiddenTabs, 'whatsapp']))
          : existingHiddenTabs.filter((t: string) => t !== 'whatsapp')

      let nextHiddenSections = existingHiddenSections.filter((s: string) => s !== 'whatsapp' && !s.startsWith('whatsapp.'))
      if (normalized.sectionVisible === false) {
        nextHiddenSections.push('whatsapp')
      } else if (normalized.features) {
        for (const key of ALL_WHATSAPP_SUB_FEATURES) {
          if (normalized.features[key]?.visible === false) {
            nextHiddenSections.push(`whatsapp.${key}`)
          }
        }
      }
      nextHiddenSections = Array.from(new Set(nextHiddenSections))

      const prevAutoEnabled = Boolean(clinic.whatsappAutomationEnabled)
      const hasAnyAuto = Object.values(normalized.features || {}).some((f) => f?.mode === 'auto')

      const nextClinicFields = {
        whatsappPolicy: normalized,
        hiddenTabs: nextHiddenTabs,
        hiddenSections: nextHiddenSections,
        whatsappAutomationEnabled: normalized.serviceEnabled === false ? false : hasAnyAuto ? true : prevAutoEnabled,
        updatedAt: nowIso,
      }

      await writeDocument(`clinics/${clinicId}`, nextClinicFields, true)
      await writeDocument(
        `clinic_whatsapp_configs/${clinicId}`,
        { ownerPolicy: normalized, updatedAt: nowIso, updatedBy: owner.uid },
        true,
      )
      await updateClinicMetaInRoom({ clinicId, clinic: { ...clinic, ...nextClinicFields } }).catch(() => null)

      // If Owner re-enabled service cleanly, try resuming any waiting jobs whose window is still valid
      if (normalized.serviceEnabled !== false && normalized.sectionVisible !== false) {
        await requeueWaitingJobsForClinic(clinicId, { drainImmediately: false }).catch(() => null)
      }

      const waConfig = await getClinicWhatsAppConfig(clinicId)
      const effectivePolicy = resolveEffectiveWhatsAppPolicy({
        platformDefaults,
        clinic: { ...clinic, ...nextClinicFields },
        waConfig,
      })

      return NextResponse.json(
        { success: true, clinicId, policy: normalized, effectivePolicy },
        { headers: noStore },
      )
    }

    return NextResponse.json({ error: 'بيانات السياسة غير مكتملة' }, { status: 400, headers: noStore })
  } catch (err) {
    return apiFailure(err)
  }
}
