import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionId } from '@/lib/pushDispatcher'
import { sendWebPushNotification } from '@/lib/webPushServer'
import { authorizePushTarget, sameOriginMutation } from '@/lib/server/push-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { getVapidConfig } from '@/lib/webPushServer'

export async function POST(req: NextRequest) {
  try {
    if (!sameOriginMutation(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    const data = await req.json().catch(() => ({}))
    const role = data.role === 'staff' ? 'staff' : 'patient'
    const target = await authorizePushTarget(req, {
      role, clinicId: String(data.clinicId || ''), appointmentId: data.appointmentId,
      pushClaim: data.pushClaim,
    })
    if (!target || typeof data.endpoint !== 'string') {
      return NextResponse.json({ error: 'VERIFIED_DEVICE_REQUIRED' }, { status: 403 })
    }
    const id = await getSubscriptionId(data.endpoint)
    const path = `push_subscriptions/${id}`
    const sub = await readDocument(path)
    if (!sub || sub.endpoint !== data.endpoint || sub.status !== 'active' ||
        sub.clinicId !== target.clinicId || sub.role !== target.role ||
        sub.vapidPublicKey !== getVapidConfig().publicKey ||
        (role === 'patient' && (!Array.isArray(sub.appointmentIds) ||
          !sub.appointmentIds.includes(target.appointmentId)))) {
      return NextResponse.json({ error: 'DEVICE_NOT_REGISTERED_FOR_THIS_BOOKING' }, { status: 403 })
    }
    if (sub.lastTestAt && Date.now() - Date.parse(String(sub.lastTestAt)) < 60000) {
      return NextResponse.json({ error: 'TEST_RATE_LIMITED_TRY_AGAIN_IN_ONE_MINUTE' }, { status: 429 })
    }
    await writeDocument(path, { lastTestAt: new Date().toISOString() }, true)
    const result = await sendWebPushNotification({
      endpoint: String(sub.endpoint),
      keys: sub.keys as { p256dh: string; auth: string },
    }, {
      title: 'اختبار إشعارات Yalla Clinic',
      body: 'تم إرسال تنبيه تجريبي لجهازك. إذا ظهر في شريط النظام فالخدمة تعمل.',
      url: role === 'patient' && data.appointmentId && data.clinicSlug
        ? `/clinic/${encodeURIComponent(String(data.clinicSlug))}/track/${encodeURIComponent(String(data.appointmentId))}`
        : '/',
      type: 'test_notification', tag: `push-test-${id}-${Date.now()}`,
      ttl: 120, urgency: 'high',
    })
    if (!result.success) {
      return NextResponse.json({
        success: false, error: result.error || 'PUSH_GATEWAY_REJECTED',
        gatewayStatus: result.status,
      }, { status: 502 })
    }
    return NextResponse.json({
      success: true, gatewayStatus: result.status,
      message: 'تم قبول الإشعار بواسطة خدمة Push، تأكد من وصوله لشريط إشعارات جهازك.',
    })
  } catch (error) {
    console.error('[push] Test failed:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error: 'PUSH_TEST_UNAVAILABLE' }, { status: 503 })
  }
}
