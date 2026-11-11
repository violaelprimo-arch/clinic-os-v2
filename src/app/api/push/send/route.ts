import { NextRequest, NextResponse } from 'next/server'
import { buildPushTag, dispatchPatientPushNotification } from '@/lib/pushDispatcher'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { readDocument } from '@/lib/server/firebase-rest'

/** Staff-only manual push dispatch. Unauthenticated arbitrary text is forbidden. */
export async function POST(req: NextRequest) {
  try {
    if (!sameOriginMutation(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    const staff = await getCurrentClinicStaff(req)
    if (!staff) return NextResponse.json({ error: 'STAFF_SESSION_REQUIRED' }, { status: 401 })
    const data = await req.json().catch(() => ({}))
    if (data.clinicId && data.clinicId !== staff.clinicId) {
      return NextResponse.json({ error: 'WRONG_CLINIC' }, { status: 403 })
    }
    const allowedTypes = ['turn_ready', 'approaching_turn', 'booking_rescheduled', 'booking_cancelled']
    if (!allowedTypes.includes(data.type) || typeof data.appointmentId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(data.appointmentId)) {
      return NextResponse.json({ error: 'INVALID_EVENT_OR_APPOINTMENT' }, { status: 400 })
    }
    const appt = await readDocument(`appointments/${data.appointmentId}`)
    if (!appt || ![appt.clinic_id, appt.clinicId].includes(staff.clinicId)) {
      return NextResponse.json({ error: 'FORBIDDEN_APPOINTMENT' }, { status: 403 })
    }
    const type = String(data.type)
    const titles: Record<string, string> = {
      turn_ready: 'حان دورك الآن!',
      approaching_turn: 'اقترب دورك',
      booking_rescheduled: 'تم تعديل موعد حجزك',
      booking_cancelled: 'تم إلغاء الحجز',
    }
    const result = await dispatchPatientPushNotification({
      type, clinicId: staff.clinicId, appointmentId: data.appointmentId,
      title: titles[type], body: 'راجع صفحة متابعة حجزك لمعرفة التفاصيل.',
      url: `/clinic/${encodeURIComponent(String(staff.user.slug))}/track/${data.appointmentId}`,
      tag: buildPushTag(type, data.appointmentId, String(appt.calledAt || appt.updatedAt || '').slice(-6)),
      eventId: `staff_${type}_${data.appointmentId}_${String(appt.calledAt || appt.updatedAt || '')}`,
      urgency: type === 'turn_ready' || type === 'approaching_turn' ? 'high' : 'normal',
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[push] Dispatch failed:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error: 'PUSH_DISPATCH_UNAVAILABLE' }, { status: 503 })
  }
}
