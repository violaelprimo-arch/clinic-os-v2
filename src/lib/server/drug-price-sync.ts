import 'server-only'
import { load } from 'cheerio'
import { createDocument, readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { normalizeDrugKey, normalizeArabicDrugKey } from '@/lib/drugUtils'

export const DRUG_SYNC_STATUS_PATH = 'drug_sync_status/dawaagate'
const SOURCE = 'https://www.dawaagate.com'
const MAX_PAGES = 2
const MAX_RECORDS = 160
const STATUS_TIMEOUT_MS = 14000

type MedicinePrice = {
  slug: string
  name: string
  nameAr: string
  nameEn: string
  price: number
  oldPrice: number | null
  company?: string
  activeIngredient?: string
  sourceUrl: string
}

export function cairoClock(instant: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) }
}

function readableMoney(raw: string) {
  const normalized = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/,/g, '')
  const match = normalized.match(/(?:^|\s)(\d+(?:\.\d{1,2})?)(?![%\d])/)
  const amount = match ? Number(match[1]) : 0
  return Number.isFinite(amount) && amount > 0 && amount < 1_000_000 ? amount : 0
}

function safeMedicineUrl(link: string) {
  try {
    const url = new URL(link, SOURCE)
    if (url.origin !== SOURCE || !/^\/medicine\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return null
    return { url: url.origin + url.pathname, slug: url.pathname.split('/')[2] }
  } catch {
    return null
  }
}

export function parseDawaaPriceUpdates(html: string): MedicinePrice[] {
  const $ = load(html)
  const output = new Map<string, MedicinePrice>()
  $('tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return
    const anchor = cells.eq(0).find('a[href*="/medicine/"]').first()
    const link = safeMedicineUrl(anchor.attr('href') || '')
    const nameAr = anchor.text().trim().replace(/\s+/g, ' ')
    if (!link || !nameAr) return
    const oldPrice = readableMoney(cells.eq(1).text())
    const price = readableMoney(cells.eq(2).text())
    if (!price) return
    output.set(link.slug, {
      slug: link.slug, name: nameAr, nameAr,
      nameEn: link.slug.replace(/-/g, ' '), price,
      oldPrice: oldPrice || null,
      sourceUrl: link.url,
    })
  })
  return [...output.values()]
}

/** Only parses explicit medicine card attributes; never guesses arbitrary page prices. */
export function parseDawaaSearchCards(html: string): MedicinePrice[] {
  const $ = load(html)
  const output = new Map<string, MedicinePrice>()
  $('[data-slug][data-price]').each((_, el) => {
    const slug = $(el).attr('data-slug') || ''
    const safe = safeMedicineUrl(`/medicine/${slug}`)
    if (!safe) return
    const price = readableMoney($(el).attr('data-price') || '')
    const nameAr = ($(el).attr('data-ar') || '').trim()
    const nameEn = ($(el).attr('data-en') || '').trim() || slug.replace(/-/g, ' ')
    if (!price || (!nameAr && !nameEn)) return
    output.set(safe.slug, {
      slug: safe.slug, name: nameEn, nameAr, nameEn, price,
      oldPrice: null, sourceUrl: safe.url,
      company: ($(el).attr('data-company') || '').trim(),
      activeIngredient: ($(el).attr('data-ing') || '').trim(),
    })
  })
  return [...output.values()]
}

async function sourceHtml(path: string) {
  const response = await fetch(SOURCE + path, {
    cache: 'no-store',
    redirect: 'error',
    headers: {
      'User-Agent': 'YallaClinic-MedicineSync/1.0 (+https://yalla-clinic.com)',
      Accept: 'text/html',
      'Accept-Language': 'ar,en;q=0.8',
    },
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`DAWAAGATE_HTTP_${response.status}`)
  if (!(response.headers.get('content-type') || '').includes('text/html')) {
    throw new Error('DAWAAGATE_NOT_HTML')
  }
  const html = await response.text()
  if (html.length > 3_000_000) throw new Error('DAWAAGATE_PAGE_TOO_LARGE')
  return html
}

function idFor(item: MedicinePrice) {
  // Stable key by the English transliteration (same key as the catalog).
  return normalizeDrugKey(item.nameEn) || normalizeDrugKey(item.slug.replace(/-/g, ' '))
}

export async function getDrugSyncStatus() {
  const existing = await readDocument(DRUG_SYNC_STATUS_PATH)
  return existing || { state: 'never', source: SOURCE, lastSuccessAt: null, updated_count: 0 }
}

export async function runDrugPriceSync(options: {
  mode: 'scheduled' | 'manual'
  query?: string
}) {
  const query = (options.query || '').trim().slice(0, 80)
  const { date, hour } = cairoClock()
  const previous = await getDrugSyncStatus()
  if (options.mode === 'scheduled' && previous.lastFullSuccessDate === date) {
    return { success: true, skipped: true, message: 'تمت مزامنة أسعار اليوم مسبقًا', updated_count: 0, date }
  }

  // Distributed per-hour attempts, preventing simultaneous duplicate runs.
  // A failed scheduled attempt is retried at the next local hour.
  const group = options.mode === 'scheduled' ? `scheduled-${date}-${hour}` :
    `manual-${date}-${hour}-${Math.floor(new Date().getMinutes() / 10)}-${query ? normalizeDrugKey(query).slice(0, 24) : 'all'}`
  try {
    await createDocument('drug_sync_runs', {
      mode: options.mode, query, startedAt: new Date().toISOString(), state: 'running'
    }, group)
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return { success: false, skipped: true, error: 'المزامنة جارية بالفعل أو جرت محاولة مؤخرًا. أعد المحاولة بعد 10 دقائق.', updated_count: 0 }
    }
    throw error
  }

  await writeDocument(DRUG_SYNC_STATUS_PATH, {
    state: 'running', startedAt: new Date().toISOString(),
    source: SOURCE, mode: options.mode, lastQuery: query,
  }, true)
  let checked = 0
  try {
    const records = new Map<string, MedicinePrice>()
    if (query) {
      const found = parseDawaaSearchCards(await sourceHtml(`/search?q=${encodeURIComponent(query)}`))
      for (const item of found) records.set(item.slug, item)
    } else {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const path = `/price-updates${page === 1 ? '' : `?page=${page}`}`
        const found = parseDawaaPriceUpdates(await sourceHtml(path))
        checked += found.length
        for (const item of found) if (!records.has(item.slug)) records.set(item.slug, item)
        if (page === 1 && found.length === 0) break
      }
    }
    const valid = [...records.values()].filter((r) => r.price > 0 && idFor(r)).slice(0, MAX_RECORDS)
    if (!valid.length) throw new Error('DAWAAGATE_PARSER_RETURNED_ZERO_RECORDS')
    let saved = 0
    let failures = 0
    const updatedAt = new Date().toISOString()
    // Bounded concurrency to stay within Cloudflare request duration limits.
    // Retain existing records if a source page is blocked or parsing fails.
    const batchSize = 8
    for (let start = 0; start < valid.length; start += batchSize) {
      const chunk = valid.slice(start, start + batchSize)
      const writes = await Promise.allSettled(chunk.map(async (item) => {
        await writeDocument(`market_prices/${idFor(item)}`, {
          name: item.nameEn,
          commercial_name_en: item.nameEn,
          nameAr: item.nameAr,
          commercial_name_ar: item.nameAr,
          slug: item.slug,
          normalizedKey: idFor(item),
          normalizedAr: normalizeArabicDrugKey(item.nameAr),
          price: item.price, oldPrice: item.oldPrice,
          ...(item.company ? { company: item.company } : {}),
          ...(item.activeIngredient ? { activeIngredient: item.activeIngredient } : {}),
          source: 'dawaagate.com', sourceUrl: item.sourceUrl,
          last_updated: date, updatedAt,
        }, true)
      }))
      writes.forEach((result, i) => {
        if (result.status === 'fulfilled') saved++
        else {
          failures++
          console.error('[drug-sync] Firestore write failure', chunk[i].slug, result.reason)
        }
      })
    }
    if (failures > 0 || saved === 0) throw new Error(`PARTIAL_SYNC_${saved}_SAVED_${failures}_FAILED`)

    await writeDocument(DRUG_SYNC_STATUS_PATH, {
      state: 'success', source: SOURCE,
      lastSuccessAt: updatedAt, lastSuccessDate: date,
      ...(query ? {} : { lastFullSuccessDate: date }),
      lastCheckedCount: checked || valid.length,
      updated_count: saved, lastError: '',
      finishedAt: updatedAt, mode: options.mode,
    }, true)
    await writeDocument(`drug_sync_runs/${group}`, { state: 'success', updated_count: saved, finishedAt: updatedAt }, true)
    return { success: true, updated_count: saved, checked_count: checked || valid.length, date, message: `تم تحديث ${saved} سعر دواء بنجاح` }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'DRUG_SYNC_FAILED'
    console.error('[drug-sync] failed:', reason)
    const finishedAt = new Date().toISOString()
    await Promise.allSettled([
      writeDocument(DRUG_SYNC_STATUS_PATH, { state: 'failed', lastError: reason, lastAttemptAt: finishedAt, finishedAt }, true),
      writeDocument(`drug_sync_runs/${group}`, { state: 'failed', error: reason, finishedAt }, true),
    ])
    throw new Error(reason)
  }
}
