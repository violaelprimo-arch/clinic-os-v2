import fs from 'fs'

const filePath = 'src/hooks/useEgyptianDrugs.ts'
let content = fs.readFileSync(filePath, 'utf8')
const isCrlf = content.includes('\r\n')
let normalized = content.replace(/\r\n/g, '\n')

const target = `  // 1. Register baseline comprehensive Egyptian catalog (1,000+ curated items)
  for (const c of EGYPTIAN_DRUGS_CATALOG) {
    registerDrug({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameAr: c.nameAr || '',
      commercial_name_en: c.commercial_name_en || c.name,
      commercial_name_ar: c.commercial_name_ar || c.nameAr || '',
      scientific_name: c.activeIngredient || 'معتمد مصرياً',
      activeIngredient: c.activeIngredient || 'معتمد مصرياً',
      manufacturer: c.company || 'سوق الدواء المصري',
      company: c.company || 'سوق الدواء المصري',
      drug_class: 'دليل الأدوية المصري',
      route: c.form || 'أقراص',
      form: c.form || 'أقراص',
      price_egp: c.price,
      price: c.price,
      oldPrice: c.oldPrice,
      isMarketUpdated: c.isMarketUpdated ?? (c.price > 0),
      lastMarketUpdate: c.lastMarketUpdate || '',
    })
  }`

const replacement = `  // 1. Register baseline comprehensive Egyptian catalog (curated top items in-memory)
  for (const c of EGYPTIAN_DRUGS_CATALOG) {
    registerDrug({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameAr: c.nameAr || '',
      commercial_name_en: c.commercial_name_en || c.name,
      commercial_name_ar: c.commercial_name_ar || c.nameAr || '',
      scientific_name: c.activeIngredient || 'معتمد مصرياً',
      activeIngredient: c.activeIngredient || 'معتمد مصرياً',
      manufacturer: c.company || 'سوق الدواء المصري',
      company: c.company || 'سوق الدواء المصري',
      drug_class: 'دليل الأدوية المصري',
      route: c.form || 'أقراص',
      form: c.form || 'أقراص',
      price_egp: c.price,
      price: c.price,
      oldPrice: c.oldPrice,
      isMarketUpdated: c.isMarketUpdated ?? (c.price > 0),
      lastMarketUpdate: c.lastMarketUpdate || '',
    })
  }

  // 1b. Load complete 27,000+ catalog asynchronously in the browser without taxing Worker CPU
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/data/egyptian-drugs-compact.json')
      if (res.ok) {
        const compactList = await res.json()
        if (Array.isArray(compactList)) {
          for (const item of compactList) {
            const nameEn = item.n || ''
            const nameAr = item.ar || ''
            const canonKey =
              canonicalDrugIdentifier(nameEn) ||
              canonicalDrugIdentifier(nameAr) ||
              normalizeDrugKey(nameEn)
            if (canonKey && !drugMap.has(canonKey)) {
              drugMap.set(canonKey, {
                id: item.id || \`eg-\${canonKey}\`,
                name: nameEn,
                nameAr,
                commercial_name_en: nameEn,
                commercial_name_ar: nameAr,
                scientific_name: item.ing || 'معتمد مصرياً',
                activeIngredient: item.ing || 'معتمد مصرياً',
                manufacturer: item.c || 'سوق الدواء المصري',
                company: item.c || 'سوق الدواء المصري',
                drug_class: 'دليل الأدوية المصري',
                route: item.f || 'أقراص',
                form: item.f || 'أقراص',
                price_egp: Number(item.p) || 0,
                price: Number(item.p) || 0,
                canonicalKey: canonKey,
              })
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not load full compact drug database in background:', err)
    }
  }`

if (!normalized.includes(target)) {
  console.error('Target not found in useEgyptianDrugs.ts')
  process.exit(1)
}

normalized = normalized.replace(target, replacement)
if (isCrlf) normalized = normalized.replace(/\n/g, '\r\n')

fs.writeFileSync(filePath, normalized, 'utf8')
console.log('Successfully patched useEgyptianDrugs.ts!')
