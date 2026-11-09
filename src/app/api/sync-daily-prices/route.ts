import { NextRequest, NextResponse } from 'next/server'
import { runMedicineSync, getCairoDateString } from '@/lib/server/medicine-sync-service'
import { verifySessionToken } from '@/lib/auth-crypto'
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/owner-session'
import { queryDocuments, readDocument } from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

/**
 * Authorize caller for medicine sync:
 * 1. Platform Owner (OWNER_COOKIE or Bearer ID Token)
 * 2. Clinic Doctor (clinic_session cookie or Bearer token)
 * 3. Cloudflare Cron Trigger (x-cron-secret or cron=1 query parameter with internal check)
 */
async function authorizeSyncRequest(req: NextRequest): Promise<{
  authorized: boolean
  role?: 'owner' | 'doctor' | 'cron'
  error?: string
}> {
  // 1. Cron Trigger check
  const cronHeader = req.headers.get('x-cron-secret')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET || 'clinic-os-cron-key-2026'
  if (cronHeader && cronHeader === cronSecret) {
    return { authorized: true, role: 'cron' }
  }

  // Cloudflare internal scheduled call check
  if (req.headers.get('cf-worker') || req.headers.get('x-cloudflare-cron')) {
    return { authorized: true, role: 'cron' }
  }

  // 2. Owner Session check
  const ownerCookie = req.cookies.get(OWNER_COOKIE)?.value
  if (ownerCookie) {
    const secret = process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
    if (secret.length >= 32) {
      const owner = await verifyOwnerSession(ownerCookie, secret).catch(() => null)
      if (owner && process.env.PLATFORM_OWNER_UID && owner.uid === process.env.PLATFORM_OWNER_UID) {
        return { authorized: true, role: 'owner' }
      }
    }
  }

  // 3. Clinic Doctor session check
  const clinicCookie = req.cookies.get('clinic_session')?.value
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null
  const candidateToken = clinicCookie || bearerToken

  if (candidateToken) {
    const session: any = await verifySessionToken(candidateToken).catch(() => ({ valid: false, payload: undefined }))
    if (session.valid && session.payload) {
      if (session.payload.role === 'doctor' || session.payload.role === 'owner') {
        return { authorized: true, role: session.payload.role as any }
      }
    }
  }

  return { authorized: false, error: 'غير مصرح لك بتشغيل مزامنة دليل الأدوية. يرجى تسجيل الدخول كطبيب عيادة أو مالك المنصة.' }
}

/**
 * GET: Get the latest sync status and sync history logs.
 * If ?cron=1 is supplied with valid secret, execute sync.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const isCron = searchParams.get('cron') === '1'

    if (isCron) {
      const auth = await authorizeSyncRequest(req)
      if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: 401 })
      }
      const syncResult = await runMedicineSync({
        triggeredBy: 'cron',
        force: searchParams.get('force') === '1'
      })
      return NextResponse.json({ success: syncResult.status !== 'FAILED', ...syncResult })
    }

    // Return sync logs and current status
    const logs = await queryDocuments('market_prices_sync_logs').catch(() => [])
    const sortedLogs = logs.sort((a: any, b: any) =>
      new Date(String(b.timestamp || 0)).getTime() - new Date(String(a.timestamp || 0)).getTime()
    )
    const latestLog = sortedLogs[0] || null

    // Check lock status
    const lock = (await readDocument('sync_locks/market_prices').catch(() => null)) as any
    const isCurrentlyRunning = lock && lock.lockedAt && (Date.now() - new Date(String(lock.lockedAt)).getTime() < 15 * 60 * 1000)

    return NextResponse.json({
      success: true,
      currentCairoDate: getCairoDateString(),
      isRunning: Boolean(isCurrentlyRunning),
      latestSync: latestLog,
      recentLogs: sortedLogs.slice(0, 10)
    })
  } catch (error: any) {
    console.error('Error in sync-daily-prices GET:', error)
    return NextResponse.json({ error: error.message || 'Error fetching sync status' }, { status: 500 })
  }
}

/**
 * POST: Trigger an on-demand sync of medicine prices from DawaaGate.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeSyncRequest(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'غير مصرح' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const query = body.query || req.nextUrl.searchParams.get('q') || undefined
    const pages = Number(body.pages || req.nextUrl.searchParams.get('pages')) || 2
    const force = Boolean(body.force || req.nextUrl.searchParams.get('force') === '1')

    const triggeredBy = auth.role === 'owner' ? 'manual_owner' : auth.role === 'doctor' ? 'manual_doctor' : 'cron'

    const syncResult = await runMedicineSync({
      triggeredBy,
      query,
      pages,
      force
    })

    return NextResponse.json({
      success: syncResult.status !== 'FAILED',
      ...syncResult
    })
  } catch (error: any) {
    console.error('Error in sync-daily-prices POST:', error)
    return NextResponse.json({ error: error.message || 'Error executing sync' }, { status: 500 })
  }
}
