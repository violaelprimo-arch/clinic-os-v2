import { NextRequest, NextResponse } from 'next/server'
import { processPendingPushOutbox } from '@/lib/server/push-outbox'

/** Manually run push retries with an independent high-entropy admin secret.
 * Scheduled Cloudflare events invoke the worker directly, not this endpoint.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_OUTBOX_CRON_SECRET
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'OUTBOX_ADMIN_NOT_CONFIGURED' }, { status: 503 })
  }
  const provided = req.headers.get('authorization') || ''
  const expected = 'Bearer ' + secret
  if (provided.length !== expected.length ||
      [...provided].reduce((diff, char, i) => diff | (char.charCodeAt(0) ^ expected.charCodeAt(i)), 0) !== 0) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const result = await processPendingPushOutbox(20)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[push-outbox] Manual run failed:',
      error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error: 'PUSH_OUTBOX_UNAVAILABLE' }, { status: 503 })
  }
}
