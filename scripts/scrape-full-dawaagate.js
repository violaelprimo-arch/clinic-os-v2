const https = require('https');
const fs = require('fs');
const path = require('path');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
};

function fetchUrl(url, retries = 3) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = 'https://www.dawaagate.com' + loc;
        return fetchUrl(loc, retries).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ ok: true, status: 200, html: data });
        } else {
          resolve({ ok: false, status: res.statusCode, html: '' });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (retries > 0) {
        setTimeout(() => fetchUrl(url, retries - 1).then(resolve), 1000);
      } else {
        resolve({ ok: false, error: 'Timeout', html: '' });
      }
    });

    req.on('error', (err) => {
      if (retries > 0) {
        setTimeout(() => fetchUrl(url, retries - 1).then(resolve), 1000);
      } else {
        resolve({ ok: false, error: err.message, html: '' });
      }
    });
  });
}

function parseCards(html) {
  const cardRegex = /<[^>]*\bdata-slug=["']([^"']+)["'][^>]*>/gi;
  let m;
  const items = [];
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
      let form = 'أقراص';
      const text = (nameEn + ' ' + nameAr).toLowerCase();
      if (text.includes('syrup') || text.includes('شراب') || text.includes('suspension') || text.includes('معلق')) form = 'شراب / معلق';
      else if (text.includes('caps') || text.includes('كبسول')) form = 'كبسولات';
      else if (text.includes('inj') || text.includes('amp') || text.includes('vial') || text.includes('حقن') || text.includes('امبول')) form = 'حقن';
      else if (text.includes('drop') || text.includes('نقط')) form = 'نقط';
      else if (text.includes('cream') || text.includes('كريم')) form = 'كريم';
      else if (text.includes('gel') || text.includes('جل')) form = 'جل';
      else if (text.includes('effervescent') || text.includes('فوار') || text.includes('sachet') || text.includes('اكياس')) form = 'فوار / أكياس';
      else if (text.includes('spray') || text.includes('بخاخ')) form = 'بخاخ';
      else if (text.includes('ointment') || text.includes('مرهم')) form = 'مرهم';
      else if (text.includes('lotion') || text.includes('لوشن')) form = 'لوشن';

      items.push({
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
      });
    }
  }
  return items;
}

async function scrapeAll() {
  console.log('🚀 Starting Full Catalog Scrape (Pages 1..288 with per=96)...');
  const drugMap = new Map();

  // Load existing database first
  const dbPath = path.join(__dirname, '..', 'src', 'data', 'egyptian-drugs-database.json');
  if (fs.existsSync(dbPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      for (const d of existing) {
        drugMap.set(d.slug || d.id || d.name, d);
      }
      console.log(`Loaded ${drugMap.size} existing medications to start.`);
    } catch {}
  }

  const TOTAL_PAGES = 288;
  const CONCURRENCY = 8;
  const pageNumbers = [];
  for (let p = 1; p <= TOTAL_PAGES; p++) pageNumbers.push(p);

  let completed = 0;

  async function worker(queue) {
    while (queue.length > 0) {
      const page = queue.shift();
      const url = page === 1
        ? 'https://www.dawaagate.com/medicines?per=96'
        : `https://www.dawaagate.com/medicines?per=96&page=${page}`;

      try {
        const res = await fetchUrl(url);
        if (res.ok && res.html) {
          const items = parseCards(res.html);
          for (const item of items) {
            const key = item.slug || item.id || item.name;
            if (!drugMap.has(key)) {
              drugMap.set(key, item);
            } else {
              // Update with fresher data
              const existing = drugMap.get(key);
              drugMap.set(key, { ...existing, ...item });
            }
          }
          completed++;
          if (completed % 10 === 0 || completed === TOTAL_PAGES) {
            console.log(`[${completed}/${TOTAL_PAGES}] (${Math.round((completed / TOTAL_PAGES) * 100)}%) - Total catalog size: ${drugMap.size} medications`);
          }
        } else {
          console.warn(`Page ${page} failed with status: ${res.status || res.error}`);
        }
      } catch (err) {
        console.warn(`Error on page ${page}:`, err.message);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(pageNumbers));
  }

  await Promise.all(workers);

  const finalCatalog = Array.from(drugMap.values());
  console.log(`\n🎉 Scrape Complete! Total unique Egyptian medications: ${finalCatalog.length}`);

  // 1. Save full catalog to public/data/egyptian-drugs-database.json (for fast CDN static loading)
  const publicDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const publicPath = path.join(publicDir, 'egyptian-drugs-database.json');
  fs.writeFileSync(publicPath, JSON.stringify(finalCatalog), 'utf8');
  console.log(`✅ Saved ${finalCatalog.length} medications to ${publicPath}`);

  // 2. Save full catalog to src/data/egyptian-drugs-database.json
  fs.writeFileSync(dbPath, JSON.stringify(finalCatalog), 'utf8');
  console.log(`✅ Saved ${finalCatalog.length} medications to ${dbPath}`);

  // 3. Save compact catalog (id, n, ar, ing, c, f, p) for ultra-compact packaging if needed
  const compactCatalog = finalCatalog.map(d => ({
    id: d.id,
    n: d.name,
    ar: d.nameAr,
    ing: d.activeIngredient,
    c: d.company,
    f: d.form,
    p: d.price
  }));
  const compactPath = path.join(publicDir, 'egyptian-drugs-compact.json');
  fs.writeFileSync(compactPath, JSON.stringify(compactCatalog), 'utf8');
  console.log(`✅ Saved compact catalog (${(fs.statSync(compactPath).size / 1024 / 1024).toFixed(2)} MB) to ${compactPath}`);
}

scrapeAll().catch(console.error);
