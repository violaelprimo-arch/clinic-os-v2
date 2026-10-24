import { NextRequest, NextResponse } from 'next/server'
import { dispatchPatientPushNotification } from '@/lib/pushDispatcher'

/**
 * Real Web Push Central Dispatch API Route
 * POST /api/push/send
 * Body: { type, appointmentId?, clinicId, branchId?, patientPhone?, title, body, icon?, url?, tag?, eventId?, ttl?, urgency? }
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const {
      type = 'general',
      appointmentId,
      clinicId,
      branchId,
      patientPhone,
      title,
      body,
      icon,
      url,
      tag,
      eventId,
      ttl,
      urgency,
    } = payload

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    if (!clinicId && !appointmentId && !patientPhone) {
      return NextResponse.json(
        { error: 'At least one target (clinicId, appointmentId, or patientPhone) is required' },
        { status: 400 }
      )
    }

    const result = await dispatchPatientPushNotification({
      type,
      appointmentId,
      clinicId: clinicId || '',
      branchId,
      patientPhone,
      title,
      body,
      icon,
      url,
      tag,
      eventId,
      ttl,
      urgency,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error dispatching push notification:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
