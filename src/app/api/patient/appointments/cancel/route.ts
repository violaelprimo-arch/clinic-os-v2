import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { isFirestoreQuotaError, readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { upsertAppointmentInRoom } from '@/lib/server/queue-room-client'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
}

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '').replace(/^20/, '0')
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOriginMutation(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: noStore })
    }

    const body = await req.json().catch(() => ({}))
    const appointmentId = String(body?.appointmentId || '')
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : undefined
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId)) {
      return NextResponse.json({ error: 'INVALID_APPOINTMENT_ID' }, { status: 400, headers: noStore })
    }

    const apptData = await readDocument(`appointments/${appointmentId}`)
    if (!apptData) {
      return NextResponse.json({ error: 'APPOINTMENT_NOT_FOUND' }, { status: 404, headers: noStore })
    }
    const apptClinicId = String(apptData.clinic_id || apptData.clinicId || '')

    let authorized = false
    const patientToken =
      req.cookies.get('patient_session')?.value ||
      (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()

    if (patientToken) {
      const verified = await verifySessionToken(patientToken)
      if (
        verified.valid &&
        verified.payload?.role === 'patient' &&
        String(verified.payload?.clinicId || '') === apptClinicId &&
        normalizePhone(verified.payload?.phone) !== '' &&
        normalizePhone(verified.payload?.phone) ===
          normalizePhone(apptData.phone || apptData.patientPhone)
      ) {
        authorized = true
      }
    }

    if (!authorized) {
      const staff = await getCurrentClinicStaff(req, slug)
      if (
        staff &&
        staff.clinicId === apptClinicId &&
        (staff.user.role !== 'assistant' ||
          !staff.user.branchId ||
          staff.user.branchId === String(apptData.branch_id || apptData.branchId || ''))
      ) {
        authorized = true
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'UNAUTHORIZED_CANCELLATION' }, { status: 401, headers: noStore })
    }

    if (['completed', 'in_progress', 'examining'].includes(String(apptData.status || ''))) {
      return NextResponse.json({ error: 'APPOINTMENT_CANNOT_BE_CANCELLED' }, { status: 409, headers: noStore })
    }

    const now = new Date().toISOString()
    const patch = {
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    }

    await writeDocument(`appointments/${appointmentId}`, patch, true)
    const updatedAppointment: Record<string, any> = { ...apptData, ...patch, id: appointmentId }

    await upsertAppointmentInRoom({
      clinicId: apptClinicId,
      date: String(updatedAppointment.date || ''),
      appointment: updatedAppointment,
      commitIso: now,
    }).catch(() => null)

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
    console.error('[patient/appointments/cancel] Failed:', isQuota ? 'QUOTA_EXHAUSTED' : err)
    return NextResponse.json(
      { error: isQuota ? 'FIRESTORE_QUOTA_EXHAUSTED' : 'CANCELLATION_FAILED' },
      { status: isQuota ? 503 : 500, headers: noStore },
    )
  }
}
