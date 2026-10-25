import rawDatabase from '@/data/egyptian-drugs-database.json'

export interface DrugItem {
  id: string
  name: string
  nameAr?: string
  commercial_name_en?: string
  commercial_name_ar?: string
  activeIngredient: string
  scientific_name?: string
  company: string
  manufacturer?: string
  form: string
  price: number
  oldPrice?: number
  isFavorite?: boolean
  isMarketUpdated?: boolean
  lastMarketUpdate?: string
  slug?: string
}

export const EGYPTIAN_DRUGS_CATALOG: DrugItem[] = (rawDatabase as any[]).map((d, index) => {
  const nameEn = (d.name || d.commercial_name_en || d.slug?.replace(/-/g, ' ') || '').trim()
  const nameAr = (d.nameAr || d.commercial_name_ar || '').trim()
  return {
    id: d.slug || `eg-drug-${index}`,
    slug: d.slug,
    name: nameEn,
    nameAr: nameAr,
    commercial_name_en: nameEn,
    commercial_name_ar: nameAr,
    activeIngredient: d.activeIngredient || 'معتمد مصرياً',
    scientific_name: d.activeIngredient || 'معتمد مصرياً',
    company: d.company || 'سوق الدواء المصري',
    manufacturer: d.company || 'سوق الدواء المصري',
    form: d.form || 'أقراص',
    price: Number(d.price) || 0,
    oldPrice: d.oldPrice ? Number(d.oldPrice) : undefined,
    isFavorite: false,
    isMarketUpdated: Boolean(d.isMarketUpdated ?? (Number(d.price) > 0)),
    lastMarketUpdate: d.lastMarketUpdate || ''
  }
})

// Keep backward-compatible list of drug names
export const EGYPTIAN_DRUGS: string[] = EGYPTIAN_DRUGS_CATALOG.map((d) => d.name)
