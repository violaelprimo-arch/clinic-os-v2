import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { writeDocument } from '@/lib/server/firebase-rest'
import {
  getWpSenderConfig,
  getPublicWpSenderSummary,
  checkWpSenderSessionHealth,
} from '@/lib/server/wp-sender'
import {
  DEFAULT_WHATSAPP_SETTINGS,
  getClinicWhatsAppConfig,
  getPlatformWhatsAppDefaults,
  requeueWaitingJobsForClinic,
} from '@/lib/server/whatsapp-scheduler'
import {
  messageDefaults,
  WHATSAPP_TEMPLATE_KEYS,
  normalizeTemplateText,
  validateTemplateText,
  type WhatsAppTemplateKey,
  type WhatsAppTemplateAuditEntry,
} from '@/lib/clinic-message-templates'
import { resolveEffectiveWhatsAppPolicy } from '@/lib/whatsapp-policy'
import { queryDocumentsByField } from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff) return NextResponse.json({ error: 'غير مصرح' }, { status: 401, headers: noStore })

  const [doc, platformDefaults] = await Promise.all([
    getClinicWhatsAppConfig(staff.clinicId),
    getPlatformWhatsAppDefaults(),
  ])
  const policy = resolveEffectiveWhatsAppPolicy({
    platformDefaults,
    clinic: staff.clinic,
    waConfig: doc,
  })

  if (!policy.sectionVisible) {
    return NextResponse.json(
      { error: 'قسم رسائل واتساب مخفي أو معطل من مالك المنصة.', code: 'WHATSAPP_SECTION_HIDDEN' },
      { status: 403, headers: noStore },
    )
  }

  const entry = getWpSenderConfig(staff.clinicId)

  if (req.nextUrl.searchParams.get('qr') === '1') {
    if (staff.user.role !== 'doctor') {
      return NextResponse.json({ error: 'إدارة ربط الجلسة متاحة للطبيب فقط' }, { status: 403, headers: noStore })
    }
    if (!policy.serviceEnabled) {
      return NextResponse.json({ error: 'خدمة واتساب معطلة حاليًا من مالك المنصة' }, { status: 403, headers: noStore })
    }
    if (!entry || !entry.sessionId || !entry.apiKey || entry.mode === 'off') {
      return NextResponse.json({ error: 'الربط غير متاح لهذه العيادة حاليًا' }, { status: 404, headers: noStore })
    }
    try {
      const upstream = await fetch(
        `https://backendapi.wpsenderx.com/api/whatsapp-session/${encodeURIComponent(entry.sessionId)}/qr?output=image`,
        { headers: { 'X-API-Key': entry.apiKey } },
      )
      if (!upstream.ok) {
        return NextResponse.json({ error: 'تعذر تحميل رمز QR من مزود الخدمة' }, { status: 502, headers: noStore })
      }
      const type = upstream.headers.get('content-type') || 'image/png'
      if (!type.startsWith('image/')) {
        const text = await upstream.text().catch(() => '')
        let parsed: any = null
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = null
        }
        return NextResponse.json(
          {
            connected: Boolean(parsed?.connected || parsed?.status === 'connected' || parsed?.data?.connected),
            status: parsed?.status || parsed?.data?.status || 'status_response',
            message: parsed?.message || 'الجلسة متصلة بالفعل أو لم يتم إصدار QR جديد.',
          },
          { status: 200, headers: noStore },
        )
      }
      return new NextResponse(await upstream.arrayBuffer(), {
        headers: { 'Content-Type': type, ...noStore },
      })
    } catch {
      return NextResponse.json({ error: 'تعذر الاتصال بخدمة WP Sender حاليًا' }, { status: 502, headers: noStore })
    }
  }

  const savedTemplates = (doc?.templates || {}) as Partial<Record<WhatsAppTemplateKey, string>>
  const effectiveTemplates = {} as Record<WhatsAppTemplateKey, string>
  const templateAudit = {} as Record<WhatsAppTemplateKey, WhatsAppTemplateAuditEntry>

  for (const key of WHATSAPP_TEMPLATE_KEYS) {
    const custom = savedTemplates[key]
    effectiveTemplates[key] = custom && normalizeTemplateText(custom) ? custom : messageDefaults[key]
    const existingAudit = doc?.templateAudit?.[key]
    templateAudit[key] = {
      updatedAt: existingAudit?.updatedAt || doc?.updatedAt,
      updatedBy: existingAudit?.updatedBy || doc?.updatedBy,
      updatedByRole: existingAudit?.updatedByRole,
      mode: custom && normalizeTemplateText(custom) && custom !== messageDefaults[key] ? 'custom' : 'default',
    }
  }

  // Recent delivery status summary (scoped strictly to this clinicId)
  const clinicJobs = await queryDocumentsByField('whatsapp_jobs', 'clinicId', staff.clinicId, 40).catch(() => [])
  const sortedJobs = clinicJobs
    .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, 15)
    .map((j: any) => ({
      id: j.id,
      jobType: j.jobType,
      patientName: j.patientName,
      status: j.status,
      providerStatus: j.providerStatus || null,
      scheduledAt: j.scheduledAt,
      sentAt: j.sentAt || null,
      deliveredAt: j.deliveredAt || null,
      lastError: j.lastError || null,
    }))

  const counts = {
    queued: 0,
    waiting_for_connection: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
  }
  for (const j of clinicJobs) {
    if (j.status === 'queued' || j.status === 'pending') counts.queued++
    else if (j.status === 'waiting_for_connection') counts.waiting_for_connection++
    else if (j.status === 'sent') counts.sent++
    else if (j.status === 'delivered') counts.delivered++
    else if (j.status === 'failed' || j.status === 'uncertain') counts.failed++
  }

  return NextResponse.json(
    {
      templates: effectiveTemplates,
      defaults: messageDefaults,
      templateAudit,
      settings: {
        sendBookingConfirmation: doc?.settings.sendBookingConfirmation ?? true,
        sendAppointmentReminder: doc?.settings.sendAppointmentReminder ?? true,
        sendRescheduledNotification: doc?.settings.sendRescheduledNotification ?? true,
        sendCancelledNotification: doc?.settings.sendCancelledNotification ?? true,
        sendPrescription: Boolean(doc?.settings.sendPrescription),
        sendInvoice: Boolean(doc?.settings.sendInvoice),
        reminders: doc?.settings.reminders || DEFAULT_WHATSAPP_SETTINGS.reminders,
      },
      policy,
      wpSender: getPublicWpSenderSummary(staff.clinicId),
      qrReady: Boolean(entry && entry.sessionId && entry.apiKey && entry.mode !== 'off'),
      mode: entry?.mode || 'off',
      sessionStatus: doc?.sessionStatus || (entry?.mode === 'mock' ? 'connected' : 'unknown'),
      deliverySummary: counts,
      recentJobs: sortedJobs,
    },
    { headers: noStore },
  )
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!sameOriginMutation(req)) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403, headers: noStore })
  }

  const { slug } = await context.params
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff || staff.user.role !== 'doctor') {
    return NextResponse.json({ error: 'إدارة إعدادات الواتساب متاحة للطبيب فقط' }, { status: staff ? 403 : 401, headers: noStore })
  }

  const [existingDoc, platformDefaults] = await Promise.all([
    getClinicWhatsAppConfig(staff.clinicId),
    getPlatformWhatsAppDefaults(),
  ])
  const policy = resolveEffectiveWhatsAppPolicy({
    platformDefaults,
    clinic: staff.clinic,
    waConfig: existingDoc,
  })

  if (!policy.sectionVisible) {
    return NextResponse.json(
      { error: 'قسم رسائل واتساب مخفي أو معطل من مالك المنصة.', code: 'WHATSAPP_SECTION_HIDDEN' },
      { status: 403, headers: noStore },
    )
  }

  const body = await req.json().catch(() => ({}))

  // Optional session reconnection check + waiting queue flush
  if (body?.action === 'recheck_session') {
    if (!policy.serviceEnabled) {
      return NextResponse.json({ error: 'خدمة واتساب معطلة من مالك المنصة.' }, { status: 403, headers: noStore })
    }
    const health = await checkWpSenderSessionHealth(staff.clinicId, {
      persistedStatus: existingDoc?.sessionStatus,
    })
    if (health.connected) {
      const drained = await requeueWaitingJobsForClinic(staff.clinicId, { drainImmediately: true })
      return NextResponse.json({ success: true, health, drained }, { headers: noStore })
    }
    await writeDocument(
      `clinic_whatsapp_configs/${staff.clinicId}`,
      { sessionStatus: 'disconnected', disconnectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      true,
    )
    return NextResponse.json({ success: false, health }, { status: 200, headers: noStore })
  }

  const existingTemplates = { ...(existingDoc?.templates || {}) } as Partial<Record<WhatsAppTemplateKey, string>>
  const existingAudit = { ...(existingDoc?.templateAudit || {}) } as Partial<Record<WhatsAppTemplateKey, WhatsAppTemplateAuditEntry>>
  const nowIso = new Date().toISOString()
  const actorName = String(staff.clinic?.doctorName || staff.user.email || 'doctor')

  // Support restoring a single template or all templates to default cleanly
  if (body?.restoreAllDefaults === true) {
    for (const key of WHATSAPP_TEMPLATE_KEYS) {
      existingTemplates[key] = messageDefaults[key]
      existingAudit[key] = {
        updatedAt: nowIso,
        updatedBy: actorName,
        updatedByRole: staff.user.role,
        mode: 'default',
      }
    }
  } else if (body?.templates && typeof body.templates === 'object') {
    for (const key of WHATSAPP_TEMPLATE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(body.templates, key)) continue
      const featKey = key === 'appointment_rescheduled' || key === 'appointment_cancelled'
        ? 'reschedule_cancel'
        : key === 'prescription_ready'
        ? 'prescription'
        : key === 'invoice_ready'
        ? 'invoice'
        : key
      const featPolicy = (policy.features as Record<string, any>)[featKey]
      if (featPolicy?.editPermission === 'read_only') {
        // Enforce Owner read-only restriction: doctor cannot override locked template
        continue
      }
      const raw = body.templates[key]
      const normalized = normalizeTemplateText(raw)
      const check = validateTemplateText(normalized)
      if (!check.valid) {
        const msg =
          check.lengthError ||
          `المتغيرات التالية غير مدعومة في قالب (${key}): ${check.unknownTokens.join('، ')}`
        return NextResponse.json({ error: msg, code: 'INVALID_TEMPLATE' }, { status: 400, headers: noStore })
      }
      const isDefault = normalized === normalizeTemplateText(messageDefaults[key])
      if (existingTemplates[key] !== normalized) {
        existingAudit[key] = {
          updatedAt: nowIso,
          updatedBy: actorName,
          updatedByRole: staff.user.role,
          mode: isDefault ? 'default' : 'custom',
        }
      }
      existingTemplates[key] = normalized
    }
  }

  // Merge operational toggles ONLY within Owner-permitted bounds (Owner locks remain immutable)
  const prevSettings = existingDoc?.settings || DEFAULT_WHATSAPP_SETTINGS
  const nextSettings = {
    ...prevSettings,
    sendBookingConfirmation: policy.features.booking_confirmation.lockedByOwner
      ? prevSettings.sendBookingConfirmation
      : typeof body.sendBookingConfirmation === 'boolean'
      ? body.sendBookingConfirmation
      : prevSettings.sendBookingConfirmation,
    sendAppointmentReminder: policy.features.appointment_reminder.lockedByOwner
      ? prevSettings.sendAppointmentReminder
      : typeof body.sendAppointmentReminder === 'boolean'
      ? body.sendAppointmentReminder
      : prevSettings.sendAppointmentReminder,
    sendRescheduledNotification: policy.features.reschedule_cancel.lockedByOwner
      ? prevSettings.sendRescheduledNotification
      : typeof body.sendRescheduledNotification === 'boolean'
      ? body.sendRescheduledNotification
      : prevSettings.sendRescheduledNotification,
    sendCancelledNotification: policy.features.reschedule_cancel.lockedByOwner
      ? prevSettings.sendCancelledNotification
      : typeof body.sendCancelledNotification === 'boolean'
      ? body.sendCancelledNotification
      : prevSettings.sendCancelledNotification,
    sendPrescription: policy.features.prescription.lockedByOwner
      ? prevSettings.sendPrescription
      : typeof body.sendPrescription === 'boolean'
      ? body.sendPrescription
      : prevSettings.sendPrescription,
    sendInvoice: policy.features.invoice.lockedByOwner
      ? prevSettings.sendInvoice
      : typeof body.sendInvoice === 'boolean'
      ? body.sendInvoice
      : prevSettings.sendInvoice,
  }

  await writeDocument(
    `clinic_whatsapp_configs/${staff.clinicId}`,
    {
      clinicId: staff.clinicId,
      clinicSlug: slug,
      templates: existingTemplates,
      templateAudit: existingAudit,
      settings: nextSettings,
      updatedAt: nowIso,
      updatedBy: actorName,
    },
    true,
  )

  return NextResponse.json(
    {
      success: true,
      templates: existingTemplates,
      templateAudit: existingAudit,
      settings: nextSettings,
    },
    { headers: noStore },
  )
}
