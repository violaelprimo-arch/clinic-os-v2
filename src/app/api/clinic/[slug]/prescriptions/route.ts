import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import {
  readDocument,
  writeDocument,
  createDocument,
  queryDocumentsByField,
} from '@/lib/server/firebase-rest'
import { isClinicFeatureEnabled, isClinicSuspended } from '@/lib/clinicAccessPolicy'
import {
  enqueueDocumentWhatsAppJob,
  computeDocumentContentHash,
} from '@/lib/server/whatsapp-scheduler'
import { getClinicDocumentWhatsAppStatus } from '@/lib/server/send-clinic-document'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff) return NextResponse.json({ error: 'غير مصرح' }, { status: 401, headers: noStore })

  const docId = req.nextUrl.searchParams.get('id') || req.nextUrl.searchParams.get('appointmentId') || ''
  if (!docId) return NextResponse.json({ error: 'معرف الروشتة مطلوب' }, { status: 400, headers: noStore })
  const whatsappStatus = await getClinicDocumentWhatsAppStatus(staff.clinicId, docId, 'prescription')
  return NextResponse.json({ whatsappStatus }, { headers: noStore })
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
    return NextResponse.json({ error: 'حفظ واعتماد الروشتة متاح للطبيب فقط' }, { status: staff ? 403 : 401, headers: noStore })
  }
  if (isClinicSuspended(staff.clinic)) {
    return NextResponse.json({ error: 'الاشتراك منتهي.' }, { status: 403, headers: noStore })
  }
  if (!isClinicFeatureEnabled(staff.clinic, 'prescriptions')) {
    return NextResponse.json({ error: 'خدمة الروشتات غير مفعلة لهذه العيادة.' }, { status: 403, headers: noStore })
  }

  const body = await req.json().catch(() => ({}))
  const patientName = String(body.patientName || '').trim()
  const patientPhone = String(body.patientPhone || '').trim()
  if (!patientName || !patientPhone) {
    return NextResponse.json({ error: 'اسم المريض ورقم الهاتف مطلوبان' }, { status: 400, headers: noStore })
  }

  const appointmentId =
    typeof body.appointmentId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.appointmentId)
      ? body.appointmentId
      : ''
  const existingRxId =
    typeof body.prescriptionId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.prescriptionId)
      ? body.prescriptionId
      : ''

  let existingRx: any = null
  if (existingRxId) {
    existingRx = await readDocument(`prescriptions/${existingRxId}`).catch(() => null)
    if (existingRx && String(existingRx.clinic_id || '') !== staff.clinicId) {
      return NextResponse.json({ error: 'غير مصرح بتعديل روشتة عيادة أخرى' }, { status: 403, headers: noStore })
    }
  }

  let apptDoc: any = null
  if (appointmentId) {
    apptDoc = await readDocument(`appointments/${appointmentId}`).catch(() => null)
    if (apptDoc && String(apptDoc.clinic_id || '') !== staff.clinicId) {
      return NextResponse.json({ error: 'الموعد لا ينتمي لهذه العيادة' }, { status: 403, headers: noStore })
    }
  }

  const cleanDrugs = Array.isArray(body.drugs)
    ? body.drugs
        .filter((d: any) => d && typeof d.name === 'string' && d.name.trim())
        .map((d: any) => ({
          name: String(d.name).trim(),
          dosage: String(d.dosage || '').trim(),
          duration: String(d.duration || '').trim(),
          notes: String(d.notes || '').trim(),
        }))
    : []

  const contentHash = await computeDocumentContentHash({
    patientName,
    patientPhone,
    age: String(body.age || ''),
    diagnosis: String(body.diagnosis || '').trim(),
    instructions: String(body.instructions || '').trim(),
    notes: String(body.notes || '').trim(),
    vitalSigns: body.vitalSigns || null,
    drugs: cleanDrugs,
  })

  const nowIso = new Date().toISOString()
  const isUnchangedRepeat = Boolean(existingRx && existingRx.contentHash === contentHash)
  const nextVersion = existingRx
    ? isUnchangedRepeat
      ? Number(existingRx.version || 1)
      : Number(existingRx.version || 1) + 1
    : 1

  const rxPayload = {
    clinic_id: staff.clinicId,
    branch_id: String(body.branchId || apptDoc?.branch_id || staff.clinic.branchId || ''),
    branchName: String(body.branchName || apptDoc?.branchName || ''),
    appointment_id: appointmentId,
    patientName,
    patientPhone,
    age: String(body.age || ''),
    diagnosis: String(body.diagnosis || ''),
    instructions: String(body.instructions || ''),
    allergies: String(body.allergies || ''),
    chronicDiseases: String(body.chronicDiseases || ''),
    notes: String(body.notes || '').trim(),
    vitalSigns: body.vitalSigns || null,
    date: String(body.date || nowIso.slice(0, 10)),
    status: 'approved',
    doctorName: String(staff.clinic?.doctorName || 'طبيب العيادة'),
    templateMode: body.templateMode === 'custom' ? 'custom' : 'standard',
    topOffset: Number(body.topOffset ?? 25),
    pageSize: body.pageSize === 'a5' ? 'a5' : 'a4',
    showHeaderFooter: body.showHeaderFooter !== false,
    printBackground: body.printBackground !== false,
    primaryColor: String(body.primaryColor || ''),
    secondaryColor: String(body.secondaryColor || ''),
    drugs: cleanDrugs,
    version: nextVersion,
    contentHash,
    updatedAt: nowIso,
    ...(existingRx ? {} : { createdAt: nowIso }),
  }

  let savedRxId = existingRxId
  if (savedRxId && existingRx) {
    await writeDocument(`prescriptions/${savedRxId}`, rxPayload, true)
  } else {
    savedRxId = `rx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await createDocument('prescriptions', rxPayload, savedRxId)
  }

  if (appointmentId && apptDoc) {
    await writeDocument(
      `appointments/${appointmentId}`,
      {
        diagnosis: rxPayload.diagnosis,
        instructions: rxPayload.instructions,
        notes: rxPayload.notes,
        vitalSigns: rxPayload.vitalSigns,
        drugs: cleanDrugs,
        allergies: rxPayload.allergies,
        chronicDiseases: rxPayload.chronicDiseases,
        prescription_id: savedRxId,
        prescriptionStatus: 'approved',
        prescription_templateMode: rxPayload.templateMode,
      },
      true,
    ).catch(() => null)
  }

  const rootKey = appointmentId || savedRxId
  const shareRecordId = appointmentId || savedRxId
  const documentUrl = new URL(
    `/clinic/${encodeURIComponent(slug)}/prescription/${encodeURIComponent(shareRecordId)}`,
    req.nextUrl.origin,
  ).href

  // Trigger automated WhatsApp delivery strictly from trusted backend (policy + consent + version/hash dedup)
  const consentRecord = apptDoc || (await (async () => {
    const byPhone = await queryDocumentsByField('appointments', 'phone', patientPhone, 5).catch(() => [])
    const sameClinic = byPhone.find((a: any) => a.clinic_id === staff.clinicId)
    return sameClinic || { whatsappConsent: true }
  })())

  const whatsappDispatch = await enqueueDocumentWhatsAppJob({
    clinicId: staff.clinicId,
    clinicSlug: slug,
    clinicName: String(staff.clinic?.clinicName || 'العيادة'),
    doctorName: String(staff.clinic?.doctorName || ''),
    branchName: rxPayload.branchName,
    type: 'prescription',
    documentId: savedRxId,
    documentRootKey: rootKey,
    appointmentId: appointmentId || undefined,
    version: nextVersion,
    contentHash,
    documentUrl,
    patientName,
    patientPhone,
    appointmentDate: rxPayload.date,
    consentRecord,
    clinicDoc: staff.clinic,
  })

  const whatsappStatus = await getClinicDocumentWhatsAppStatus(staff.clinicId, rootKey, 'prescription')

  return NextResponse.json(
    {
      success: true,
      prescriptionId: savedRxId,
      version: nextVersion,
      contentHash,
      deduplicated: isUnchangedRepeat || whatsappDispatch.status === 'deduplicated',
      whatsappDispatch,
      whatsappStatus,
    },
    { headers: noStore },
  )
}
