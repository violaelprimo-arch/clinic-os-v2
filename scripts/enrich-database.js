const fs = require('fs')
const path = require('path')

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
}

const dbPath = path.join(__dirname, '..', 'src', 'data', 'egyptian-drugs-database.json')
const existingData = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const drugMap = new Map()

for (const d of existingData) {
  drugMap.set(d.slug || d.name, d)
}
console.log(`Starting with ${drugMap.size} existing drugs in database.`)

function parseCards(html) {
  const cardRegex = /<[^>]*\bdata-slug=["']([^"']+)["'][^>]*>/gi
  let m
  let added = 0
  while ((m = cardRegex.exec(html)) !== null) {
    const fullTag = m[0]
    const getAttr = (name) => {
      const match = fullTag.match(new RegExp('\\b' + name + '=["\']([^"\']*)["\']', 'i'))
      return match ? match[1] : ''
    }
    const slug = m[1]
    const nameAr = getAttr('data-ar').trim()
    const nameEn = (getAttr('data-en') || slug.replace(/-/g, ' ')).trim()
    const priceStr = getAttr('data-price')
    const price = parseFloat(priceStr) || 0
    const company = getAttr('data-company').trim() || 'سوق الدواء المصري'
    const activeIngredient = getAttr('data-ing').trim() || 'معتمد مصرياً'

    let oldPrice = 0
    const cardEndIdx = html.indexOf('</div>', m.index + fullTag.length)
    if (cardEndIdx !== -1) {
      const cardSub = html.slice(m.index, Math.min(html.length, cardEndIdx + 300))
      const oldMatch = cardSub.match(/class=["'][^"']*ph-price-old[^"']*["']>([^<]+)<\/span>/i)
      if (oldMatch) {
        oldPrice = parseFloat(oldMatch[1].replace(/[^0-9.]/g, '')) || 0
      }
    }

    if (slug && (nameEn || nameAr)) {
      let form = 'أقراص'
      const text = (nameEn + ' ' + nameAr).toLowerCase()
      if (text.includes('syrup') || text.includes('شراب') || text.includes('suspension') || text.includes('معلق')) form = 'شراب / معلق'
      else if (text.includes('caps') || text.includes('كبسول')) form = 'كبسولات'
      else if (text.includes('inj') || text.includes('amp') || text.includes('vial') || text.includes('حقن') || text.includes('امبول')) form = 'حقن'
      else if (text.includes('drop') || text.includes('نقط')) form = 'نقط'
      else if (text.includes('cream') || text.includes('كريم')) form = 'كريم'
      else if (text.includes('gel') || text.includes('جل')) form = 'جل'
      else if (text.includes('effervescent') || text.includes('فوار') || text.includes('sachet') || text.includes('اكياس')) form = 'فوار / أكياس'

      const drug = {
        id: slug,
        slug,
        name: nameEn,
        nameAr: nameAr || nameEn,
        commercial_name_en: nameEn,
        commercial_name_ar: nameAr || nameEn,
        activeIngredient,
        company,
        form,
        price,
        oldPrice: oldPrice > 0 ? oldPrice : undefined,
        isMarketUpdated: true,
        lastMarketUpdate: '2026-10-25'
      }

      if (!drugMap.has(slug)) {
        drugMap.set(slug, drug)
        added++
      } else {
        // Update price
        const cur = drugMap.get(slug)
        drugMap.set(slug, { ...cur, ...drug })
      }
    }
  }
  return added
}

async function run() {
  const enrichQueries = [
    'cetal', 'سيتال', 'solpadeine', 'سولبادين', 'amoun', 'امون',
    'ciprofar', 'سبروفار', 'antiflam', 'انتيفلام', 'antidiar', 'انتيديار',
    'zantac', 'زنتاك', 'ranitidine', 'famotin', 'فاموتين', 'gastrazole', 'جاسترازول',
    'motil fast', 'موتيل فاست', 'digestin', 'دايجستين', 'eunalgic', 'يونالجيك',
    'spasmo', 'سبازمو', 'spasmo digestin', 'سبازمودايجستين', 'spasmofen', 'سباسموفين',
    'colospasmin', 'كولوسبازمين', 'duspatalin', 'دوسباتالين', 'coloverin', 'كولوفيرين',
    'gastreg', 'جاسترج', 'mosapride', 'موزابرايد', 'ganaton', 'جاناتون',
    'urivin', 'يوريفين', 'urocolite', 'يوروكوليت', 'zyloric', 'زيلوريك',
    'no uric', 'نو يوريك', 'purinol', 'بيورينول', 'colchicine', 'كولشيسين',
    'alphintern', 'الفنترن', 'ambezim', 'امبيزيم', 'maxilase', 'ماكسيلاز',
    'strepsils', 'ستربسلز', 'larypro', 'لاريبرو', 'zoron', 'زورون',
    'bepanthen', 'بيبانثين', 'panthenol', 'بانثينول', 'mebo', 'ميبو',
    'betadine', 'بيتادين', 'dermatin', 'ديرماتين', 'daktarin', 'داكتارين',
    'candistan', 'كاندستان', 'travocort', 'ترافوكورت', 'betaderm', 'بيتاديرم',
    'elocon', 'اليكون', 'diprosalic', 'ديبروساليك', 'salibet', 'ساليبت',
    'diprogent', 'ديبروجنت', 'fucicort', 'فيوسيكورت', 'fucidin', 'فيوسيدين',
    'garamycin', 'جارامايسين', 'terramycin', 'تيرامايسين', 'tobrex', 'توبركس',
    'tobradex', 'توبرادكس', 'prerfrin', 'برفرين', 'systane', 'سيستين',
    'polyfresh', 'بولي فريش', 'artelac', 'ارتيلاك', 'hyfresh', 'هاي فريش'
  ]

  console.log(`Enriching with ${enrichQueries.length} targeted queries...`)
  for (let i = 0; i < enrichQueries.length; i++) {
    const q = enrichQueries[i]
    try {
      const res = await fetch(`https://www.dawaagate.com/search?q=${encodeURIComponent(q)}`, { headers })
      if (res.ok) {
        const added = parseCards(await res.text())
        if (added > 0) {
          console.log(`  [${i + 1}/${enrichQueries.length}] "${q}": +${added} items (Total: ${drugMap.size})`)
        }
      }
    } catch (e) {
      console.warn(`Query ${q} error:`, e.message)
    }
  }

  // Also scrape medicines page 31 to 40
  console.log('Fetching medicines index pages 31..40...')
  for (let p = 31; p <= 40; p++) {
    try {
      const res = await fetch(`https://www.dawaagate.com/medicines?page=${p}`, { headers })
      if (res.ok) {
        const added = parseCards(await res.text())
        console.log(`  Page ${p}: +${added} (Total: ${drugMap.size})`)
      }
    } catch (e) {
      console.warn(`Page ${p} error:`, e.message)
    }
  }

  const finalArray = Array.from(drugMap.values())
  fs.writeFileSync(dbPath, JSON.stringify(finalArray, null, 2), 'utf8')
  console.log(`\n Successfully updated ${dbPath} with ${finalArray.length} medications!`)
}

run().catch(console.error)
