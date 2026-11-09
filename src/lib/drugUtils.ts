export function normalizeDrugKey(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/(\d+)\s*(mg|gm|g|ml|mcg|iu|iu\/ml|%)/gi, '$1$2')
    .replace(/[^a-z0-9]/gi, '')
    .trim()
}

export function normalizeArabicDrugKey(name: string): string {
  if (!name) return ''
  return name
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/(\d+)\s*(مجم|جم|مل|قرص|كبسولة)/gi, '$1$2')
    .replace(/[^\u0621-\u064A0-9]/g, '')
    .trim()
}

/**
 * Returns a canonical SKU key that preserves pharmaceutical forms and packaging counts
 * to reliably match and deduplicate identical drug products across sources.
 */
export function canonicalDrugIdentifier(name: string): string {
  if (!name) return ''
  // Package count, concentration and dosage form all define the priced SKU.
  // Never merge a 7-tablet box into a 14-tablet box or a syrup into tablets.
  return name.toLowerCase()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\b(tablets?|tabs?)\b/g, 'tablet')
    .replace(/\b(capsules?|caps?)\b/g, 'capsule')
    .replace(/[^a-z0-9\u0621-\u064A]/gi, '')
    .trim()
}

/**
 * Clean and normalize text for bilingual search:
 * - strips diacritics / tashkeel
 * - normalizes Arabic letters (أ/إ/آ -> ا, ة -> ه, ى -> ي, ؤ/ئ -> ء)
 * - lowercases English
 * - normalizes punctuation
 */
export function normalizeSearchQuery(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\s\-_,.:;()\/]+/g, ' ')
    .trim()
}

function stripArabicVowels(str: string): string {
  return str.replace(/[\u0627\u0648\u064A\u0649\u0622\u0623\u0625]/g, '')
}

/**
 * Checks if a drug matches a search query in Arabic OR English:
 */
export function matchesDrugSearch(
  drug: {
    name?: string
    nameAr?: string
    commercial_name_en?: string
    commercial_name_ar?: string
    activeIngredient?: string
    scientific_name?: string
    company?: string
    manufacturer?: string
  },
  rawQuery: string
): boolean {
  if (!rawQuery || !rawQuery.trim()) return true
  const query = normalizeSearchQuery(rawQuery)
  if (!query) return true

  const terms = query.split(' ').filter(Boolean)

  const target = normalizeSearchQuery(
    `${drug.name || ''} ${drug.commercial_name_en || ''} ${drug.nameAr || ''} ${drug.commercial_name_ar || ''} ${drug.activeIngredient || ''} ${drug.scientific_name || ''} ${drug.company || ''} ${drug.manufacturer || ''}`
  )

  const targetVowelless = stripArabicVowels(target)

  // Every typed word must appear in the drug's combined information
  return terms.every((term) => {
    if (target.includes(term)) return true
    // Arabic vowel-root matching for terms with at least 3 consonant characters (e.g. بنادول vs بانادول)
    const termVowelless = stripArabicVowels(term)
    if (termVowelless.length >= 3 && targetVowelless.includes(termVowelless)) {
      return true
    }
    return false
  })
}

