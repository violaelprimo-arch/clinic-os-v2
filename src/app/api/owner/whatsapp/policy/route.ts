import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, assertSameOrigin, apiFailure } from '@/lib/server/owner-access'
import { queryDocuments, readDocument, writeDocument, createDocument } from '@/lib/server/firebase-rest'
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
import { messageDefaults } from '@/lib/clinic-message-templates'
import { updateClinicMetaInRoom } from '@/lib/server/queue-room-client'
import { getPublicWpSenderSummary } from '@/lib/server/wp-sender'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    await authenticateOwnerRequest(req)
    const [platformDoc, clinics, auditLogs] = await Promise.all([
      readDocument('platform_config/global').catch(() => null),
      queryDocuments('clinics').catch(() => []),
      queryDocuments('whatsapp_audit_logs').catch(() => []),
    ])

    const platformDefaults = normalizePlatformWhatsAppDefaults(platformDoc?.whatsappDefaults)
    const savedTemplates = platformDoc?.whatsappTemplates || messageDefaults

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
          doctorName: c.doctorName || c.doctor?.name || '',
          phone: c.phone || c.whatsappPhoneNumber || '',
          rawPolicy: c.whatsappPolicy || waConfig?.ownerPolicy || null,
          effectivePolicy: effective,
          sessionStatus: waConfig?.sessionStatus || (waConfig?.connected ? 'connected' : 'disconnected'),
          wpSender: getPublicWpSenderSummary(c.id),
          settings: waConfig?.settings || null,
          templates: waConfig?.templates || null,
          monthlyUsage: (waConfig as any)?.monthlyUsage || 0,
        }
      }),
    )

    const sortedAudit = (Array.isArray(auditLogs) ? auditLogs : []).sort((a: any, b: any) =>
      String(b.timestamp || '').localeCompare(String(a.timestamp || '')),
    )

    return NextResponse.json(
      {
        platformDefaults,
        templates: savedTemplates,
        clinics: clinicPolicies,
        auditLogs: sortedAudit.slice(0, 50),
      },
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

    const logAudit = async (action: string, details: Record<string, any>) => {
      await createDocument('whatsapp_audit_logs', {
        action,
        ownerUid: owner.uid,
        ownerEmail: owner.email || '',
        timestamp: nowIso,
        details,
      }).catch(() => null)
    }

    // 0. Emergency Stop / Resume Toggle (Kill Switch)
    if (body?.scope === 'emergency_stop') {
      const emergencyStop = Boolean(body.emergencyStop)
      const currentGlobal = (((await readDocument('platform_config/global').catch(() => null)) || {}) as any)
      const existingDefaults = normalizePlatformWhatsAppDefaults(currentGlobal.whatsappDefaults)
      existingDefaults.emergencyStop = emergencyStop

      await writeDocument(
        'platform_config/global',
        {
          whatsappDefaults: existingDefaults,
          updatedAt: nowIso,
          updatedBy: owner.uid,
        },
        true,
      )

      await logAudit(emergencyStop ? 'EMERGENCY_STOP_ACTIVATED' : 'EMERGENCY_STOP_RESUMED', {
        emergencyStop,
      })

      return NextResponse.json(
        { success: true, emergencyStop, platformDefaults: existingDefaults },
        { headers: noStore },
      )
    }

    // 1. Update platform-wide default policy & quiet hours
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
      await logAudit('PLATFORM_DEFAULTS_UPDATED', { normalized })
      return NextResponse.json({ success: true, platformDefaults: normalized }, { headers: noStore })
    }

    // 2. Save platform-wide default message templates or clinic custom templates
    if (body?.scope === 'templates') {
      if (body?.clinicId && typeof body.clinicId === 'string') {
        const clinicId = body.clinicId.trim()
        await writeDocument(
          `clinic_whatsapp_configs/${clinicId}`,
          {
            templates: body.templates,
            updatedAt: nowIso,
            updatedBy: owner.uid,
          },
          true,
        )
        await logAudit('CLINIC_TEMPLATES_UPDATED', { clinicId })
        return NextResponse.json({ success: true, clinicId }, { headers: noStore })
      }

      await writeDocument(
        'platform_config/global',
        {
          whatsappTemplates: body.templates,
          updatedAt: nowIso,
          updatedBy: owner.uid,
        },
        true,
      )
      await logAudit('PLATFORM_TEMPLATES_UPDATED', {})
      return NextResponse.json({ success: true }, { headers: noStore })
    }

    // 3. Batch apply defaults to all or selected clinics
    if (body?.scope === 'batch_apply') {
      const targetIds: string[] = Array.isArray(body.clinicIds) ? body.clinicIds : []
      const platformDefaults = normalizePlatformWhatsAppDefaults(body.platformDefaults || (await getPlatformWhatsAppDefaults()))
      const allClinics = await queryDocuments('clinics').catch(() => [])
      const selectedClinics = targetIds.length > 0
        ? allClinics.filter((c: any) => targetIds.includes(c.id))
        : allClinics

      let updatedCount = 0
      for (const clinic of selectedClinics) {
        const cid = clinic.id
        await writeDocument(
          `clinics/${cid}`,
          {
            whatsappPolicy: platformDefaults,
            updatedAt: nowIso,
          },
          true,
        ).catch(() => null)

        await writeDocument(
          `clinic_whatsapp_configs/${cid}`,
          {
            ownerPolicy: platformDefaults,
            updatedAt: nowIso,
            updatedBy: owner.uid,
          },
          true,
        ).catch(() => null)
        updatedCount++
      }

      await logAudit('BATCH_APPLY_DEFAULTS', { updatedCount, targetCount: selectedClinics.length })
      return NextResponse.json({ success: true, updatedCount }, { headers: noStore })
    }

    // 4. Copy settings from Clinic A to Clinic B safely (preserving target credentials)
    if (body?.scope === 'copy_settings') {
      const sourceId = String(body.sourceClinicId || '').trim()
      const targetId = String(body.targetClinicId || '').trim()

      if (!sourceId || !targetId || sourceId === targetId) {
        return NextResponse.json({ error: 'معرفات العيادات غير صحيحة' }, { status: 400, headers: noStore })
      }

      const [sourceClinic, sourceConfig, targetClinic, _targetConfig] = await Promise.all([
        readDocument(`clinics/${sourceId}`),
        readDocument(`clinic_whatsapp_configs/${sourceId}`),
        readDocument(`clinics/${targetId}`),
        readDocument(`clinic_whatsapp_configs/${targetId}`),
      ])

      if (!sourceClinic || !targetClinic) {
        return NextResponse.json({ error: 'إحدى العيادتين غير موجودة' }, { status: 404, headers: noStore })
      }

      const policyToCopy = sourceClinic.whatsappPolicy || sourceConfig?.ownerPolicy || null
      const templatesToCopy = sourceConfig?.templates || null
      const settingsToCopy = sourceConfig?.settings ? { ...sourceConfig.settings } : null

      if (policyToCopy) {
        await writeDocument(`clinics/${targetId}`, { whatsappPolicy: policyToCopy, updatedAt: nowIso }, true)
      }

      await writeDocument(
        `clinic_whatsapp_configs/${targetId}`,
        {
          ...(policyToCopy ? { ownerPolicy: policyToCopy } : {}),
          ...(templatesToCopy ? { templates: templatesToCopy } : {}),
          ...(settingsToCopy ? { settings: settingsToCopy } : {}),
          updatedAt: nowIso,
          updatedBy: owner.uid,
        },
        true,
      )

      await logAudit('COPY_CLINIC_SETTINGS', { sourceId, targetId })
      return NextResponse.json({ success: true, sourceId, targetId }, { headers: noStore })
    }

    // 5. Update a specific clinic's WhatsApp Owner Governance Policy
    if (body?.scope === 'clinic' && typeof body.clinicId === 'string' && body.clinicId.trim()) {
      const clinicId = body.clinicId.trim()
      const clinic = await readDocument(`clinics/${clinicId}`)
      if (!clinic) {
        return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404, headers: noStore })
      }
      const platformDefaults = await getPlatformWhatsAppDefaults()
      const normalized = normalizeOwnerPolicyInput(body.policy, platformDefaults)

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
        {
          ownerPolicy: normalized,
          ...(body.settings ? { settings: body.settings } : {}),
          updatedAt: nowIso,
          updatedBy: owner.uid,
        },
        true,
      )
      await updateClinicMetaInRoom({ clinicId, clinic: { ...clinic, ...nextClinicFields } }).catch(() => null)

      if (normalized.serviceEnabled !== false && normalized.sectionVisible !== false) {
        await requeueWaitingJobsForClinic(clinicId, { drainImmediately: false }).catch(() => null)
      }

      const waConfig = await getClinicWhatsAppConfig(clinicId)
      const effectivePolicy = resolveEffectiveWhatsAppPolicy({
        platformDefaults,
        clinic: { ...clinic, ...nextClinicFields },
        waConfig,
      })

      await logAudit('CLINIC_POLICY_UPDATED', { clinicId, normalized })

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
