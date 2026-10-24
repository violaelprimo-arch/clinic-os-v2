import { NextRequest, NextResponse } from 'next/server'
import { registerDeviceSubscription } from '@/lib/pushDispatcher'
import { isValidPushEndpoint } from '@/lib/webPushServer'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

/**
 * Register or update a device push subscription
 * POST /api/push/subscribe
 * Body: { subscription, appointmentId?, clinicId, patientPhone?, userAgent? }
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { subscription, appointmentId, clinicId, patientPhone } = payload

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: 'Valid subscription with endpoint, p256dh, and auth keys is required' },
        { status: 400 }
      )
    }

    if (!isValidPushEndpoint(subscription.endpoint)) {
      return NextResponse.json(
        { error: 'Subscription endpoint is invalid or not allowed' },
        { status: 400 }
      )
    }

    // If appointmentId provided, verify it exists
    if (appointmentId) {
      try {
        const apptSnap = await getDoc(doc(db, 'appointments', appointmentId))
        if (!apptSnap.exists()) {
          return NextResponse.json(
            { error: 'Appointment not found' },
            { status: 404 }
          )
        }
      } catch (err: any) {
        console.warn('Could not verify appointment existence:', err)
      }
    }

    const userAgent = req.headers.get('user-agent') || payload.userAgent || ''

    const result = await registerDeviceSubscription({
      subscription,
      appointmentId,
      clinicId,
      patientPhone,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      subscriptionId: result.subscriptionId,
      message: 'Push notification alerts activated successfully',
    })
  } catch (error: any) {
    console.error('Subscription registration error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to register push subscription' },
      { status: 500 }
    )
  }
}
