import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { createServerNotification } from '@/lib/server/clinic-notifications'
import { dispatchPatientPushNotification } from '@/lib/pushDispatcher'
import { scheduleBackgroundTask } from '@/lib/server/background-task'
import { upsertAppointmentInRoom } from '@/lib/server/queue-room-client'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!sameOriginMutation(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: noStore })
    }

    const { slug } = await params
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' },
        { status: 401, headers: noStore }
      )
    }

    const body = await req.json().catch(() => ({}))
    const appointmentId = String(body?.appointmentId || '')
    const paymentMethod = body?.paymentMethod
    const amount = body?.amount

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId)) {
      return NextResponse.json({ error: 'معرف الحجز مطلوب' }, { status: 400, headers: noStore })
    }

    const apptData = await readDocument(`appointments/${appointmentId}`)
    if (!apptData || ![apptData.clinic_id, apptData.clinicId].includes(staff.clinicId)) {
      return NextResponse.json({ error: 'الحجز غير موجود في هذه العيادة' }, { status: 404, headers: noStore })
    }

    const apptBranch = String(apptData.branch_id || apptData.branchId || '')
    if (staff.user.role === 'assistant' && staff.user.branchId && staff.user.branchId !== apptBranch) {
      return NextResponse.json({ error: 'BRANCH_ACCESS_DENIED' }, { status: 403, headers: noStore })
    }

    const actorName = String(staff.user.name || 'إدارة العيادة')
    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      paymentStatus: 'paid',
      paymentConfirmedAt: now,
      paymentConfirmedBy: actorName,
      confirmedAt: now,
      confirmedBy: actorName,
      updatedAt: now,
    }

    if (paymentMethod) {
      updatePayload.paymentMethod = String(paymentMethod)
    }
    if (amount !== undefined && amount !== null && Number.isFinite(Number(amount))) {
      updatePayload.collectedAmount = Number(amount)
    }

    await writeDocument(`appointments/${appointmentId}`, updatePayload, true)

    const updatedAppointment: Record<string, any> = { ...apptData, ...updatePayload, id: appointmentId }
    const patientPhone = String(apptData.phone || apptData.patientPhone || '').trim()

    await upsertAppointmentInRoom({
      clinicId: staff.clinicId,
      date: String(updatedAppointment.date || ''),
      appointment: updatedAppointment,
      commitIso: now,
      notifyChanged: Boolean(patientPhone),
    }).catch(() => null)
    const clinicName = String(staff.clinic?.clinicName || staff.clinic?.name || 'العيادة')

    if (patientPhone) {
      const eventId = `pay_conf_${appointmentId}`
      const title = 'تم تأكيد استلام الدفع بنجاح'
      const bodyText = `مرحباً ${apptData.patientName || ''}، تم تأكيد دفع رسوم كشف "${apptData.serviceName || clinicName}". نتمنى لك الشفاء العاجل.`

      scheduleBackgroundTask(
        () =>
          Promise.allSettled([
            createServerNotification({
              clinicId: staff.clinicId,
              branchId: apptBranch,
              recipientType: 'patient',
              recipientTarget: patientPhone,
              type: 'payment_confirmed',
              title,
              body: bodyText,
              appointmentId,
              eventId,
            }),
            dispatchPatientPushNotification({
              clinicId: staff.clinicId,
              appointmentId,
              type: 'payment_confirmed',
              title,
              body: bodyText,
              url: `/clinic/${slug}/track/${appointmentId}`,
              eventId: `push_${eventId}`,
              urgency: 'normal',
              ttl: 3600,
            }),
          ]),
        'payment-confirm-notify'
      )
    }

    return NextResponse.json(
      {
        success: true,
        serverTime: now,
        message: 'تم تأكيد استلام الدفع بنجاح وتسجيله في الحسابات',
        appointment: updatedAppointment,
      },
      { headers: noStore }
    )
  } catch (err: any) {
    console.error('Error in payment confirm POST:', err)
    return NextResponse.json(
      { error: 'فشل في تأكيد استلام الدفع: ' + (err?.message || '') },
      { status: 500, headers: noStore }
    )
  }
}
