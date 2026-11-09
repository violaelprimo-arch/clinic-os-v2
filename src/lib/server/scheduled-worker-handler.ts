if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: scheduled-worker-handler cannot be imported in client-side bundles')
}

import {
  runMedicineSync,
  getCairoHour,
  getCairoDateString
} from './medicine-sync-service'
import { readDocument } from './firebase-rest'

export interface ScheduledEventResult {
  success?: boolean
  skipped?: boolean
  reason?: string
  cairoHour?: number
  cairoDate?: string
  attempt?: number
  error?: string
  addedCount?: number
  priceChangedCount?: number
}

/**
 * Execute Scheduled Medicine Synchronization with:
 * 1. Africa/Cairo timezone & DST sensitivity (morning 05:00 - 07:00 window).
 * 2. Idempotency: skip if already successfully completed today.
 * 3. Permissive completion: allow execution if previous run today failed.
 * 4. Exponential backoff retry (up to 3 attempts).
 */
export async function handleScheduledEvent(
  event: any,
  env: any = {},
  ctx: any = null
): Promise<ScheduledEventResult> {
  const eventTime = new Date(event?.scheduledTime || Date.now())
  const cronExpr = event?.cron || 'manual'
  console.log(`[Worker Scheduled] Triggered at ${eventTime.toISOString()} for cron: "${cronExpr}"`)

  // Ensure Cloudflare Worker env bindings are accessible to process.env
  if (env && typeof env === 'object') {
    for (const [key, val] of Object.entries(env)) {
      if (typeof val === 'string' && !process.env[key]) {
        process.env[key] = val
      }
    }
  }

  const cairoHour = getCairoHour(eventTime)
  const cairoDate = getCairoDateString(eventTime)

  // Daily triggers fire at 03:00/04:00 UTC; exactly one maps to
  // 06:00 Africa/Cairo after applying daylight-saving time.
  // An independent 15-minute retry trigger heals transient source failures
  // and missed original schedules without needing a browser tab.
  const isRetryTrigger = cronExpr === '*/15 * * * *'
  if (!isRetryTrigger && cairoHour !== 6) {
    return { skipped: true, reason: 'NOT_0600_CAIRO', cairoHour, cairoDate }
  }
  if (isRetryTrigger && (cairoHour < 6 || cairoHour > 22)) {
    return { skipped: true, reason: 'RETRY_OUTSIDE_ALLOWED_WINDOW', cairoHour, cairoDate }
  }

  let metadata: any = null
  try {
    metadata = await readDocument('sync_metadata/market_prices')
  } catch (err) {
    // Fail closed instead of overwriting data on uncertain connectivity.
    console.error('[Worker Scheduled] Unable to read authoritative sync metadata', err)
    return { success: false, reason: 'SYNC_METADATA_UNAVAILABLE', cairoDate }
  }
  if (metadata?.lastSuccessDate === cairoDate) {
    return { skipped: true, reason: 'ALREADY_COMPLETED_TODAY', cairoDate }
  }
  if (isRetryTrigger && metadata?.lastAttemptTimestamp) {
    const elapsed = eventTime.getTime() - Date.parse(String(metadata.lastAttemptTimestamp))
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 12 * 60 * 1000) {
      return { skipped: true, reason: 'RECENT_ATTEMPT_IN_PROGRESS', cairoDate }
    }
  }

  // 3. Retry loop with Exponential Backoff
  const MAX_ATTEMPTS = 3
  let lastError: any = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[Worker Scheduled] Starting medicine sync attempt ${attempt}/${MAX_ATTEMPTS} for ${cairoDate}...`)
      const result = await runMedicineSync({
        triggeredBy: 'cron',
        pages: 3
      })

      if (result.status === 'COMPLETED') {
        console.log(`[Worker Scheduled] Medicine sync completed successfully on attempt ${attempt}: +${result.addedCount} new, ${result.priceChangedCount} updated.`)
        return { success: true, attempt, ...result }
      }

      if (result.status === 'ALREADY_RUNNING') {
        console.log(`[Worker Scheduled] Sync already in progress by another worker. Exiting cleanly.`)
        return { success: true, attempt, ...result }
      }

      // If FAILED, record and prepare retry
      lastError = new Error(result.message || 'Sync failed')
      console.warn(`[Worker Scheduled] Attempt ${attempt} failed: ${result.message}`)
    } catch (err) {
      lastError = err
      console.error(`[Worker Scheduled] Exception in attempt ${attempt}:`, err)
    }

    if (attempt < MAX_ATTEMPTS) {
      const backoffMs = attempt * 2000
      console.log(`[Worker Scheduled] Waiting ${backoffMs}ms before attempt ${attempt + 1}...`)
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }

  console.error(`[Worker Scheduled] All ${MAX_ATTEMPTS} attempts failed for ${cairoDate}. Last error:`, lastError)
  return {
    success: false,
    cairoDate,
    error: lastError ? String(lastError.message || lastError) : 'Unknown failure'
  }
}
