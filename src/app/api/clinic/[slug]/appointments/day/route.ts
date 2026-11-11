import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { queryDocumentsByFields } from '@/lib/server/firebase-rest'
import { getCairoDateString } from '@/lib/bookingCapacity'
import { computeQueueWatermark } from '@/lib/queueSync'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' }

/** Full clinic/day queue for authenticated doctor and reception only.
 *
 * TV / patient tracking uses the public, redacted /queue response instead.
 * We never return raw patient appointments to anonymous callers or to a
 * receptionist outside their assigned branch.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) {
      return NextResponse.json({ error: 'STAFF_SESSION_REQUIRED' }, {
        status: 401, headers: noStore,
      })
    }

    const date = new URL(req.url).searchParams.get('date') || getCairoDateString()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date + 'T00:00:00Z'))) {
      return NextResponse.json({ error: 'INVALID_QUEUE_DATE' }, {
        status: 400, headers: noStore,
      })
    }

    const snapshotStartedAt = new Date().toISOString()
    const records = await queryDocumentsByFields('appointments', {
      clinic_id: staff.clinicId, date,
    }, 500)
    if (records.length >= 500) {
      // Never report a partial clinic queue as complete.
      return NextResponse.json({ error: 'QUEUE_RESULT_LIMIT_REACHED' }, {
        status: 503, headers: noStore,
      })
    }

    const permitted = records.filter((a: Record<string, any>) =>
      (a.clinic_id || a.clinicId) === staff.clinicId &&
      a.date === date &&
      (staff.user.role !== 'assistant' || !staff.user.branchId ||
        (a.branch_id || a.branchId) === staff.user.branchId)
    )

    const serverTime = new Date().toISOString()
    return NextResponse.json({
      success: true,
      date,
      serverTime,
      queueWatermark: computeQueueWatermark(permitted, snapshotStartedAt),
      appointments: permitted,
      scope: staff.user.role === 'assistant' ? 'assigned_branch' : 'clinic',
    }, { headers: noStore })
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    console.error('[clinic-day-queue] Failed:', /^[A-Z_]+$/.test(code) ? code : 'UNKNOWN')
    return NextResponse.json({
      error: 'CLINIC_DAY_QUEUE_UNAVAILABLE',
    }, { status: 503, headers: noStore })
  }
}
