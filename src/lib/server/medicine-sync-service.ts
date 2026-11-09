import 'server-only'
import { readDocument, writeDocument, createDocument, acquireFirestoreLease,
  releaseFirestoreLease, readDocumentBatch, upsertDocumentBatch } from './firebase-rest'
import { normalizeDrugKey, normalizeArabicDrugKey, canonicalDrugIdentifier } from '@/lib/drugUtils'
import { parsePriceUpdates, parseDrugDetail, parseSearchSlugs, medicineSlug, type DawaaDrug } from './dawaagate-parser'

export interface SyncOptions {
  triggeredBy?: 'cron' | 'manual_owner' | 'manual_doctor'
  query?: string
  pages?: number
  force?: boolean
}
export interface SyncResult {
  status: 'COMPLETED' | 'PARTIAL' | 'ALREADY_RUNNING' | 'FAILED'
  message: string
  addedCount: number
  updatedCount: number
  priceChangedCount: number
  verifiedCount: number
  unchangedCount: number
  totalProcessed: number
  durationMs: number
  cairoDate: string
  timestamp: string
  runId?: string
  lastSourceUpdateDate?: string
  nextPage?: number
  error?: string
}
export function getCairoDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function getCairoHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' }).format(date))
}
function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const HEADERS = { 'User-Agent': 'YallaClinic-MedicineSync/1.0 (+https://yalla-clinic.com)', Accept: 'text/html', 'Accept-Language': 'ar,en;q=0.8' }
async function sourceHtml(path: string) {
  const url = new URL(path, 'https://www.dawaagate.com')
  if (url.hostname !== 'www.dawaagate.com' || url.protocol !== 'https:') throw new Error('INVALID_MEDICINE_SOURCE')
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(18000) })
  if (!res.ok) throw new Error(`DAWAAGATE_HTTP_${res.status}`)
  const html = await res.text()
  if (html.length > 2000000) throw new Error('DAWAAGATE_RESPONSE_TOO_LARGE')
  return html
}
export async function scrapeDawaaPriceUpdates(pages = 1): Promise<DawaaDrug[]> {
  const records = new Map<string, DawaaDrug>()
  for (let page = 1; page <= Math.min(4, Math.max(1, pages)); page++) {
    const result = parsePriceUpdates(await sourceHtml(`/price-updates?page=${page}`), page)
    for (const d of result.drugs) if (!records.has(d.slug)) records.set(d.slug, d)
    if (!result.hasNext) break
    if (page < pages) await new Promise(r => setTimeout(r, 500))
  }
  return [...records.values()]
}
export async function scrapeDrugDetail(slug: string) {
  if (!medicineSlug(`/medicine/${slug}`)) throw new Error('INVALID_MEDICINE_SLUG')
  return parseDrugDetail(await sourceHtml(`/medicine/${slug}`), slug)
}
export async function searchDawaaDrugs(query: string): Promise<DawaaDrug[]> {
  const direct = medicineSlug(query) || (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(query) ? medicineSlug(`/medicine/${query}`) : undefined)
  const slugs = direct ? [direct] : parseSearchSlugs(await sourceHtml(`/search?q=${encodeURIComponent(query)}`))
  const records: DawaaDrug[] = []
  for (const slug of slugs) records.push(await scrapeDrugDetail(slug))
  return records
}
const PIPELINE_VERSION = 2
const LEASE_MS = 5 * 60 * 1000
export async function runMedicineSync(options: SyncOptions = {}): Promise<SyncResult> {
  const start = Date.now(), date = getCairoDateString(), runId = crypto.randomUUID()
  const target = options.query?.trim()
  if (target && target.length > 254) throw new Error('INVALID_DRUG_QUERY')
  const metadataPath = target ? 'sync_metadata/market_prices_targeted' : 'sync_metadata/market_prices'
  const triggeredBy = options.triggeredBy || 'cron'
  const base: SyncResult = { status: 'FAILED', message: '', addedCount: 0, updatedCount: 0,
    priceChangedCount: 0, verifiedCount: 0, unchangedCount: 0, totalProcessed: 0,
    durationMs: 0, cairoDate: date, timestamp: new Date().toISOString(), runId }
  const lease = await acquireFirestoreLease('sync_locks/market_prices', runId, triggeredBy, LEASE_MS)
  if (!lease.acquired) return { ...base, status: 'ALREADY_RUNNING', message: 'تحديث الأسعار قيد التشغيل بالفعل. تابع حالة المزامنة.' }
  let metadata: Record<string, any> = {}
  try {
    metadata = await readDocument(metadataPath) || {}
    await writeDocument(metadataPath, { lastAttemptDate: date, lastAttemptTimestamp: base.timestamp,
      lastAttemptStatus: 'IN_PROGRESS', lastAttemptTriggeredBy: triggeredBy, lastRunId: runId }, true)
    const candidate = metadata.checkpoint
    const priorCheckpoint = metadata.pipelineVersion === PIPELINE_VERSION && candidate &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(candidate.cycleDate)) && candidate.cycleDate <= date &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(candidate.sinceDate)) &&
      Number.isInteger(candidate.nextPage) && candidate.nextPage > 0 && candidate.nextPage <= 10000
      ? candidate : null
    const cycleDate = priorCheckpoint?.cycleDate || date
    // The bundled directory is retained. On the first v2 delta run, backfill a
    // seven-day overlap; subsequent days resume from the last verified day.
    const cutoff = priorCheckpoint?.sinceDate || shiftDate(
      metadata.pipelineVersion === PIPELINE_VERSION ? (metadata.lastSuccessDate || date) : date,
      metadata.pipelineVersion === PIPELINE_VERSION ? -1 : -7)
    let page = Number(priorCheckpoint?.nextPage || 1)
    let complete = Boolean(target)
    let latestSource = String(priorCheckpoint?.newestSourceDate || '')
    const pageBudget = Math.min(4, Math.max(1, Number(options.pages) || 3))
    for (let batch = 0; batch < (target ? 1 : pageBudget); batch++) {
      let records: DawaaDrug[]
      if (target) {
        records = await searchDawaaDrugs(target)
      } else {
        const source = parsePriceUpdates(await sourceHtml(`/price-updates?page=${page}`), page)
        for (const record of source.drugs) if (record.sourceDate! > latestSource) latestSource = record.sourceDate!
        complete = !source.hasNext || source.drugs.some(d => d.sourceDate! < cutoff)
        records = source.drugs.filter(d => d.sourceDate! >= cutoff)
        page++
      }
      if (!records.length && (target || batch === 0 && !complete)) throw new Error('EMPTY_SOURCE_RESPONSE')
      // One read and one commit per page, instead of 50+ individual subrequests.
      const ids = records.map(d => normalizeDrugKey(d.slug))
      const existing = await readDocumentBatch(ids.map(id => `market_prices/${id}`))
      const writes: Array<{ path: string; data: Record<string, unknown> }> = []
      const checkedAt = new Date().toISOString()
      records.forEach((drug, i) => {
        const old = existing.get(ids[i]) as Record<string, any> | undefined
        if (drug.sourceDate && drug.sourceDate > latestSource) latestSource = drug.sourceDate
        if (old?.sourceChangeDate && drug.sourceDate && old.sourceChangeDate > drug.sourceDate) return
        const changed = Boolean(old && Math.abs(Number(old.price) - drug.price) >= 0.01)
        if (!old) base.addedCount++
        else if (changed) base.priceChangedCount++
        else base.verifiedCount++
        base.totalProcessed++
        const data: Record<string, unknown> = {
          slug: drug.slug, sourceId: drug.slug, source: 'dawaagate.com',
          sourceUrl: `https://www.dawaagate.com/medicine/${drug.slug}`,
          name: drug.nameEn, commercial_name_en: drug.nameEn,
          nameAr: drug.nameAr, commercial_name_ar: drug.nameAr,
          normalizedKey: normalizeDrugKey(drug.nameEn), normalizedAr: normalizeArabicDrugKey(drug.nameAr),
          canonicalKey: canonicalDrugIdentifier(drug.nameEn), price: drug.price,
          sourceDateText: drug.dateText || drug.sourceDate || '',
          last_verified: date, lastCheckedAt: checkedAt, updatedAt: checkedAt,
        }
        if (drug.sourceDate) data.sourceChangeDate = drug.sourceDate
        if (drug.sourceVerifiedDate) data.sourceVerifiedDate = drug.sourceVerifiedDate
        if (changed || !old) {
          data.oldPrice = old?.price || drug.oldPrice || null
          data.last_updated = drug.sourceDate || date
          data.lastPriceChangeDate = drug.sourceDate || date
        }
        for (const key of ['company', 'activeIngredient', 'dosageForm', 'category', 'barcode'] as const) {
          if (drug[key]) data[key] = drug[key]
        }
        writes.push({ path: `market_prices/${ids[i]}`, data })
        if (changed) writes.push({ path: `market_price_history/${ids[i]}_${runId}`, data: {
          drugId: ids[i], sourceId: drug.slug, previousPrice: old!.price, price: drug.price,
          sourceDate: drug.sourceDate || null, checkedAt, runId,
        } })
      })
      await upsertDocumentBatch(writes)
      // Keep unfinished history across midnight. Once the older cycle ends,
      // revisit the newest pages before claiming today's update is complete.
      const handoffToToday = complete && !target && cycleDate !== date
      if (handoffToToday) { complete = false; page = 1 }
      // Persist the cursor after a fully committed page. A crash safely repeats
      // at most one idempotent page and never marks a partial cycle complete.
      if (!target) await writeDocument(metadataPath, {
        pipelineVersion: PIPELINE_VERSION,
        checkpoint: complete ? null : { cycleDate: handoffToToday ? date : cycleDate,
          sinceDate: handoffToToday ? shiftDate(cycleDate, -1) : cutoff,
          nextPage: page, newestSourceDate: latestSource },
        lastAttemptStatus: complete ? 'COMPLETED' : 'PARTIAL', dataVersion: checkedAt,
      }, true)
      if (complete || handoffToToday || Date.now() - start > 20000) break
      await new Promise(r => setTimeout(r, 500))
    }
    base.status = complete ? 'COMPLETED' : 'PARTIAL'
    base.updatedCount = base.priceChangedCount; base.unchangedCount = base.verifiedCount
    base.durationMs = Date.now() - start; base.timestamp = new Date().toISOString()
    base.lastSourceUpdateDate = latestSource
    if (!complete) base.nextPage = page
    base.message = complete
      ? `تم فحص ${base.totalProcessed} دواء من DawaaGate: ${base.priceChangedCount} سعر متغير و${base.addedCount} دواء جديد.`
      : `تم حفظ ${base.totalProcessed} دواء، ويُستكمل باقي التحديث تلقائيًا من الصفحة ${page}.`
    await writeDocument(metadataPath, {
      lastAttemptStatus: base.status, lastAttemptTimestamp: base.timestamp,
      lastAttemptError: null, dataVersion: base.timestamp,
      ...(complete ? { lastSuccessDate: date, lastSuccessTimestamp: base.timestamp,
        lastSourceUpdateDate: latestSource, coverageSinceDate: cutoff, checkpoint: null } : {}),
      addedCount: base.addedCount, priceChangedCount: base.priceChangedCount,
      verifiedCount: base.verifiedCount, totalProcessed: base.totalProcessed,
      pipelineVersion: PIPELINE_VERSION,
    }, true)
    await createDocument('market_prices_sync_logs', { ...base, triggeredBy }, runId).catch(() => {})
    return base
  } catch (err) {
    const code = err instanceof Error ? err.message : 'MEDICINE_SYNC_FAILED'
    await writeDocument(metadataPath, { lastAttemptStatus: 'FAILED', lastAttemptError: code,
      lastAttemptTimestamp: new Date().toISOString() }, true).catch(() => {})
    return { ...base, error: code, durationMs: Date.now() - start,
      message: 'تعذر إكمال تحديث المصدر. تم الاحتفاظ بالأسعار الحالية وستتم إعادة المحاولة تلقائيًا.' }
  } finally {
    await releaseFirestoreLease('sync_locks/market_prices', runId).catch(() => {})
  }
}
