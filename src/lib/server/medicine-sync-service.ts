if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: medicine-sync-service cannot be imported in client-side bundles')
}
import * as cheerio from 'cheerio'
import {
  readDocument,
  writeDocument,
  deleteDocument,
  queryDocuments,
  createDocument
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
  unchangedCount: number
  totalProcessed: number
  durationMs: number
  cairoDate: string
  timestamp: string
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
 * Scrapes recently updated medicines from DawaaGate /price-updates
 */
export async function scrapeDawaaPriceUpdates(pages = 2): Promise<ScrapedDrug[]> {
  const results: ScrapedDrug[] = []
  const seenSlugs = new Set<string>()

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `https://www.dawaagate.com/price-updates${page > 1 ? `?page=${page}` : ''}`
      const res = await fetch(url, { headers: HTTP_HEADERS, next: { revalidate: 0 } })
      if (!res.ok) continue

      const html = await res.text()
      const $ = cheerio.load(html)

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
    } catch (err) {
      console.error(`Error scraping DawaaGate updates page ${page}:`, err)
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

    // 2. Parse text items (ddm-fact-item, li, etc.)
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
 * Safe upsert into market_prices with distributed lock, validation, and audit logging.
 */
export async function runMedicineSync(options: SyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now()
  const cairoDate = getCairoDateString()
  const { triggeredBy = 'cron', query: searchQuery, pages = 2, force = false } = options

  // 1. Distributed Lock Check (15 min expiration window)
  const lock = (await readDocument('sync_locks/market_prices').catch(() => null)) as any
  if (lock && lock.lockedAt) {
    const elapsed = Date.now() - new Date(String(lock.lockedAt)).getTime()
    if (elapsed < 15 * 60 * 1000 && !force) {
      return {
        status: 'ALREADY_RUNNING',
        message: 'مزامنة الأسعار جارية حاليًا بواسطة عملية أخرى',
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        totalProcessed: 0,
        durationMs: Date.now() - startTime,
        cairoDate,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Acquire Lock
  await writeDocument(
    'sync_locks/market_prices',
    {
      lockedAt: new Date().toISOString(),
      lockedBy: triggeredBy
    },
    false
  ).catch(() => {})

  let addedCount = 0
  let updatedCount = 0
  let unchangedCount = 0
  let totalProcessed = 0

  try {
    // 2. Collect drugs from DawaaGate
    let scrapedDrugs: ScrapedDrug[] = []

    if (searchQuery && searchQuery.trim()) {
      scrapedDrugs = await searchDawaaDrugs(searchQuery.trim())
    } else {
      scrapedDrugs = await scrapeDawaaPriceUpdates(pages)
    }

    totalProcessed = scrapedDrugs.length

    // 3. Process each drug with safe upsert
    for (const drug of scrapedDrugs) {
      // Strict validation: Skip invalid prices
      if (!drug.price || drug.price <= 0 || isNaN(drug.price)) continue

      const normKey =
        normalizeDrugKey(drug.nameEn) ||
        normalizeDrugKey(drug.slug.replace(/-/g, ' '))
      if (!normKey) continue

      const docId = normKey
      const existingDoc = (await readDocument(`market_prices/${docId}`).catch(() => null)) as any

      if (existingDoc) {
        // Check if price or metadata changed
        const isPriceSame = Math.abs(Number(existingDoc.price) - drug.price) < 0.01
        const hasArName = Boolean(existingDoc.nameAr || existingDoc.commercial_name_ar)

        if (isPriceSame && hasArName && existingDoc.last_updated === cairoDate) {
          unchangedCount++
          continue
        }

        // Updated price or refreshed date
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
          oldPrice: drug.oldPrice > 0 ? drug.oldPrice : (isPriceSame ? existingDoc.oldPrice : existingDoc.price),
          company: drug.company || existingDoc.company || '',
          activeIngredient: drug.activeIngredient || existingDoc.activeIngredient || '',
          dosageForm: drug.dosageForm || existingDoc.dosageForm || '',
          category: drug.category || existingDoc.category || '',
          barcode: drug.barcode || existingDoc.barcode || '',
          source: 'dawaagate.com',
          last_updated: cairoDate,
          updatedAt: new Date().toISOString()
        }

        await writeDocument(`market_prices/${docId}`, updatedRecord, true)
        updatedCount++
      } else {
        // New drug addition: Fetch detail metadata if missing
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
          company: enrichedDetail.company || drug.company || '',
          activeIngredient: enrichedDetail.activeIngredient || drug.activeIngredient || '',
          dosageForm: enrichedDetail.dosageForm || drug.dosageForm || '',
          category: enrichedDetail.category || drug.category || '',
          barcode: enrichedDetail.barcode || drug.barcode || '',
          source: 'dawaagate.com',
          last_updated: cairoDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        await writeDocument(`market_prices/${docId}`, newRecord, true)
        addedCount++
      }
    }

    const durationMs = Date.now() - startTime

    // 4. Record Audit Log in market_prices_sync_logs
    const logId = `sync_${Date.now()}`
    const logRecord = {
      id: logId,
      status: 'completed',
      triggeredBy,
      cairoDate,
      addedCount,
      updatedCount,
      unchangedCount,
      totalProcessed,
      durationMs,
      timestamp: new Date().toISOString()
    }

    await createDocument('market_prices_sync_logs', logRecord, logId).catch(() => {})

    return {
      status: 'COMPLETED',
      message: `تمت مزامنة دليل الأدوية بنجاح (${addedCount} دواء جديد، ${updatedCount} سعر محدث، ${unchangedCount} بدون تغيير)`,
      addedCount,
      updatedCount,
      unchangedCount,
      totalProcessed,
      durationMs,
      cairoDate,
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('Medicine sync failed:', error)
    const durationMs = Date.now() - startTime

    // Log failure
    const logId = `sync_err_${Date.now()}`
    await createDocument('market_prices_sync_logs', {
      id: logId,
      status: 'failed',
      triggeredBy,
      cairoDate,
      error: error.message || 'Unknown error during medicine sync',
      durationMs,
      timestamp: new Date().toISOString()
    }, logId).catch(() => {})

    return {
      status: 'FAILED',
      message: 'فشلت عملية مزامنة الأسعار من بوابة الدواء',
      addedCount,
      updatedCount,
      unchangedCount,
      totalProcessed,
      durationMs,
      cairoDate,
      timestamp: new Date().toISOString(),
      error: error.message
    }
  } finally {
    // Release distributed lock
    await deleteDocument('sync_locks/market_prices').catch(() => {})
  }
}
