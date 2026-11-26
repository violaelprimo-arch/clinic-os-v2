import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { authorizeRecordAccess } from './record-access'
import { sameOriginMutation } from './push-access'
import { readDocument, queryDocuments, queryDocumentsByFields, writeDocument, createDocument } from './firebase-rest'
import { getWpSenderConfig, sendWpSenderMessage } from './wp-sender'
import {
  reserveWpSenderUsage,
  DEFAULT_WHATSAPP_SETTINGS,
  getPlatformWhatsAppDefaults,
  getClinicWhatsAppConfig,
  computeDocumentContentHash,
  hasWhatsAppConsent,
} from './whatsapp-scheduler'
import { formatToE164 } from './ycloud-service'
import { renderClinicMessage, messageDefaults } from '@/lib/clinic-message-templates'
import { resolveEffectiveWhatsAppPolicy } from '@/lib/whatsapp-policy'

export async function sendClinicDocument(
  req: NextRequest,
  slug: string,
  recordId: string,
  type: 'invoice' | 'prescription',
  _legacyGet?: unknown,
): Promise<NextResponse> {
  const noStore = { 'Cache-Control': 'no-store' }
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore })
  if (!sameOriginMutation(req)) {
    return reply({ error: 'طلب غير مصرح به: المصدر غير مطابق' }, 403)
  }

  // 1. Resolve clinic by slug
  const allClinics = await queryDocuments('clinics')
  const clinic = allClinics.find((c: any) => c.slug === slug || c.id === slug)
  if (!clinic) return reply({ error: 'العيادة غير موجودة' }, 404)

  // 2. Fetch appointment or prescription record
  let record: any = null
  if (type === 'invoice') {
    record = await readDocument(`appointments/${recordId}`)
    if (!record) {
      const clinicAppts = await queryDocuments('appointments')
      record = clinicAppts.find(
        (a: any) =>
          (a.clinic_id === clinic.id || a.clinicId === clinic.id) &&
          (a.invoiceNumber === recordId || a.id === recordId)
      )
    }
  } else {
    record = await readDocument(`prescriptions/${recordId}`)
    if (!record) {
      record = await readDocument(`appointments/${recordId}`)
    }
  }

  if (!record) {
    return reply({ error: 'المستند غير موجود' }, 404)
  }

  // 3. Strict Server-Side Authorization
  const auth = await authorizeRecordAccess(req, {
    clinicId: String(clinic.id),
    clinicSlug: String(clinic.slug || slug),
    recordId,
    recordType: type,
    recordPhone: record.phone ? String(record.phone) : undefined,
    recordPatientId: (record.patientId || record.patient_id) ? String(record.patientId || record.patient_id) : undefined,
  })

  if (!auth.authorized) {
    return reply({ error: 'غير مصرح بإرسال هذا المستند' }, auth.status === 401 ? 401 : 403)
  }

  const [waConfig, platformDefaults] = await Promise.all([
    getClinicWhatsAppConfig(clinic.id),
    getPlatformWhatsAppDefaults(),
  ])
  const policy = resolveEffectiveWhatsAppPolicy({
    platformDefaults,
    clinic,
    waConfig,
  })
  const feat = policy.features[type]

  // Owner Feature Governance: reject hidden, disabled, or auto-only (manual blocked) requests with 403
  if (!policy.sectionVisible || !policy.serviceEnabled || !feat.visible || !feat.enabled) {
    return reply(
      {
        error: type === 'prescription' ? 'ميزة إرسال الروشتة عبر واتساب معطلة أو مخفية من إدارة المنصة.' : 'ميزة إرسال الفاتورة عبر واتساب معطلة أو مخفية من إدارة المنصة.',
        code: 'WHATSAPP_FEATURE_DISABLED',
      },
      403,
    )
  }

  if (feat.autoSend) {
    return reply(
      {
        error: 'الإرسال التلقائي مفعّل لهذا النوع ولا يتاح الإرسال اليدوي المكرر.',
        code: 'AUTO_SEND_ACTIVE',
      },
      409,
    )
  }

  // Respect granular patient consent opt-out
  if (record.whatsappConsent === false || !hasWhatsAppConsent(record, type === 'prescription' ? 'prescription_ready' : 'invoice_ready')) {
    // Legacy appointments created without explicit whatsappConsent field default to staff-initiated share allowed unless explicitly opted out
    if (
      record.whatsappConsent === false ||
      record.whatsappConsentPreferences?.documents === false
    ) {
      return reply({ error: 'المريض لم يوافق على استلام المستندات عبر واتساب.' }, 403)
    }
  }

  const wp = getWpSenderConfig(clinic.id)
  if (!wp || wp.mode === 'off') return reply({ error: 'WP Sender غير مفعل لهذه العيادة' }, 403)

  const body = await req.json().catch(() => ({}))
  const link = new URL(
    `/clinic/${encodeURIComponent(slug)}/${type}/${encodeURIComponent(recordId)}`,
    req.nextUrl.origin,
  )
  const recipient = formatToE164(
    String(body.phone || record.patientPhone || record.phone || ''),
  )
  if (!recipient) return reply({ error: 'رقم هاتف المريض غير صالح' }, 400)

  const prefs: any = (await readDocument(`clinic_whatsapp_configs/${clinic.id}`).catch(() => null)) || waConfig || {}
  const templates = (prefs.templates || {}) as Record<string, string>
  const branchName = String(record.branchName || clinic.branchName || '')
  const baseRendered = renderClinicMessage(
    templates[type] || messageDefaults[type],
    {
      patientName: String(record.patientName || 'المريض'),
      clinicName: String(clinic.clinicName || 'العيادة'),
      when: String(record.date || ''),
      doctorName: String(clinic.doctorName || ''),
      branchName,
      link: link.href,
    },
  )
  const message = baseRendered.includes(link.href) ? baseRendered : `${baseRendered}\n${link.href}`

  // Short-burst duplicate guard against double-click manual sends
  const contentHash = await computeDocumentContentHash({ type, recordId, recipient, message })
  const burstWindow = Math.floor(Date.now() / 30_000)
  const burstKey = `manual_${type}_${clinic.id}_${recordId}_${burstWindow}`
  try {
    await createDocument('whatsapp_dedup', { type, clinicId: clinic.id, recordId, contentHash }, burstKey)
  } catch {
    return reply({ error: 'تم استلام طلب الإرسال بالفعل، انتظر لحظات قبل التكرار.', code: 'DUPLICATE_REQUEST' }, 409)
  }

  const limit = Number(prefs.settings?.monthlyLimit ?? DEFAULT_WHATSAPP_SETTINGS.monthlyLimit)
  if (!(await reserveWpSenderUsage(clinic.id, limit, new Date().toISOString(), wp.mode === 'mock'))) {
    return reply({ error: 'تم بلوغ الحد الشهري للرسائل' }, 429)
  }

  const nowIso = new Date().toISOString()
  const jobId = `man_${type}_${clinic.id}_${recordId}_${Date.now()}`
  const delivery = await sendWpSenderMessage({
    clinicId: clinic.id,
    phone: recipient,
    message,
    idempotencyKey: jobId,
    persistedSessionStatus: waConfig?.sessionStatus,
  })

  if (!delivery.ok) {
    const statusMap =
      delivery.errorClass === 'disconnected'
        ? 'waiting_for_connection'
        : delivery.errorClass === 'uncertain'
        ? 'uncertain'
        : 'failed'
    await writeDocument(`whatsapp_jobs/${jobId}`, {
      id: jobId,
      clinicId: clinic.id,
      clinicSlug: slug,
      appointmentId: String(record.appointment_id || recordId),
      patientName: String(record.patientName || ''),
      patientPhone: recipient,
      jobType: type === 'prescription' ? 'prescription_ready' : 'invoice_ready',
      scheduledAt: nowIso,
      originalScheduledAt: nowIso,
      status: statusMap,
      provider: 'wp_sender',
      senderNumber: delivery.senderNumber || wp.senderNumber,
      sessionId: delivery.sessionId || wp.sessionId,
      errorClass: delivery.errorClass,
      lastError: delivery.error || 'MANUAL_SEND_FAILED',
      attempts: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).catch(() => null)

    return reply(
      {
        error: delivery.error || 'فشل إرسال الرسالة عبر واتساب',
        status: statusMap,
        jobId,
      },
      delivery.errorClass === 'disconnected' ? 503 : 502,
    )
  }

  await writeDocument(`whatsapp_jobs/${jobId}`, {
    id: jobId,
    clinicId: clinic.id,
    clinicSlug: slug,
    appointmentId: String(record.appointment_id || recordId),
    patientName: String(record.patientName || ''),
    patientPhone: recipient,
    jobType: type === 'prescription' ? 'prescription_ready' : 'invoice_ready',
    scheduledAt: nowIso,
    originalScheduledAt: nowIso,
    status: 'sent',
    provider: 'wp_sender',
    providerStatus: 'sent',
    providerMessageId: delivery.messageId || `man_wp_${Date.now()}`,
    senderNumber: delivery.senderNumber || wp.senderNumber,
    sessionId: delivery.sessionId || wp.sessionId,
    attempts: 1,
    sentAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  }).catch(() => null)

  return reply({
    success: true,
    id: delivery.messageId,
    status: 'sent',
    mocked: Boolean(delivery.mocked),
    jobId,
  })
}

export async function getClinicDocumentWhatsAppStatus(
  clinicId: string,
  documentRootKey: string,
  type: 'prescription' | 'invoice',
) {
  if (!clinicId || !documentRootKey) return null
  const jobType = type === 'prescription' ? 'prescription_ready' : 'invoice_ready'
  const jobs = await queryDocumentsByFields(
    'whatsapp_jobs',
    {
      clinicId,
      documentRootKey,
      jobType,
    },
    20,
  ).catch(() => [])
  if (jobs.length === 0) return null
  jobs.sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
  const latest = jobs[0]
  return {
    jobId: latest.id,
    status: latest.status,
    providerStatus: latest.providerStatus || null,
    documentVersion: latest.documentVersion || 1,
    sentAt: latest.sentAt || null,
    deliveredAt: latest.deliveredAt || null,
    lastError: latest.lastError || null,
    updatedAt: latest.updatedAt || latest.createdAt || null,
  }
}
