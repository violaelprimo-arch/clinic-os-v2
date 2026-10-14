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
