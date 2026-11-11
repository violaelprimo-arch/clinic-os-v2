import { NextRequest, NextResponse } from 'next/server'
import { registerDeviceSubscription } from '@/lib/pushDispatcher'
import { isValidPushEndpoint } from '@/lib/webPushServer'
import { authorizePushTarget, sameOriginMutation } from '@/lib/server/push-access'

export async function POST(req: NextRequest) {
  try {
    if (!sameOriginMutation(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    const data = await req.json().catch(() => ({}))
    const subscription = data.subscription
    const role = data.role === 'staff' ? 'staff' : 'patient'
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth ||
        !isValidPushEndpoint(subscription.endpoint)) {
      return NextResponse.json({ error: 'INVALID_SUBSCRIPTION' }, { status: 400 })
    }
    const target = await authorizePushTarget(req, {
      role, clinicId: String(data.clinicId || ''), appointmentId: data.appointmentId,
      pushClaim: data.pushClaim,
    })
    if (!target) {
      return NextResponse.json({ error: 'PUSH_REGISTRATION_REQUIRES_VERIFIED_BOOKING_OR_LOGIN' }, { status: 403 })
    }
    const saved = await registerDeviceSubscription({
      subscription, clinicId: target.clinicId, appointmentId: target.appointmentId,
      userAgent: req.headers.get('user-agent') || '', role: target.role,
    })
    return NextResponse.json({
      success: true, subscriptionId: saved.subscriptionId,
      message: 'DEVICE_SUBSCRIPTION_SAVED',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[push] Subscribe failed:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error: 'PUSH_SUBSCRIPTION_UNAVAILABLE' }, { status: 503 })
  }
}
