import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { normalizeDrugKey, normalizeArabicDrugKey } from '@/lib/drugUtils'

export const dynamic = 'force-dynamic'

// Extract drug cards from DawaaGate search page HTML (e.g. /search?q=flumox)
function parseDawaaSearchCards(html: string) {
  const cards: any[] = []
  const cardBlockRegex = /<[^>]*\bdata-slug=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = cardBlockRegex.exec(html)) !== null) {
    const fullTag = match[0]
    const getAttr = (attrName: string) => {
      const m = fullTag.match(new RegExp(`\\b${attrName}=["']([^"']*)["']`, 'i'))
      return m ? m[1] : ''
    }
    const slug = match[1]
    const nameAr = getAttr('data-ar')
    const nameEn = getAttr('data-en') || slug.replace(/-/g, ' ')
    const activeIngredient = getAttr('data-ing')
    const company = getAttr('data-company')
    const priceStr = getAttr('data-price')
    const price = parseFloat(priceStr) || 0

    // Extract old price from card if available
    let oldPrice = 0
    const cardEndIdx = html.indexOf('</div>', match.index + fullTag.length)
    if (cardEndIdx !== -1) {
      const cardSub = html.slice(match.index, Math.min(html.length, cardEndIdx + 300))
      const oldPriceMatch = cardSub.match(/class=["'][^"']*ph-price-old[^"']*["']>([^<]+)<\/span>/i)
      if (oldPriceMatch) {
        oldPrice = parseFloat(oldPriceMatch[1].replace(/[^0-9.]/g, '')) || 0
      }
    }

    if (price > 0 && (nameEn || nameAr)) {
      cards.push({
        slug,
        nameAr,
        nameEn,
        activeIngredient,
        company,
        price,
        oldPrice: oldPrice || null,
        source: 'dawaagate_search'
      })
    }
  }
  return cards
}

// Extract updated drugs from DawaaGate /price-updates table
function parseDawaaPriceUpdates(html: string) {
  const items: any[] = []
  const rowRegex = /<tr[\s\S]*?<td class=["']name["']><a\s+[^>]*href=["'](?:https:\/\/www\.dawaagate\.com)?\/medicine\/([^"']+)["'][^>]*>([\s\S]*?)<\/a><\/td>[\s\S]*?<td class=["']num old["']>([\s\S]*?)<\/td>[\s\S]*?<td class=["']num["']><strong>([\s\S]*?)<\/strong>/gi
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const slug = m[1]
    const nameAr = m[2].replace(/<[^>]+>/g, '').trim()
    const oldPriceStr = m[3].replace(/[^0-9.]/g, '')
    const newPriceStr = m[4].replace(/[^0-9.]/g, '')
    const nameEn = slug.replace(/-/g, ' ')
    const price = parseFloat(newPriceStr) || 0
    if (price > 0) {
      items.push({
        slug,
        nameAr,
        nameEn,
        oldPrice: parseFloat(oldPriceStr) || 0,
        price,
        source: 'dawaagate_updates'
      })
    }
  }
  return items
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
    }

    const collectedDrugs: any[] = []

    // 1. If a specific search query is given (e.g. "flumox", "panadol", "augmentin"), query DawaaGate search
    if (q) {
      try {
        const searchUrl = `https://www.dawaagate.com/search?q=${encodeURIComponent(q)}`
        const res = await fetch(searchUrl, { headers, next: { revalidate: 0 } })
        if (res.ok) {
          const html = await res.text()
          const searchCards = parseDawaaSearchCards(html)
          collectedDrugs.push(...searchCards)
        }
      } catch (err) {
        console.error(`Error querying DawaaGate search for "${q}":`, err)
      }
    }

    // 2. Also scrape the recent price-updates from DawaaGate
    for (let page = 1; page <= 2; page++) {
      try {
        const updateUrl = `https://www.dawaagate.com/price-updates${page > 1 ? '?page=' + page : ''}`
        const res = await fetch(updateUrl, { headers, next: { revalidate: 0 } })
        if (res.ok) {
          const html = await res.text()
          const updateItems = parseDawaaPriceUpdates(html)
          collectedDrugs.push(...updateItems)
        }
      } catch (err) {
        console.error(`Error scraping price-updates page ${page}:`, err)
      }
    }

    // Deduplicate by normalized key
    const uniqueMap = new Map<string, any>()
    for (const item of collectedDrugs) {
      const normKey = normalizeDrugKey(item.nameEn) || normalizeDrugKey(item.slug?.replace(/-/g, ' '))
      if (normKey && !uniqueMap.has(normKey)) {
        uniqueMap.set(normKey, { ...item, normalizedKey: normKey })
      }
    }

    const uniqueDrugs = Array.from(uniqueMap.values())
    const savedRecords: any[] = []

    // Save to Firestore market_prices collection
    for (const drug of uniqueDrugs) {
      try {
        const docId = drug.normalizedKey
        const record = {
          name: drug.nameEn,
          commercial_name_en: drug.nameEn,
          nameAr: drug.nameAr || '',
          commercial_name_ar: drug.nameAr || '',
          slug: drug.slug || '',
          normalizedKey: drug.normalizedKey,
          normalizedAr: normalizeArabicDrugKey(drug.nameAr || ''),
          price: drug.price,
          oldPrice: drug.oldPrice || null,
          company: drug.company || '',
          activeIngredient: drug.activeIngredient || '',
          source: 'dawaagate.com',
          last_updated: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date()),
          updatedAt: new Date().toISOString()
        }

        await setDoc(doc(db, 'market_prices', docId), record, { merge: true })
        savedRecords.push(record)
      } catch (err) {
        console.error(`Failed to save drug to market_prices: ${drug.nameEn}`, err)
      }
    }

    return NextResponse.json({
      success: true,
      query: q || null,
      message: `تم تحديث أسعار ${savedRecords.length} دواء بنجاح بتاريخ ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}`,
      updated_count: savedRecords.length,
      records: savedRecords
    })
  } catch (error: any) {
    console.error('Error in sync-daily-prices:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
