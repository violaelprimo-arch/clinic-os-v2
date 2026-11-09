import * as cheerio from 'cheerio'

export interface DawaaDrug {
  slug: string
  nameAr: string
  nameEn: string
  price: number
  oldPrice?: number
  dateText?: string
  sourceDate?: string
  sourceVerifiedDate?: string
  activeIngredient?: string
  company?: string
  dosageForm?: string
  category?: string
  barcode?: string
}

const digits = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
export function parseSourceDate(text: string): string | undefined {
  const normalized = digits(text).trim()
  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return iso[0]
  const parts = normalized.match(/(\d{1,2})\s+(\S+)\s+(20\d{2})/)
  if (!parts) return undefined
  const month = months.findIndex(m => m.replace(/[أإآ]/g, 'ا') === parts[2].replace(/[أإآ]/g, 'ا')) + 1
  if (!month || +parts[1] < 1 || +parts[1] > 31) return undefined
  return `${parts[3]}-${String(month).padStart(2, '0')}-${parts[1].padStart(2, '0')}`
}

export function parsePrice(text: string): number | undefined {
  const value = Number.parseFloat(digits(text).replace(/[,٬]/g, '').replace('٫', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(value) && value > 0 && value < 10000000 ? value : undefined
}

export function medicineSlug(value: string): string | undefined {
  try {
    const url = new URL(value, 'https://www.dawaagate.com')
    if (url.protocol !== 'https:' || !['www.dawaagate.com', 'dawaagate.com'].includes(url.hostname)) return undefined
    const match = url.pathname.match(/^\/medicine\/([a-z0-9][a-z0-9-]{0,200})\/?$/i)
    return match?.[1].toLowerCase()
  } catch { return undefined }
}

export function parsePriceUpdates(html: string, page: number) {
  const $ = cheerio.load(html)
  const drugs: DawaaDrug[] = []
  const seen = new Set<string>()
  $('table tr').each((_, row) => {
    const cells = $(row).children('td')
    const anchor = cells.first().find('a[href*="/medicine/"]').first()
    const slug = medicineSlug(anchor.attr('href') || '')
    if (!slug || seen.has(slug)) return
    const price = parsePrice(cells.eq(2).text())
    const nameAr = anchor.text().trim()
    const dateText = cells.eq(4).text().trim()
    const sourceDate = parseSourceDate(dateText)
    if (!nameAr || !price || !sourceDate) throw new Error('DAWAAGATE_PRICE_ROW_INVALID')
    drugs.push({ slug, nameAr, nameEn: slug.replace(/-/g, ' '), price,
      oldPrice: parsePrice(cells.eq(1).text()), dateText, sourceDate })
    seen.add(slug)
  })
  if (!drugs.length) throw new Error('DAWAAGATE_PRICE_TABLE_EMPTY_OR_CHANGED')
  const hasNext = $('a[href]').toArray().some(el => {
    try {
      const u = new URL($(el).attr('href') || '', 'https://www.dawaagate.com/price-updates')
      return u.pathname === '/price-updates' && Number(u.searchParams.get('page')) === page + 1
    } catch { return false }
  })
  return { drugs, hasNext }
}

export function parseDrugDetail(html: string, slug: string): DawaaDrug {
  const $ = cheerio.load(html)
  let structured: Record<string, any> = {}
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node['@type'] === 'Drug' || (Array.isArray(node['@type']) && node['@type'].includes('Drug'))) structured = node
    if (node['@graph']) visit(node['@graph'])
  }
  $('script[type="application/ld+json"]').each((_, node) => {
    try { visit(JSON.parse($(node).text())) } catch { /* unrelated structured block */ }
  })
  const price = parsePrice($('.ddm-price-num').first().text())
  const nameAr = String(structured.name || $('h1').first().text()).trim()
  if (!medicineSlug(`/medicine/${slug}`) || !nameAr || !price) throw new Error('DAWAAGATE_DETAIL_INVALID')
  return {
    slug, nameAr, nameEn: String(structured.alternateName || slug.replace(/-/g, ' ')), price,
    oldPrice: parsePrice($('.ddm-price-old').first().text()),
    activeIngredient: String(structured.activeIngredient || ''),
    company: String(structured.manufacturer?.name || ''),
    dosageForm: String(structured.dosageForm || ''), category: String(structured.category || ''),
    sourceDate: parseSourceDate($('.ddm-fresh-change time').attr('datetime') || ''),
    sourceVerifiedDate: parseSourceDate($('.ddm-fresh-verified time').attr('datetime') || ''),
  }
}

export function parseSearchSlugs(html: string): string[] {
  const $ = cheerio.load(html)
  return [...new Set($('main a[href*="/medicine/"]').toArray()
    .map(el => medicineSlug($(el).attr('href') || '')).filter((x): x is string => Boolean(x)))].slice(0, 3)
}
