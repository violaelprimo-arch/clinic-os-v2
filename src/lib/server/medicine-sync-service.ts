if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: medicine-sync-service cannot be imported in client-side bundles')
}
import * as cheerio from 'cheerio'
import {
  readDocument,
  writeDocument,
  deleteDocument,
  queryDocuments,
  createDocument,
  acquireFirestoreLease,
  releaseFirestoreLease
} from './firebase-rest'
import {
  normalizeDrugKey,
  normalizeArabicDrugKey,
  canonicalDrugIdentifier
} from '@/lib/drugUtils'

export interface SyncOptions {
  triggeredBy?: 'cron' | 'manual_owner' | 'manual_doctor'
  query?: string
  pages?: number
  force?: boolean
}

export interface SyncResult {
  status: 'COMPLETED' | 'ALREADY_RUNNING' | 'FAILED'
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
  error?: string
}

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache'
}

export function getCairoDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function getCairoHour(date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour: 'numeric',
    hour12: false
  }).format(date)
  return parseInt(hourStr, 10)
}

interface ScrapedDrug {
  slug: string
  nameAr: string
  nameEn: string
  price: number
  oldPrice: number
  dateText?: string
  activeIngredient?: string
  company?: string
  dosageForm?: string
  category?: string
  barcode?: string
}

/**
 * Distributed Lock Acquisition with unique Run ID and Lease Expiration
 * Guarantees atomic ownership and prevents concurrent sync collisions.
 */
async function acquireDistributedLock(
  lockPath: string,
  runId: string,
  triggeredBy: string,
  ttlMs = 30 * 60 * 1000,
): Promise<{ acquired: boolean; currentRunId?: string }> {
  // Every contender reads and commits in a Firestore transaction.
  // Network errors must never be mistaken for an already-running task.
  return acquireFirestoreLease(lockPath, runId, triggeredBy, ttlMs)
}

/** Release only the active owner, with the same atomic transaction semantics. */
async function releaseDistributedLock(lockPath: string, runId: string) {
  return releaseFirestoreLease(lockPath, runId)
}

/**
 * Scrapes recently updated medicines from DawaaGate /price-updates
 * Handles pagination and avoids collapsing distinct package sizes.
 */
export async function scrapeDawaaPriceUpdates(pages = 2): Promise<ScrapedDrug[]> {
  const results: ScrapedDrug[] = []
  const seenSlugs = new Set<string>()

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `https://www.dawaagate.com/price-updates${page > 1 ? `?page=${page}` : ''}`
      const res = await fetch(url, { headers: HTTP_HEADERS, cache: 'no-store', signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`DAWAAGATE_PRICE_PAGE_HTTP_${res.status}`)

      const html = await res.text()
      const $ = cheerio.load(html)

      const beforePage = results.length
      $('table tr').each((_, el) => {
        const $row = $(el)
        const link = $row.find('td.name a')
        if (!link.length) return

        const href = link.attr('href') || ''
        const slugMatch = href.match(/\/medicine\/([^/?#]+)/)
        const slug = slugMatch ? slugMatch[1] : ''
        if (!slug || seenSlugs.has(slug)) return

        const nameAr = link.text().trim()
        const oldPriceText = $row.find('td.num.old').text().trim().replace(/[^0-9.]/g, '')
        const newPriceText = $row.find('td.num strong').text().trim().replace(/[^0-9.]/g, '')
        const dateText = $row.find('td.date').text().trim()

        const price = parseFloat(newPriceText) || 0
        const oldPrice = parseFloat(oldPriceText) || 0

        // Strict validation: Reject zero or negative price
        if (price > 0 && nameAr) {
          seenSlugs.add(slug)
          const nameEn = slug.replace(/-/g, ' ')
          results.push({
            slug,
            nameAr,
            nameEn,
            price,
            oldPrice,
            dateText
          })
        }
      })

      if (results.length === beforePage && page === 1) {
        throw new Error('DAWAAGATE_PRICE_TABLE_EMPTY_OR_CHANGED')
      }

      // Polite delay between pages
      if (page < pages) {
        await new Promise((r) => setTimeout(r, 400))
      }
    } catch (err) {
      console.error(`Error scraping DawaaGate updates page ${page}:`, err)
      // Never mark an incomplete set of price pages as a successful sync.
      throw err
    }
  }

  return results
}

/**
 * Scrapes drug detail page for rich metadata (dosage, active ingredient, manufacturer, barcode)
 */
export async function scrapeDrugDetail(slug: string): Promise<Partial<ScrapedDrug>> {
  try {
    const url = `https://www.dawaagate.com/medicine/${encodeURIComponent(slug)}`
    const res = await fetch(url, { headers: HTTP_HEADERS, next: { revalidate: 0 } })
    if (!res.ok) return {}

    const html = await res.text()
    const $ = cheerio.load(html)
    const detail: Partial<ScrapedDrug> = {}

    // 1. Try JSON-LD schema
    $('script[type="application/ld+json"]').each((_, s) => {
      try {
        const parsed = JSON.parse($(s).html() || '{}')
        if (parsed['@type'] === 'Drug') {
          if (parsed.name && !detail.nameAr) detail.nameAr = parsed.name
          if (parsed.alternateName && !detail.nameEn) detail.nameEn = parsed.alternateName
          if (parsed.activeIngredient) detail.activeIngredient = parsed.activeIngredient
          if (parsed.manufacturer?.name) detail.company = parsed.manufacturer.name
          if (parsed.dosageForm) detail.dosageForm = parsed.dosageForm
          if (parsed.category) detail.category = parsed.category
        }
      } catch {}
    })

    // 2. Parse text items
    $('.ddm-fact-item, .ddm-fact-row, .ddm-info-row, li, tr').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.includes('الاسم بالإنجليزي') && !detail.nameEn) {
        detail.nameEn = text.replace('الاسم بالإنجليزي', '').trim()
      } else if (text.includes('الشركة المنتجة') && !detail.company) {
        detail.company = text.replace('الشركة المنتجة', '').trim()
      } else if (text.includes('الشكل الدوائي') && !detail.dosageForm) {
        detail.dosageForm = text.replace('الشكل الدوائي', '').trim()
      } else if (text.includes('التصنيف الدوائي') && !detail.category) {
        detail.category = text.replace('التصنيف الدوائي', '').trim()
      } else if (text.includes('الباركود') && !detail.barcode) {
        const digits = text.replace(/[^0-9]/g, '')
        if (digits.length >= 8) detail.barcode = digits.slice(0, 13)
      }
    })

    return detail
  } catch (err) {
    console.error(`Error scraping detail for ${slug}:`, err)
    return {}
  }
}

/**
 * Searches DawaaGate for a specific keyword
 */
export async function searchDawaaDrugs(query: string): Promise<ScrapedDrug[]> {
  try {
    const url = `https://www.dawaagate.com/search?q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: HTTP_HEADERS, next: { revalidate: 0 } })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: ScrapedDrug[] = []

    $('a[href*="/medicine/"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const slugMatch = href.match(/\/medicine\/([^/?#]+)/)
      if (!slugMatch) return

      const slug = slugMatch[1]
      const card = $(el).closest('.ph-card, .search-item, div')
      const nameAr = $(el).text().trim() || card.find('h2, h3, .name').text().trim()
      const priceText = card.find('.price, .num, strong').text().trim().replace(/[^0-9.]/g, '')
      const price = parseFloat(priceText) || 0

      if (slug && price > 0) {
        results.push({
          slug,
          nameAr,
          nameEn: slug.replace(/-/g, ' '),
          price,
          oldPrice: 0
        })
      }
    })

    return results
  } catch (err) {
    console.error(`Error searching DawaaGate for ${query}:`, err)
    return []
  }
}

/**
 * Core Medicine Synchronization Engine
 * Safe upsert into market_prices with atomic distributed lock, validation,
 * clear distinction between price changes vs re-checks, and separate timestamps.
 */
export async function runMedicineSync(options: SyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now()
  const cairoDate = getCairoDateString()
  const runId = `run_${Date.now()}_${crypto.randomUUID()}`
  const { triggeredBy = 'cron', query: searchQuery, pages = 3 } = options
  const metadataPath = searchQuery?.trim()
    ? 'sync_metadata/market_prices_targeted'
    : 'sync_metadata/market_prices'
  const safePages = Math.max(1, Math.min(15, Math.floor(Number(pages) || 3)))

  // Attempt metadata is written ONLY after exclusive lock acquisition.
  const attemptTimestamp = new Date().toISOString()

  // 1. Acquire Atomic Distributed Lock
  const lockAcquired = await acquireDistributedLock(
    'sync_locks/market_prices',
    runId,
    triggeredBy
  )

  if (!lockAcquired.acquired) {
    return {
      status: 'ALREADY_RUNNING',
      message: 'مزامنة الأسعار جارية حاليًا بواسطة عملية أخرى',
      addedCount: 0,
      updatedCount: 0,
      priceChangedCount: 0,
      verifiedCount: 0,
      unchangedCount: 0,
      totalProcessed: 0,
      durationMs: Date.now() - startTime,
      cairoDate,
      timestamp: attemptTimestamp,
      runId: lockAcquired.currentRunId
    }
  }

  await writeDocument(metadataPath, {
    lastAttemptDate: cairoDate,
    lastAttemptTimestamp: attemptTimestamp,
    lastAttemptTriggeredBy: triggeredBy,
    lastAttemptStatus: 'IN_PROGRESS',
    lastRunId: runId
  }, true)

  let addedCount = 0
  let priceChangedCount = 0
  let verifiedCount = 0
  let totalProcessed = 0
  let latestSourceDateText = ''

  try {
    // 2. Collect drugs from DawaaGate
    let scrapedDrugs: ScrapedDrug[] = []

    if (searchQuery && searchQuery.trim()) {
      scrapedDrugs = await searchDawaaDrugs(searchQuery.trim())
    } else {
      scrapedDrugs = await scrapeDawaaPriceUpdates(safePages)
    }

    totalProcessed = scrapedDrugs.length

    // Audit Requirement: Empty source response MUST be treated as an error requiring verification, NOT success
    if (totalProcessed === 0) {
      const emptyErrorMsg = 'المصدر أعاد استجابة فارغة (0 أدوية). تعذر التحقق من الأسعار.'
      await writeDocument(metadataPath, {
        lastAttemptStatus: 'FAILED',
        lastAttemptError: 'EMPTY_SOURCE_RESPONSE',
        updatedAt: new Date().toISOString()
      }, true).catch(() => {})

      return {
        status: 'FAILED',
        message: emptyErrorMsg,
        addedCount: 0,
        updatedCount: 0,
        priceChangedCount: 0,
        verifiedCount: 0,
        unchangedCount: 0,
        totalProcessed: 0,
        durationMs: Date.now() - startTime,
        cairoDate,
        timestamp: new Date().toISOString(),
        runId,
        error: 'EMPTY_SOURCE_RESPONSE'
      }
    }

    // 3. Process each drug with packaging and dosage preservation
    for (const drug of scrapedDrugs) {
      if (!drug.price || drug.price <= 0 || isNaN(drug.price)) continue

      if (drug.dateText && !latestSourceDateText) {
        latestSourceDateText = drug.dateText
      }

      // Preserve distinct dosages and pack sizes: Document ID is keyed by normalized slug
      const docId = normalizeDrugKey(drug.slug) || normalizeDrugKey(drug.nameEn)
      if (!docId) continue

      const normKey = normalizeDrugKey(drug.nameEn) || normalizeDrugKey(drug.slug.replace(/-/g, ' '))
      const existingDoc = (await readDocument(`market_prices/${docId}`)) as any

      if (existingDoc) {
        // Differentiate actual price change from routine re-check
        const isPriceDifferent = Math.abs(Number(existingDoc.price || 0) - drug.price) >= 0.01

        if (isPriceDifferent) {
          // Price CHANGED
          priceChangedCount++
          const updatedRecord = {
            name: drug.nameEn || existingDoc.name,
            commercial_name_en: drug.nameEn || existingDoc.commercial_name_en,
            nameAr: drug.nameAr || existingDoc.nameAr || '',
            commercial_name_ar: drug.nameAr || existingDoc.commercial_name_ar || '',
            slug: drug.slug || existingDoc.slug || '',
            normalizedKey: normKey,
            normalizedAr: normalizeArabicDrugKey(drug.nameAr || existingDoc.nameAr || ''),
            canonicalKey: canonicalDrugIdentifier(drug.nameEn || existingDoc.name),
            price: drug.price,
            oldPrice: existingDoc.price || drug.oldPrice,
            lastPriceChangeDate: cairoDate,
            lastPriceChangeTimestamp: new Date().toISOString(),
            company: drug.company || existingDoc.company || '',
            activeIngredient: drug.activeIngredient || existingDoc.activeIngredient || '',
            dosageForm: drug.dosageForm || existingDoc.dosageForm || '',
            category: drug.category || existingDoc.category || '',
            barcode: drug.barcode || existingDoc.barcode || '',
            source: 'dawaagate.com',
            sourceDateText: drug.dateText || existingDoc.sourceDateText || '',
            last_updated: cairoDate,
            last_verified: cairoDate,
            updatedAt: new Date().toISOString()
          }
          await writeDocument(`market_prices/${docId}`, updatedRecord, true)
        } else {
          // Price VERIFIED unchanged
          verifiedCount++
          // Update verification timestamp and metadata if not refreshed today
          if (existingDoc.last_verified !== cairoDate) {
            await writeDocument(`market_prices/${docId}`, {
              last_verified: cairoDate,
              sourceDateText: drug.dateText || existingDoc.sourceDateText || '',
              updatedAt: new Date().toISOString()
            }, true)
          }
        }
      } else {
        // Newly added medication: Enrich metadata if missing
        let enrichedDetail: Partial<ScrapedDrug> = {}
        if (!drug.company || !drug.activeIngredient) {
          enrichedDetail = await scrapeDrugDetail(drug.slug).catch(() => ({}))
        }

        const newRecord = {
          name: enrichedDetail.nameEn || drug.nameEn,
          commercial_name_en: enrichedDetail.nameEn || drug.nameEn,
          nameAr: enrichedDetail.nameAr || drug.nameAr,
          commercial_name_ar: enrichedDetail.nameAr || drug.nameAr,
          slug: drug.slug,
          normalizedKey: normKey,
          normalizedAr: normalizeArabicDrugKey(enrichedDetail.nameAr || drug.nameAr),
          canonicalKey: canonicalDrugIdentifier(enrichedDetail.nameEn || drug.nameEn),
          price: drug.price,
          oldPrice: drug.oldPrice || null,
          lastPriceChangeDate: cairoDate,
          company: enrichedDetail.company || drug.company || '',
          activeIngredient: enrichedDetail.activeIngredient || drug.activeIngredient || '',
          dosageForm: enrichedDetail.dosageForm || drug.dosageForm || '',
          category: enrichedDetail.category || drug.category || '',
          barcode: enrichedDetail.barcode || drug.barcode || '',
          source: 'dawaagate.com',
          sourceDateText: drug.dateText || '',
          last_updated: cairoDate,
          last_verified: cairoDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        await writeDocument(`market_prices/${docId}`, newRecord, true)
        addedCount++
      }
    }

    const durationMs = Date.now() - startTime
    const successTimestamp = new Date().toISOString()

    // 4. Update sync metadata with separate timestamps for success, attempt, and source
    await writeDocument(metadataPath, {
      lastSuccessDate: cairoDate,
      lastSuccessTimestamp: successTimestamp,
      lastAttemptDate: cairoDate,
      lastAttemptTimestamp: successTimestamp,
      lastAttemptStatus: 'COMPLETED',
      lastSourceUpdateDate: latestSourceDateText || cairoDate,
      lastRunId: runId,
      addedCount,
      priceChangedCount,
      verifiedCount,
      totalProcessed,
      updatedAt: successTimestamp
    }, true)

    // 5. Record Audit Log in market_prices_sync_logs
    const logId = `sync_${Date.now()}`
    const logRecord = {
      id: logId,
      runId,
      status: 'completed',
      triggeredBy,
      cairoDate,
      addedCount,
      priceChangedCount,
      verifiedCount,
      updatedCount: priceChangedCount,
      unchangedCount: verifiedCount,
      totalProcessed,
      sourceDateText: latestSourceDateText,
      durationMs,
      timestamp: successTimestamp
    }

    await createDocument('market_prices_sync_logs', logRecord, logId).catch(() => {})

    return {
      status: 'COMPLETED',
      message: `تمت مزامنة الأسعار بنجاح (${addedCount} دواء جديد، ${priceChangedCount} سعر محدث، ${verifiedCount} مطابق)`,
      addedCount,
      updatedCount: priceChangedCount,
      priceChangedCount,
      verifiedCount,
      unchangedCount: verifiedCount,
      totalProcessed,
      durationMs,
      cairoDate,
      runId,
      lastSourceUpdateDate: latestSourceDateText,
      timestamp: successTimestamp
    }
  } catch (error: any) {
    console.error('Medicine sync failed:', error)
    const durationMs = Date.now() - startTime
    const failureTimestamp = new Date().toISOString()

    // Record failure in metadata and logs
    await writeDocument(metadataPath, {
      lastAttemptStatus: 'FAILED',
      lastAttemptError: error.message || 'Unknown error',
      updatedAt: failureTimestamp
    }, true).catch(() => {})

    const logId = `sync_err_${Date.now()}`
    await createDocument('market_prices_sync_logs', {
      id: logId,
      runId,
      status: 'failed',
      triggeredBy,
      cairoDate,
      error: error.message || 'Unknown error during medicine sync',
      durationMs,
      timestamp: failureTimestamp
    }, logId).catch(() => {})

    return {
      status: 'FAILED',
      message: 'فشلت عملية مزامنة الأسعار من بوابة الدواء',
      addedCount,
      updatedCount: priceChangedCount,
      priceChangedCount,
      verifiedCount,
      unchangedCount: verifiedCount,
      totalProcessed,
      durationMs,
      cairoDate,
      runId,
      timestamp: failureTimestamp,
      error: error.message
    }
  } finally {
    // Release distributed lock conditionally (only if runId matches)
    await releaseDistributedLock('sync_locks/market_prices', runId).catch(err => {
      console.error('[medicine-sync] Atomic lock release failed:', err)
    })
  }
}
