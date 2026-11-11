import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import {
  executeQueueTransition,
  type QueueTransitionAction,
} from '@/lib/server/queue-transition'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    if (!sameOriginMutation(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: noStore })
    }
    const { slug } = await params
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) {
      return NextResponse.json({ error: 'STAFF_SESSION_REQUIRED' }, { status: 401, headers: noStore })
    }

    const data = await req.json().catch(() => ({}))
    const result = await executeQueueTransition({
      slug,
      staff,
      appointmentId: String(data?.appointmentId || ''),
      action: String(data?.action || '') as QueueTransitionAction,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore })
    }

    return NextResponse.json(result.body, { status: result.status, headers: noStore })
  } catch (err: any) {
    console.error('Error in transition POST:', err)
    return NextResponse.json(
      { error: 'INTERNAL_TRANSITION_ERROR', detail: err?.message || '' },
      { status: 500, headers: noStore },
    )
  }
}
