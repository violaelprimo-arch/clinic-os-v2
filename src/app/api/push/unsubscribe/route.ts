import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeDevice } from '@/lib/pushDispatcher'
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
      return NextResponse.json({ error: 'PUSH_UNSUBSCRIBE_NOT_AUTHORIZED' }, { status: 403 })
    }
    const result = await unsubscribeDevice({
      endpoint: data.endpoint, appointmentId: target.appointmentId,
      clinicId: target.clinicId, role: target.role,
    })
    return NextResponse.json({ success: result.success })
  } catch (error) {
    console.error('[push] Unsubscribe failed:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error: 'PUSH_UNSUBSCRIBE_FAILED' }, { status: 503 })
  }
}
