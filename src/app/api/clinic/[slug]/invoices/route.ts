import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'
import {
  enqueueDocumentWhatsAppJob,
  computeDocumentContentHash,
  getClinicWhatsAppConfig,
  getPlatformWhatsAppDefaults,
} from '@/lib/server/whatsapp-scheduler'
import { getClinicDocumentWhatsAppStatus } from '@/lib/server/send-clinic-document'
import { resolveEffectiveWhatsAppPolicy } from '@/lib/whatsapp-policy'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff) return NextResponse.json({ error: 'غير مصرح' }, { status: 401, headers: noStore })

  const invoiceId = req.nextUrl.searchParams.get('id') || req.nextUrl.searchParams.get('appointmentId') || ''
  if (!invoiceId) return NextResponse.json({ error: 'معرف الفاتورة مطلوب' }, { status: 400, headers: noStore })

  const whatsappStatus = await getClinicDocumentWhatsAppStatus(staff.clinicId, invoiceId, 'invoice')
  return NextResponse.json({ whatsappStatus }, { headers: noStore })
}

/**
 * Explicit Invoice creation/issuance endpoint.
 * Note: Payment confirmation alone never invokes this route and never resends an invoice.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!sameOriginMutation(req)) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403, headers: noStore })
  }

  const { slug } = await context.params
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff) return NextResponse.json({ error: 'غير مصرح' }, { status: 401, headers: noStore })
  if (isClinicSuspended(staff.clinic)) {
    return NextResponse.json({ error: 'الاشتراك منتهي.' }, { status: 403, headers: noStore })
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
  if (!policy.sectionVisible || !policy.features.invoice.visible || !policy.features.invoice.enabled) {
    return NextResponse.json(
      { error: 'ميزة إرسال أو إصدار الفواتير عبر واتساب معطلة أو مخفية من إدارة المنصة.', code: 'WHATSAPP_FEATURE_DISABLED' },
      { status: 403, headers: noStore },
    )
  }

  const body = await req.json().catch(() => ({}))
  const appointmentId =
    typeof body.appointmentId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.appointmentId)
      ? body.appointmentId
      : ''
  const rawInvoiceId =
    typeof body.invoiceId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.invoiceId)
      ? body.invoiceId
      : appointmentId || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  let apptDoc: any = null
  if (appointmentId) {
    apptDoc = await readDocument(`appointments/${appointmentId}`).catch(() => null)
    if (apptDoc && String(apptDoc.clinic_id || '') !== staff.clinicId) {
      return NextResponse.json({ error: 'الموعد لا ينتمي لهذه العيادة' }, { status: 403, headers: noStore })
    }
  }

  const existingInv = await readDocument(`invoices/${rawInvoiceId}`).catch(() => null)
  if (existingInv && String(existingInv.clinic_id || '') !== staff.clinicId) {
    return NextResponse.json({ error: 'غير مصرح بالوصول لهذه الفاتورة' }, { status: 403, headers: noStore })
  }

  const patientName = String(body.patientName || apptDoc?.patientName || existingInv?.patientName || '').trim()
  const patientPhone = String(body.patientPhone || apptDoc?.phone || existingInv?.patientPhone || '').trim()
  if (!patientName || !patientPhone) {
    return NextResponse.json({ error: 'اسم المريض ورقم الهاتف مطلوبان لإصدار الفاتورة' }, { status: 400, headers: noStore })
  }

  const originalPrice = Number(body.originalPrice ?? apptDoc?.originalPrice ?? apptDoc?.servicePrice ?? existingInv?.originalPrice ?? 0)
  const netTotal = Number(body.netTotal ?? apptDoc?.servicePrice ?? existingInv?.netTotal ?? originalPrice)
  const discount = body.discount ?? apptDoc?.discount ?? existingInv?.discount ?? 0
  const invoiceNumber = String(body.invoiceNumber || existingInv?.invoiceNumber || `INV-${rawInvoiceId.slice(-6).toUpperCase()}`)
  const serviceName = String(body.serviceName || apptDoc?.serviceName || existingInv?.serviceName || 'كشف طبي')
  const branchName = String(body.branchName || apptDoc?.branchName || existingInv?.branchName || '')
  const dateStr = String(body.date || apptDoc?.date || existingInv?.date || new Date().toISOString().slice(0, 10))

  // Content hash intentionally excludes transient paymentStatus changes so confirming payment alone does not re-issue
  const contentHash = await computeDocumentContentHash({
    invoiceNumber,
    patientName,
    patientPhone,
    serviceName,
    originalPrice,
    discount: typeof discount === 'object' ? Number(discount?.amount || 0) : Number(discount || 0),
    netTotal,
  })

  const nowIso = new Date().toISOString()
  const isUnchangedRepeat = Boolean(existingInv && existingInv.contentHash === contentHash)
  const nextVersion = existingInv
    ? isUnchangedRepeat
      ? Number(existingInv.version || 1)
      : Number(existingInv.version || 1) + 1
    : 1

  const invoicePayload = {
    clinic_id: staff.clinicId,
    clinicSlug: slug,
    appointment_id: appointmentId,
    invoiceNumber,
    patientName,
    patientPhone,
    branch_id: String(body.branchId || apptDoc?.branch_id || existingInv?.branch_id || ''),
    branchName,
    date: dateStr,
    serviceName,
    originalPrice,
    discount,
    netTotal,
    paymentMethod: String(body.paymentMethod || apptDoc?.paymentMethod || existingInv?.paymentMethod || 'cash'),
    paymentStatus: String(body.paymentStatus || apptDoc?.paymentStatus || existingInv?.paymentStatus || 'unpaid'),
    version: nextVersion,
    contentHash,
    status: 'issued',
    updatedAt: nowIso,
    ...(existingInv ? {} : { createdAt: nowIso }),
  }

  await writeDocument(`invoices/${rawInvoiceId}`, invoicePayload, true)
  if (appointmentId && apptDoc) {
    await writeDocument(`appointments/${appointmentId}`, { invoice_id: rawInvoiceId }, true).catch(() => null)
  }

  const documentUrl = new URL(
    `/clinic/${encodeURIComponent(slug)}/invoice/${encodeURIComponent(rawInvoiceId)}`,
    req.nextUrl.origin,
  ).href

  const whatsappDispatch = await enqueueDocumentWhatsAppJob({
    clinicId: staff.clinicId,
    clinicSlug: slug,
    clinicName: String(staff.clinic?.clinicName || 'العيادة'),
    doctorName: String(staff.clinic?.doctorName || ''),
    branchName,
    type: 'invoice',
    documentId: rawInvoiceId,
    documentRootKey: rawInvoiceId,
    appointmentId: appointmentId || undefined,
    version: nextVersion,
    contentHash,
    documentUrl,
    patientName,
    patientPhone,
    appointmentDate: dateStr,
    consentRecord: apptDoc || { whatsappConsent: true },
    clinicDoc: staff.clinic,
    waConfig,
  })

  const whatsappStatus = await getClinicDocumentWhatsAppStatus(staff.clinicId, rawInvoiceId, 'invoice')

  return NextResponse.json(
    {
      success: true,
      invoiceId: rawInvoiceId,
      version: nextVersion,
      contentHash,
      deduplicated: isUnchangedRepeat || whatsappDispatch.status === 'deduplicated',
      whatsappDispatch,
      whatsappStatus,
    },
    { headers: noStore },
  )
}
