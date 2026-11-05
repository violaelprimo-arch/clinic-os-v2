import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'
import { createClinicNotification } from '@/lib/notificationService'
import { triggerPatientEventPush } from '@/lib/patientNotificationHelper'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const sessionToken =
      req.cookies.get('clinic_session')?.value ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'جلسة الدخول غير صالحة أو منتهية' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { appointmentId, paymentMethod, amount } = body

    if (!appointmentId) {
      return NextResponse.json({ error: 'معرف الحجز مطلوب' }, { status: 400 })
    }

    const apptRef = doc(db, 'appointments', appointmentId)
    const apptSnap = await getDoc(apptRef)

    if (!apptSnap.exists()) {
      return NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 })
    }

    const apptData = apptSnap.data()
    const actorName = session.payload.name || 'إدارة العيادة'

    const updatePayload: any = {
      paymentStatus: 'paid',
      paymentConfirmedAt: new Date().toISOString(),
      paymentConfirmedBy: actorName,
      confirmedAt: new Date().toISOString(),
      confirmedBy: actorName
    }

    if (paymentMethod) {
      updatePayload.paymentMethod = paymentMethod
    }
    if (amount !== undefined) {
      updatePayload.collectedAmount = Number(amount)
    }

    await updateDoc(apptRef, updatePayload)

    // Trigger clinic and push notifications
    if (apptData.phone) {
      try {
        await createClinicNotification({
          clinicId: apptData.clinic_id,
          branchId: apptData.branch_id,
          recipientType: 'patient',
          recipientTarget: apptData.phone,
          title: 'تم تأكيد استلام الدفع بنجاح',
          body: `مرحباً ${apptData.patientName}، تم تأكيد دفع رسوم كشف "${apptData.serviceName || 'العيادة'}". نتمنى لك الشفاء العاجل.`,
          type: 'payment_confirmed',
          eventId: `pay_conf_${appointmentId}`,
          appointmentId
        })

        triggerPatientEventPush({
          type: 'payment_confirmed',
          appointmentId,
          clinicId: apptData.clinic_id,
          clinicSlug: slug,
          clinicName: 'العيادة',
          patientPhone: apptData.phone,
          queueNumber: apptData.queue_number,
          eventId: `push_pay_conf_${appointmentId}`
        }).catch(() => {})
      } catch (notifyErr) {
        console.warn('Payment confirmation notification warning:', notifyErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم تأكيد استلام الدفع بنجاح وتسجيله في الحسابات',
      appointment: { id: appointmentId, ...apptData, ...updatePayload }
    })
  } catch (err: any) {
    console.error('Error in payment confirm POST:', err)
    return NextResponse.json(
      { error: 'فشل في تأكيد استلام الدفع: ' + (err.message || '') },
      { status: 500 }
    )
  }
}
