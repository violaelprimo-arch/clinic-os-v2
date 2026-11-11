import { NextRequest, NextResponse } from 'next/server'
import { executeDeviceTestPush } from '@/lib/pushDispatcher'
import { authorizePushTarget, sameOriginMutation } from '@/lib/server/push-access'

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
    const result = await executeDeviceTestPush({
      endpoint: data.endpoint,
      role: target.role,
      clinicId: target.clinicId,
      clinicSlug: typeof data.clinicSlug === 'string' ? data.clinicSlug : undefined,
      appointmentId: target.appointmentId,
    })
    if (!result.ok) {
      return NextResponse.json({
        success: false,
        error: result.error,
        ...(result.gatewayStatus !== undefined ? { gatewayStatus: result.gatewayStatus } : {}),
      }, { status: result.status })
    }
    return NextResponse.json({
      success: true,
      gatewayStatus: result.gatewayStatus,
      message: result.message,
    })
  } catch (error) {
    console.error('[push] Test failed:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error: 'PUSH_TEST_UNAVAILABLE' }, { status: 503 })
  }
}
