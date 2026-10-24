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
 * Returns a canonical key that strips pharmaceutical forms, packaging counts, and aliases
 * to reliably match and deduplicate identical drug products across sources.
 */
export function canonicalDrugIdentifier(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    // 1. Remove parenthesized text (aliases, translations, ingredients)
    .replace(/\([^)]*\)/g, ' ')
    // 2. Normalize dosage units: 500 mg -> 500mg, 1 g -> 1g
    .replace(/(\d+)\s*(mg|gm|g|ml|mcg|iu|iu\/ml|%)/gi, '$1$2')
    .replace(/(\d+)\s*(مجم|جم|مل)/gi, '$1$2')
    // 3. Arabic letter normalization
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    // 4. Strip Arabic pack count (>=2 digits like 10, 20, 30) + forms
    .replace(/\b\d{2,}\s*(اقراص|قرص|كبسولات|كبسولة|امبولات|امبول|اكياس|كيس)/gi, ' ')
    .replace(/(اقراص|قرص|كبسولات|كبسولة|شراب|معلق|حقن|امبولات|امبول|نقط|مرهم|كريم|جل|فوار|اكياس|مغلفة|ملبس|ممتد المفعول)/gi, ' ')
    // 5. Strip English f.c. / film coated / enteric coated modifiers
    .replace(/f\.?\s*c\.?\s*(tabs?|tablets?)?/gi, ' ')
    .replace(/\b(film|enteric)\s+coated\b/gi, ' ')
    // 6. Strip English pack count (>=2 digits like 10, 20, 30) + forms
    .replace(/\b\d{2,}\s*(tabs|tab|tablets|caps|capsules|ampoules|amps|vials|vial)\b/gi, ' ')
    // 7. Strip standard English standalone form words
    .replace(/\b(tablets|tablet|tabs|tab|capsules|capsule|caps|cap|syrup|syp|suspension|susp|injection|inj|ampoules|ampoule|drops|ointment|oint|cream|gel|lotion|spray|effervescent|sachets|sachet)\b/gi, ' ')
    // 8. Strip standalone pack counts (>=2 digits)
    .replace(/\b(10|12|14|15|16|20|24|28|30|40|50|60|100)\b/g, ' ')
    // 9. Keep only alphanumeric
    .replace(/[^a-z0-9\u0621-\u064A]/gi, '')
    .trim()
}
