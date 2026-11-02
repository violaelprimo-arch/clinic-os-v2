import fs from 'fs'

const curated = JSON.parse(fs.readFileSync('scripts/curated-drugs.json', 'utf8'))

const code = `// Curated baseline of top Egyptian medications for instant SSR and zero-latency startup.
// Full 27,000+ catalog is loaded asynchronously by useEgyptianDrugs via /data/egyptian-drugs-compact.json.

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

export const EGYPTIAN_DRUGS_CATALOG: DrugItem[] = ${JSON.stringify(curated, null, 2)}

// Keep backward-compatible list of drug names
export const EGYPTIAN_DRUGS: string[] = EGYPTIAN_DRUGS_CATALOG.map((d) => d.name)
`

fs.writeFileSync('src/lib/egyptian-drugs.ts', code, 'utf8')
console.log('Successfully wrote src/lib/egyptian-drugs.ts without 13MB JSON!')
