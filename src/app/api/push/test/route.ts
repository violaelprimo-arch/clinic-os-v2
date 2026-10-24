import { NextRequest, NextResponse } from 'next/server'
import { sendWebPushNotification } from '@/lib/webPushServer'
import { getSubscriptionId } from '@/lib/pushDispatcher'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

/**
 * Send an immediate real test notification to verify device connectivity
 * POST /api/push/test
 * Body: { endpoint, clinicId?, appointmentId?, clinicSlug? }
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { endpoint, clinicSlug, appointmentId } = payload

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Subscription endpoint is required' },
        { status: 400 }
      )
    }

    const subId = await getSubscriptionId(endpoint)
    const docRef = doc(db, 'push_subscriptions', subId)
    const snap = await getDoc(docRef)

    let subscriptionKeys: { p256dh: string; auth: string } | null = null

    if (snap.exists()) {
      const data = snap.data()
      subscriptionKeys = data.keys
    } else {
      // Check legacy doc
      const legacySnap = await getDoc(doc(db, 'pushSubscriptions', subId))
      if (legacySnap.exists()) {
        const leg = legacySnap.data()
        subscriptionKeys = leg.keys || leg.subscription?.keys
      }
    }

    if (!subscriptionKeys?.p256dh || !subscriptionKeys?.auth) {
      return NextResponse.json(
        { error: 'Subscription keys not found for this device. Please reactivate alerts.' },
        { status: 404 }
      )
    }

    const targetUrl = appointmentId && clinicSlug
      ? `/clinic/${clinicSlug}/track/${appointmentId}`
      : '/'

    const result = await sendWebPushNotification(
      {
        endpoint,
        keys: subscriptionKeys,
      },
      {
        title: '🔔 اختبار تنبيهات Yalla Clinic',
        body: 'تم استلام الإشعار التجريبي بنجاح! جهازك متصل الآن ومستعد لاستقبال تنبيهات حجزك في الخلفية.',
        icon: '/brand/yalla-clinic/app-icon.png',
        badge: '/favicon-32x32.png',
        url: targetUrl,
        tag: `test-push-${Date.now()}`,
        type: 'test_notification',
        appointmentId,
        ttl: 120,
        urgency: 'high',
      }
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'تم إرسال الإشعار التجريبي بنجاح إلى جهازك',
        gatewayStatus: result.status,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Gateway returned non-success response',
          gatewayStatus: result.status,
          gone: result.gone,
        },
        { status: 502 }
      )
    }
  } catch (error: any) {
    console.error('Error sending test push:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch test notification' },
      { status: 500 }
    )
  }
}
