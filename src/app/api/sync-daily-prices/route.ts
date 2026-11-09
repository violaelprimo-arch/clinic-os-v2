import { NextRequest, NextResponse } from 'next/server'
import { runMedicineSync, getCairoDateString } from '@/lib/server/medicine-sync-service'
import { verifySessionToken } from '@/lib/auth-crypto'
import { authenticateOwnerRequest, assertSameOrigin } from '@/lib/server/owner-access'
import { queryDocuments, readDocument } from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

// In-memory sliding rate limiter: Max 1 manual sync every 15 minutes per account/IP
const manualSyncRateLimits = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function enforceManualSyncRateLimit(key: string): { allowed: boolean; waitMinutes: number } {
  const now = Date.now()
  const lastTime = manualSyncRateLimits.get(key) || 0
  const elapsed = now - lastTime

  if (elapsed < RATE_LIMIT_WINDOW_MS) {
    const remainingMs = RATE_LIMIT_WINDOW_MS - elapsed
    return { allowed: false, waitMinutes: Math.ceil(remainingMs / 60000) }
  }

  manualSyncRateLimits.set(key, now)
  return { allowed: true, waitMinutes: 0 }
}

/**
 * Strict Authorization for Medicine Sync:
 * ONLY Platform Owner or Authenticated Clinic Doctor of an active clinic.
 * NO spoofable HTTP headers (cf-worker, x-cloudflare-cron) are accepted.
 * NO static fallback secrets exist.
 */
async function authorizeSyncRequest(req: NextRequest): Promise<{
  authorized: boolean
  role?: 'owner' | 'doctor'
  userId?: string
  error?: string
}> {
  // 1. Check Platform Owner
  const owner = await authenticateOwnerRequest(req).catch(() => null)
  if (owner) {
    return { authorized: true, role: 'owner', userId: owner.uid || owner.email }
  }

  // 2. Check Clinic Doctor Session
  const clinicCookie = req.cookies.get('clinic_session')?.value
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null
  const candidateToken = clinicCookie || bearerToken

  if (candidateToken) {
    const session = await verifySessionToken(candidateToken).catch(() => ({ valid: false, payload: undefined }))
    if (session.valid && session.payload && session.payload.role === 'doctor') {
      const clinicId = session.payload.clinicId
      if (typeof clinicId === 'string' && clinicId) {
        const clinic = (await readDocument(`clinics/${clinicId}`).catch(() => null)) as any
        if (clinic && clinic.isActive !== false) {
          return { authorized: true, role: 'doctor', userId: clinicId }
        }
      }
    }
  }

  return {
    authorized: false,
    error: 'غير مصرح لك بتشغيل مزامنة دليل الأدوية. يرجى تسجيل الدخول كطبيب عيادة أو مالك المنصة.'
  }
}

/**
 * GET: Retrieve public, sanitized medicine sync status and recent activity.
 * Stack traces and internal server errors are strictly withheld.
 * Cron execution is NOT triggered via GET.
 */
export async function GET() {
  try {
    const currentCairoDate = getCairoDateString()

    // 1. Read metadata
    const metadata = (await readDocument('sync_metadata/market_prices').catch(() => null)) as any

    // 2. Read lock status
    const lock = (await readDocument('sync_locks/market_prices').catch(() => null)) as any
    const isCurrentlyRunning = Boolean(
      lock &&
      lock.lockedAt &&
      Date.now() - new Date(String(lock.lockedAt)).getTime() < 15 * 60 * 1000
    )

    // 3. Read recent logs (sanitized)
    const logs = (await queryDocuments('market_prices_sync_logs').catch(() => [])) as any[]
    const sortedLogs = logs
      .sort((a, b) => new Date(String(b.timestamp || 0)).getTime() - new Date(String(a.timestamp || 0)).getTime())
      .slice(0, 5)

    const sanitizedLogs = sortedLogs.map((l) => ({
      id: l.id || '',
      cairoDate: l.cairoDate || '',
      status: l.status || '',
      triggeredBy: l.triggeredBy || '',
      addedCount: Number(l.addedCount) || 0,
      updatedCount: Number(l.priceChangedCount || l.updatedCount) || 0,
      verifiedCount: Number(l.verifiedCount || l.unchangedCount) || 0,
      durationMs: Number(l.durationMs) || 0,
      timestamp: l.timestamp || ''
    }))

    // Determine high-level health state
    let status: 'RUNNING' | 'COMPLETED' | 'STALE' | 'FAILED' | 'IDLE' = 'IDLE'
    if (isCurrentlyRunning) {
      status = 'RUNNING'
    } else if (metadata?.lastAttemptStatus === 'FAILED' && metadata?.lastSuccessDate !== currentCairoDate) {
      status = 'FAILED'
    } else if (metadata?.lastSuccessDate) {
      status = metadata.lastSuccessDate === currentCairoDate ? 'COMPLETED' : 'STALE'
    }

    return NextResponse.json({
      success: true,
      currentCairoDate,
      isRunning: isCurrentlyRunning,
      status,
      lastSuccess: metadata?.lastSuccessDate
        ? {
            cairoDate: metadata.lastSuccessDate,
            timestamp: metadata.lastSuccessTimestamp || null,
            lastSourceUpdateDate: metadata.lastSourceUpdateDate || null,
            addedCount: Number(metadata.addedCount) || 0,
            priceChangedCount: Number(metadata.priceChangedCount) || 0,
            verifiedCount: Number(metadata.verifiedCount) || 0
          }
        : null,
      lastAttempt: metadata?.lastAttemptDate
        ? {
            cairoDate: metadata.lastAttemptDate,
            timestamp: metadata.lastAttemptTimestamp || null,
            status: metadata.lastAttemptStatus || 'UNKNOWN'
          }
        : null,
      recentLogs: sanitizedLogs
    })
  } catch (error: any) {
    console.error('Error fetching sanitized sync status:', error)
    return NextResponse.json(
      { error: 'تعذر استرجاع حالة مزامنة الأدوية حالياً.' },
      { status: 500 }
    )
  }
}

/**
 * POST: Trigger an on-demand sync of medicine prices from DawaaGate.
 * Strictly enforces CSRF verification, rate limiting, and authorized identity.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify CSRF
    assertSameOrigin(req)

    // 2. Authenticate & Authorize
    const auth = await authorizeSyncRequest(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'غير مصرح' }, { status: 401 })
    }

    // 3. Enforce Rate Limiting
    const rateLimitKey = `${auth.role}_${auth.userId || 'anon'}`
    const rateCheck = enforceManualSyncRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز حد تشغيل المزامنة اليدوية. يرجى الانتظار لمدة ${rateCheck.waitMinutes} دقيقة قبل المحاولة مجدداً.`
        },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === 'string' ? body.query.trim() : undefined
    const pages = Math.min(Math.max(Number(body.pages) || 3, 1), 10)

    const triggeredBy = auth.role === 'owner' ? 'manual_owner' : 'manual_doctor'

    const syncResult = await runMedicineSync({
      triggeredBy,
      query,
      pages
    })

    return NextResponse.json({
      success: syncResult.status !== 'FAILED',
      ...syncResult
    })
  } catch (error: any) {
    console.error('Error in sync-daily-prices POST:', error)
    return NextResponse.json(
      { error: 'فشل تنفيذ عملية المزامنة. يرجى مراجعة إعدادات الخادم.' },
      { status: 500 }
    )
  }
}
