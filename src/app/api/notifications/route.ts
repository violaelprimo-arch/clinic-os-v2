import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { readDocument, queryDocumentsByField } from '@/lib/server/firebase-rest'
import { getCairoDateString } from '@/lib/bookingCapacity'
import {
  listServerNotifications, markServerNotificationRead, createServerNotification,
} from '@/lib/server/clinic-notifications'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store' }
const normalizePhone = (p: unknown) =>
  String(p || '').replace(/\D/g, '').replace(/^20/, '0')

async function resolveRecipient(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('recipientType') || 'staff'
  if (type === 'staff') {
    const slug = req.nextUrl.searchParams.get('slug') || undefined
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) return null
    return {
      clinicId: staff.clinicId,
      recipientType: 'staff' as const,
      branchId: String(staff.user.branchId || ''),
      recipientTarget: '',
    }
  }
  if (type !== 'patient') return null
  const session = await verifySessionToken(req.cookies.get('patient_session')?.value || '')
  if (!session.valid || session.payload?.role !== 'patient' ||
      typeof session.payload.clinicId !== 'string' ||
      !session.payload.phone) return null
  const user = session.payload
  const requestedClinic = req.nextUrl.searchParams.get('clinicId')
  if (requestedClinic && requestedClinic !== user.clinicId) return null
  return {
    clinicId: String(user.clinicId),
    recipientType: 'patient' as const,
    branchId: '',
    recipientTarget: normalizePhone(user.phone),
  }
}

async function reconcilePatientTurn(
  req: NextRequest,
  recipient: { clinicId: string; recipientTarget: string },
) {
  const appointmentId = req.nextUrl.searchParams.get('appointmentId')
  if (!appointmentId) return
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId))
    throw new Error('INVALID_APPOINTMENT')
  const appointment = await readDocument(`appointments/${appointmentId}`)
  if (!appointment || String(appointment.clinic_id || appointment.clinicId) !== recipient.clinicId ||
      normalizePhone(appointment.phone || appointment.patientPhone) !== recipient.recipientTarget) {
    throw new Error('APPOINTMENT_NOT_OWNED')
  }
  const status = String(appointment.status || 'waiting')
  const sourcePhone = String(appointment.phone || appointment.patientPhone || '')
  if (status === 'in_progress' || status === 'examining') {
    await createServerNotification({
      clinicId: recipient.clinicId,
      branchId: String(appointment.branch_id || appointment.branchId || ''),
      recipientType: 'patient', recipientTarget: sourcePhone,
      title: 'دورك الآن للدخول!',
      body: `حان دورك للدخول إلى غرفة الكشف (رقم ${appointment.queue_number || appointment.queueNumber}).`,
      type: 'turn_ready', appointmentId,
      eventId: `turn_ready_${appointmentId}_${appointment.calledAt || appointment.startedAt || 'started'}`,
    })
    return
  }
  if (status !== 'waiting' || String(appointment.date) !== getCairoDateString()) return
  const all = await queryDocumentsByField('appointments', 'clinic_id', recipient.clinicId, 100)
  const myQueue = Number(appointment.queue_number || appointment.queueNumber)
  const ahead = all.filter(a =>
    a.date === appointment.date &&
    String(a.branch_id || a.branchId || '') === String(appointment.branch_id || appointment.branchId || '') &&
    (a.status === 'waiting' || a.status === 'in_progress' || a.status === 'examining') &&
    Number(a.queue_number || a.queueNumber) < myQueue).length
  if (ahead < 1 || ahead > 5 || !Number.isFinite(myQueue)) return
  await createServerNotification({
    clinicId: recipient.clinicId,
    branchId: String(appointment.branch_id || appointment.branchId || ''),
    recipientType: 'patient', recipientTarget: sourcePhone,
    title: ahead === 1 ? 'أنت المريض التالي للدخول!' : `اقترب دورك: متبقي ${ahead}`,
    body: `متبقي أمامك ${ahead} في انتظار الكشف. يرجى الاستعداد والتواجد بالعيادة.`,
    type: 'approaching_turn', appointmentId,
    eventId: `approaching_${appointmentId}_${ahead}`,
  })
}

export async function GET(req: NextRequest) {
  try {
    const recipient = await resolveRecipient(req)
    if (!recipient) return NextResponse.json({ error: 'LOGIN_REQUIRED' }, { status: 401, headers: noStore })
    if (recipient.recipientType === 'patient' && req.nextUrl.searchParams.has('appointmentId')) {
      try {
        await reconcilePatientTurn(req, recipient)
      } catch (error) {
        if (error instanceof Error && error.message === 'APPOINTMENT_NOT_OWNED') {
          return NextResponse.json({ error: 'FORBIDDEN_APPOINTMENT' }, { status: 403, headers: noStore })
        }
        console.warn('[notifications] Patient queue reconciliation failed:', error instanceof Error ? error.message : 'UNKNOWN')
      }
    }
    const notifications = await listServerNotifications(
      recipient.clinicId, recipient.recipientType, recipient.recipientTarget,
      recipient.recipientType === 'staff'
        ? (req.nextUrl.searchParams.get('branchId') || recipient.branchId)
        : undefined,
    )
    return NextResponse.json({ success: true, notifications }, { headers: noStore })
  } catch (err) {
    console.error('[notifications] Feed failed', err instanceof Error ? err.message : 'UNKNOWN')
    return NextResponse.json({ error: 'NOTIFICATION_FEED_UNAVAILABLE' }, { status: 503, headers: noStore })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin)
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    const recipient = await resolveRecipient(req)
    if (!recipient) return NextResponse.json({ error: 'LOGIN_REQUIRED' }, { status: 401 })
    const data = await req.json().catch(() => ({}))
    const ids: unknown[] = Array.isArray(data.ids) ? data.ids : [data.id]
    const safeIds = ids.filter((x): x is string =>
      typeof x === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(x)).slice(0,50)
    const results = await Promise.all(safeIds.map(id =>
      markServerNotificationRead(id, recipient.clinicId, recipient.recipientType, recipient.recipientTarget)))
    return NextResponse.json({ success: true, updated: results.filter(Boolean).length }, { headers: noStore })
  } catch (err) {
    console.error('[notifications] Read-state update failed', err instanceof Error ? err.message : 'UNKNOWN')
    return NextResponse.json({ error: 'NOTIFICATION_UPDATE_FAILED' }, { status: 503, headers: noStore })
  }
}
