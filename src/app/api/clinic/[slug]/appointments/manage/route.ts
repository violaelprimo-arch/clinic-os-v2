import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { isFirestoreQuotaError, readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { upsertAppointmentInRoom } from '@/lib/server/queue-room-client'
import {
  handleAppointmentRescheduled,
  enqueueDocumentWhatsAppJob,
  computeDocumentContentHash,
} from '@/lib/server/whatsapp-scheduler'
import { scheduleBackgroundTask } from '@/lib/server/background-task'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
}

type ManageAction = 'edit_turn' | 'reject_payment' | 'discount' | 'reschedule'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    if (!sameOriginMutation(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: noStore })
    }

    const { slug } = await params
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) {
      return NextResponse.json({ error: 'STAFF_SESSION_REQUIRED' }, { status: 401, headers: noStore })
    }

    const body = await req.json().catch(() => ({}))
    const appointmentId = String(body?.appointmentId || '')
    const action = String(body?.action || '') as ManageAction
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId) ||
      !['edit_turn', 'reject_payment', 'discount', 'reschedule'].includes(action)
    ) {
      return NextResponse.json({ error: 'INVALID_APPOINTMENT_ACTION' }, { status: 400, headers: noStore })
    }

    const apptData = await readDocument(`appointments/${appointmentId}`)
    if (!apptData || ![apptData.clinic_id, apptData.clinicId].includes(staff.clinicId)) {
      return NextResponse.json({ error: 'APPOINTMENT_NOT_IN_CLINIC' }, { status: 404, headers: noStore })
    }

    const apptBranch = String(apptData.branch_id || apptData.branchId || '')
    if (
      staff.user.role === 'assistant' &&
      staff.user.branchId &&
      staff.user.branchId !== apptBranch
    ) {
      return NextResponse.json({ error: 'BRANCH_ACCESS_DENIED' }, { status: 403, headers: noStore })
    }

    const now = new Date().toISOString()
    let patch: Record<string, unknown>

    if (action === 'edit_turn') {
      const nextQueue = Number(body?.queueNumber)
      if (!Number.isFinite(nextQueue) || nextQueue < 1 || nextQueue > 5000) {
        return NextResponse.json({ error: 'INVALID_QUEUE_NUMBER' }, { status: 400, headers: noStore })
      }
      const nextServiceName =
        typeof body?.serviceName === 'string' && body.serviceName.trim()
          ? body.serviceName.trim().slice(0, 120)
          : String(apptData.serviceName || 'كشف')
      patch = {
        queue_number: Math.floor(nextQueue),
        serviceName: nextServiceName,
        isUrgent: Boolean(body?.isUrgent),
        updatedAt: now,
      }
    } else if (action === 'reject_payment') {
      patch = {
        paymentStatus: 'unpaid',
        paymentRejectedAt: now,
        paymentRejectedBy: String(staff.user.name || 'staff'),
        updatedAt: now,
      }
    } else if (action === 'reschedule') {
      const nextDate = typeof body?.newDate === 'string' ? body.newDate.trim() : ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
        return NextResponse.json({ error: 'INVALID_RESCHEDULE_DATE' }, { status: 400, headers: noStore })
      }
      const nextTime = typeof body?.newTime === 'string' ? body.newTime.trim().slice(0, 32) : String(apptData.time || '')
      const nextVersion = Number(apptData.scheduleVersion || 1) + 1
      patch = {
        date: nextDate,
        time: nextTime || 'حسب الدور',
        whatsappReminderTime: typeof body?.newTime === 'string' && body.newTime.trim() ? body.newTime.trim() : (apptData.whatsappReminderTime || null),
        whatsappHasFixedTime: Boolean(typeof body?.newTime === 'string' && body.newTime.trim() ? true : apptData.whatsappHasFixedTime),
        scheduleVersion: nextVersion,
        rescheduledAt: now,
        updatedAt: now,
      }
    } else {
      const origPrice = Number(apptData.originalPrice ?? apptData.servicePrice) || 0
      const discountType = body?.discountType === 'percentage' ? 'percentage' : 'fixed'
      const rawValue = Number(body?.discountValue)
      if (!Number.isFinite(rawValue) || rawValue < 0 || rawValue > 1000000) {
        return NextResponse.json({ error: 'INVALID_DISCOUNT_VALUE' }, { status: 400, headers: noStore })
      }
      let discountAmount = 0
      let newPrice = origPrice
      if (rawValue > 0) {
        discountAmount =
          discountType === 'percentage'
            ? (origPrice * Math.min(100, rawValue)) / 100
            : rawValue
        newPrice = Math.max(0, origPrice - discountAmount)
      }
      patch = {
        originalPrice: origPrice,
        servicePrice: newPrice,
        discount:
          rawValue > 0
            ? {
                type: discountType,
                value: discountType === 'percentage' ? Math.min(100, rawValue) : rawValue,
                amount: discountAmount,
                appliedAt: now,
              }
            : null,
        updatedAt: now,
      }
    }

    await writeDocument(`appointments/${appointmentId}`, patch, true)
    const updatedAppointment: Record<string, any> = { ...apptData, ...patch, id: appointmentId }

    await upsertAppointmentInRoom({
      clinicId: staff.clinicId,
      date: String(updatedAppointment.date || ''),
      appointment: updatedAppointment,
      clinic: staff.clinic,
      commitIso: now,
    }).catch(() => null)

    if (action === 'reschedule') {
      scheduleBackgroundTask(
        () =>
          handleAppointmentRescheduled({
            clinicId: staff.clinicId,
            clinicSlug: slug,
            clinicName: String(staff.clinic?.clinicName || staff.clinic?.name || ''),
            doctorName: String(staff.clinic?.doctorName || ''),
            branchName: String(updatedAppointment.branchName || ''),
            appointmentId,
            patientName: String(updatedAppointment.patientName || 'المريض'),
            patientPhone: String(updatedAppointment.phone || ''),
            newDate: String(updatedAppointment.date || ''),
            newTime: String(updatedAppointment.whatsappReminderTime || updatedAppointment.time || ''),
            whatsappConsent: Boolean(updatedAppointment.whatsappConsent),
            whatsappConsentPreferences: updatedAppointment.whatsappConsentPreferences,
            scheduleVersion: Number(updatedAppointment.scheduleVersion || 2),
            hasFixedTime: Boolean(updatedAppointment.whatsappHasFixedTime),
            clinicDoc: staff.clinic,
          }),
        'whatsapp-reschedule',
      )
    }

    if (action === 'discount') {
      const existingInv = await readDocument(`invoices/${appointmentId}`).catch(() => null)
      if (existingInv) {
        const discountVal = updatedAppointment.discount?.amount || 0
        const invoiceNumber = String(existingInv.invoiceNumber || `INV-${appointmentId.slice(-6).toUpperCase()}`)
        const nextHash = await computeDocumentContentHash({
          invoiceNumber,
          patientName: String(updatedAppointment.patientName || ''),
          patientPhone: String(updatedAppointment.phone || ''),
          serviceName: String(updatedAppointment.serviceName || 'كشف طبي'),
          originalPrice: Number(updatedAppointment.originalPrice ?? updatedAppointment.servicePrice ?? 0),
          discount: Number(discountVal),
          netTotal: Number(updatedAppointment.servicePrice ?? 0),
        })
        const nextVer = Number(existingInv.version || 1) + 1
        await writeDocument(
          `invoices/${appointmentId}`,
          {
            originalPrice: Number(updatedAppointment.originalPrice ?? updatedAppointment.servicePrice ?? 0),
            netTotal: Number(updatedAppointment.servicePrice ?? 0),
            discount: updatedAppointment.discount || 0,
            version: nextVer,
            contentHash: nextHash,
            updatedAt: now,
          },
          true,
        ).catch(() => null)
        const docUrl = new URL(`/clinic/${encodeURIComponent(slug)}/invoice/${encodeURIComponent(appointmentId)}`, req.nextUrl.origin).href
        scheduleBackgroundTask(
          () =>
            enqueueDocumentWhatsAppJob({
              clinicId: staff.clinicId,
              clinicSlug: slug,
              clinicName: String(staff.clinic?.clinicName || staff.clinic?.name || ''),
              doctorName: String(staff.clinic?.doctorName || ''),
              branchName: String(updatedAppointment.branchName || ''),
              type: 'invoice',
              documentId: appointmentId,
              documentRootKey: appointmentId,
              appointmentId,
              version: nextVer,
              contentHash: nextHash,
              documentUrl: docUrl,
              patientName: String(updatedAppointment.patientName || 'المريض'),
              patientPhone: String(updatedAppointment.phone || ''),
              appointmentDate: String(updatedAppointment.date || ''),
              consentRecord: updatedAppointment,
              clinicDoc: staff.clinic,
            }),
          'whatsapp-invoice-edit',
        )
      }
    }

    return NextResponse.json(
      {
        success: true,
        serverTime: now,
        appointment: updatedAppointment,
      },
      { headers: noStore },
    )
  } catch (err) {
    const isQuota = isFirestoreQuotaError(err)
    console.error('[appointments/manage] Failed:', isQuota ? 'QUOTA_EXHAUSTED' : err)
    return NextResponse.json(
      { error: isQuota ? 'FIRESTORE_QUOTA_EXHAUSTED' : 'APPOINTMENT_UPDATE_FAILED' },
      { status: isQuota ? 503 : 500, headers: noStore },
    )
  }
}
