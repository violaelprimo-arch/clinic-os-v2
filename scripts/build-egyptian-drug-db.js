const fs = require('fs');
const path = require('path');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
};

const drugsMap = new Map();

function parseCards(html) {
  const cardRegex = /<[^>]*\bdata-slug=["']([^"']+)["'][^>]*>/gi;
  let m;
  let count = 0;
  while ((m = cardRegex.exec(html)) !== null) {
    const fullTag = m[0];
    const getAttr = (name) => {
      const match = fullTag.match(new RegExp('\\b' + name + '=["\']([^"\']*)["\']', 'i'));
      return match ? match[1] : '';
    };
    const slug = m[1];
    const nameAr = getAttr('data-ar').trim();
    const nameEn = (getAttr('data-en') || slug.replace(/-/g, ' ')).trim();
    const priceStr = getAttr('data-price');
    const price = parseFloat(priceStr) || 0;
    const company = getAttr('data-company').trim() || 'سوق الدواء المصري';
    const activeIngredient = getAttr('data-ing').trim() || 'معتمد مصرياً';

    // Parse old price if available
    let oldPrice = 0;
    const cardEndIdx = html.indexOf('</div>', m.index + fullTag.length);
    if (cardEndIdx !== -1) {
      const cardSub = html.slice(m.index, Math.min(html.length, cardEndIdx + 300));
      const oldMatch = cardSub.match(/class=["'][^"']*ph-price-old[^"']*["']>([^<]+)<\/span>/i);
      if (oldMatch) {
        oldPrice = parseFloat(oldMatch[1].replace(/[^0-9.]/g, '')) || 0;
      }
    }

    if (slug && (nameEn || nameAr)) {
      // Determine form
      let form = 'أقراص';
      const text = (nameEn + ' ' + nameAr).toLowerCase();
      if (text.includes('syrup') || text.includes('شراب') || text.includes('suspension') || text.includes('معلق')) form = 'شراب / معلق';
      else if (text.includes('caps') || text.includes('كبسول')) form = 'كبسولات';
      else if (text.includes('inj') || text.includes('amp') || text.includes('vial') || text.includes('حقن') || text.includes('امبول')) form = 'حقن';
      else if (text.includes('drop') || text.includes('نقط')) form = 'نقط';
      else if (text.includes('cream') || text.includes('كريم')) form = 'كريم';
      else if (text.includes('gel') || text.includes('جل')) form = 'جل';
      else if (text.includes('ointment') || text.includes('مرهم')) form = 'مرهم';
      else if (text.includes('spray') || text.includes('بخاخ')) form = 'بخاخ';
      else if (text.includes('effervescent') || text.includes('فوار') || text.includes('sachet') || text.includes('اكياس')) form = 'فوار / أكياس';
      else if (text.includes('supp') || text.includes('لبوس')) form = 'لبوس';

      const key = slug.toLowerCase();
      if (!drugsMap.has(key) || (price > 0 && drugsMap.get(key).price === 0)) {
        drugsMap.set(key, {
          id: slug,
          slug,
          name: nameEn,
          commercial_name_en: nameEn,
          nameAr: nameAr,
          commercial_name_ar: nameAr,
          activeIngredient,
          company,
          form,
          price,
          oldPrice: oldPrice > 0 ? oldPrice : undefined,
          isMarketUpdated: price > 0,
          lastMarketUpdate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
        });
        count++;
      }
    }
  }
  return count;
}

async function run() {
  console.log('=== Starting DawaaGate Drug Catalog Build ===');

  // 1. Common Egyptian queries (Arabic & English)
  const popularQueries = [
    'panadol', 'بنادول', 'augmentin', 'اوجمنتين', 'brufen', 'بروفين',
    'cataflam', 'كتافلام', 'voltaren', 'فولتارين', 'congestal', 'كونجستال',
    'comtrex', 'كومتركس', '1 2 3', 'وان تو ثري', 'hibiotic', 'هايبيوتك',
    'megamox', 'ميجاموكس', 'flumox', 'فلوموكس', 'zithromax', 'زيثروماكس',
    'cipro', 'سيبرو', 'tavanic', 'تافانيك', 'flagyl', 'فلاجيل',
    'antinal', 'انتينال', 'visceralgin', 'فيسرالجين', 'colona', 'كولونا',
    'motilium', 'موتيليوم', 'nexium', 'نكسيوم', 'controloc', 'كونترولوك',
    'gaviscon', 'جافيسكون', 'zyrtec', 'زيرتك', 'telfast', 'تلفاست',
    'claritine', 'كلاريتين', 'aerius', 'ايريوس', 'eltroxin', 'التيروكسين',
    'glucophage', 'جلوكوفاج', 'amaryl', 'اماريل', 'diamicron', 'دياميكرون',
    'concor', 'كونكور', 'capoten', 'كابوتن', 'exforge', 'اكسفورج',
    'plavix', 'بلافيكس', 'aspirin', 'اسبرين', 'clexane', 'كليكسان',
    'lipitor', 'ليبيتور', 'crestor', 'كريستور', 'ator', 'اتور',
    'milga', 'ميلجا', 'neuroton', 'نيوروتون', 'lyrica', 'ليريكا',
    'tegretol', 'تجرتول', 'depakine', 'ديباكين', 'cipralex', 'سيبرالكس',
    'lustral', 'لوسترال', 'prozac', 'بروزاك', 'viagra', 'فياجرا',
    'cialis', 'سياليس', 'daflon', 'دافيلون', 'alphintern', 'الفنترن',
    'otrivin', 'اوترفينات', 'avamys', 'افاميس', 'fucidin', 'فيوسيدين',
    'fucicort', 'فيوسيكورت', 'kenacomb', 'كيناكومب', 'lamisil', 'لاميسيل',
    'lasix', 'لازيكس', 'ketofan', 'كيتوفان', 'ketolac', 'كيتولاك',
    'centrum', 'سنتروم', 'osteocare', 'اوستيوكير', 'genuphil', 'جينوفيل',
    'rowatinex', 'رواتينكس', 'ursofalk', 'اورسوفالك', 'durafen', 'امريزول',
    'amrizole', 'pantoloc', 'بانتولوك', 'maalox', 'مالوكس', 'streptoquin', 'ستربتوكين'
  ];

  console.log(`Searching for ${popularQueries.length} popular clinical drug queries on DawaaGate...`);
  for (let i = 0; i < popularQueries.length; i++) {
    const q = popularQueries[i];
    try {
      const res = await fetch(`https://www.dawaagate.com/search?q=${encodeURIComponent(q)}`, { headers });
      if (res.ok) {
        const added = parseCards(await res.text());
        if (added > 0) {
          console.log(`  [${i + 1}/${popularQueries.length}] Query "${q}": +${added} items (Total: ${drugsMap.size})`);
        }
      }
    } catch (err) {
      console.warn(`Query ${q} error:`, err.message);
    }
  }

  // 2. Scrape common catalog pages from medicines index (first 30 pages)
  console.log('\nScraping catalog index pages 1..30...');
  for (let p = 1; p <= 30; p++) {
    try {
      const res = await fetch(`https://www.dawaagate.com/medicines?page=${p}`, { headers });
      if (res.ok) {
        parseCards(await res.text());
        if (p % 10 === 0) {
          console.log(`  Catalog page ${p}/30 done. Total drugs: ${drugsMap.size}`);
        }
      }
    } catch (err) {
      console.warn(`Catalog page ${p} error:`, err.message);
    }
  }

  const allDrugs = Array.from(drugsMap.values());
  allDrugs.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n=== Total unique Egyptian medications compiled: ${allDrugs.length} ===`);

  // Save to src/data/egyptian-drugs-database.json
  const outPath = path.join(__dirname, '../src/data/egyptian-drugs-database.json');
  fs.writeFileSync(outPath, JSON.stringify(allDrugs, null, 2), 'utf8');
  console.log(`Saved ${allDrugs.length} drugs to ${outPath}`);

  // Summary stats
  const withArabic = allDrugs.filter(d => d.nameAr).length;
  const withPrices = allDrugs.filter(d => d.price > 0).length;
  console.log(`  - With Arabic Commercial Name: ${withArabic}/${allDrugs.length} (${Math.round(withArabic/allDrugs.length*100)}%)`);
  console.log(`  - With Official EGP Market Price: ${withPrices}/${allDrugs.length} (${Math.round(withPrices/allDrugs.length*100)}%)`);
}

run().catch(console.error);
