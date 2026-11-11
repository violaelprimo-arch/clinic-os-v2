import { NextRequest, NextResponse } from 'next/server'
import { authorizePushTarget, sameOriginMutation } from '@/lib/server/push-access'
import { getSubscriptionId } from '@/lib/pushDispatcher'
import { readDocument } from '@/lib/server/firebase-rest'

/** Checks actual server-side subscription; browser permission alone is insufficient. */
export async function POST(req: NextRequest) {
  try {
    if (!sameOriginMutation(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    const data = await req.json().catch(() => ({}))
    const role = data.role === 'staff' ? 'staff' : 'patient'
    const target = await authorizePushTarget(req, {
      role, clinicId: String(data.clinicId || ''), appointmentId: data.appointmentId,
      pushClaim: data.pushClaim,
    })
    if (!target) return NextResponse.json({ registered: false, error: 'VERIFIED_ACCOUNT_REQUIRED' }, { status: 403 })
    if (typeof data.endpoint !== 'string' || data.endpoint.length > 2048) {
      return NextResponse.json({ registered: false }, { status: 400 })
    }
    const id = await getSubscriptionId(data.endpoint)
    const record = await readDocument(`push_subscriptions/${id}`)
    const registered = !!record && record.status === 'active' &&
      record.endpoint === data.endpoint && record.clinicId === target.clinicId &&
      record.role === target.role &&
      (role === 'staff' ||
        (Array.isArray(record.appointmentIds) && record.appointmentIds.includes(target.appointmentId)))
    return NextResponse.json({ registered, status: registered ? 'active' : 'not_registered' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[push] Status unavailable:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ registered: false, error: 'PUSH_STATUS_UNAVAILABLE' }, { status: 503 })
  }
}
