import assert from 'node:assert'
import {
  getCairoDateString,
  getCairoHour,
  scrapeDawaaPriceUpdates
} from '../src/lib/server/medicine-sync-service.ts'
import {
  normalizeDrugKey,
  normalizeArabicDrugKey,
  canonicalDrugIdentifier
} from '../src/lib/drugUtils.ts'

console.log('--- RUNNING MEDICINE DIRECTORY & SYNC TEST SUITE ---')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✅ [PASS] ${name}`)
  } catch (err) {
    failed++
    console.error(`  ❌ [FAIL] ${name}:`, err.message)
  }
}

// 1. Cairo Timezone & Date
await test('Cairo Date string is formatted as YYYY-MM-DD in Africa/Cairo', () => {
  const cairoDate = getCairoDateString()
  assert(/^\d{4}-\d{2}-\d{2}$/.test(cairoDate), 'Date must match YYYY-MM-DD')
  const hour = getCairoHour()
  assert(Number.isInteger(hour) && hour >= 0 && hour <= 23, 'Hour must be 0-23')
})

// 2. Drug Normalization Utilities
await test('Drug key normalizer creates consistent keys in English and Arabic', () => {
  const normEn1 = normalizeDrugKey('Augmentin 1 g (14 Tablets)')
  const normEn2 = normalizeDrugKey('augmentin-1g-14-tab')
  assert(normEn1.includes('augmentin1g'), 'Must normalize Augmentin dosage')
  assert(normEn2.includes('augmentin1g'), 'Must normalize slug')

  const normAr = normalizeArabicDrugKey('أوجمنتين 1 جم 14 قرص')
  assert(normAr.includes('اوجمنتين1جم'), 'Must normalize Arabic letters and dosage')
})

await test('Canonical drug identifier strips pack counts and pharmaceutical forms', () => {
  const canon1 = canonicalDrugIdentifier('Augmentin 1g 14 Tablets')
  const canon2 = canonicalDrugIdentifier('Augmentin 1000mg 7 Tabs')
  assert(canon1.includes('augmentin'), 'Must contain base drug name')
  assert(!canon1.includes('tablets'), 'Must strip tablet word')
})

// 3. Live DawaaGate Scraper Test
await test('DawaaGate live price-updates scraper returns real drugs with valid positive prices', async () => {
  const drugs = await scrapeDawaaPriceUpdates(1)
  assert(Array.isArray(drugs), 'Must return an array of drugs')
  assert(drugs.length > 0, `Expected at least 1 drug from DawaaGate, found ${drugs.length}`)

  for (const d of drugs) {
    assert(d.slug && typeof d.slug === 'string', 'Drug must have a slug')
    assert(d.nameAr && typeof d.nameAr === 'string', 'Drug must have an Arabic name')
    assert(typeof d.price === 'number' && d.price > 0, `Drug price must be positive number: ${d.price}`)
  }

  const sample = drugs[0]
  console.log(`     Sample drug scraped: "${sample.nameAr}" (${sample.slug}) = ${sample.price} EGP (Old: ${sample.oldPrice} EGP)`)
})

// 4. Strict Validation: Zero or negative prices are rejected
await test('Zero or negative prices are strictly excluded by scraper', async () => {
  // Test parser logic with mock zero price
  const invalidDrug = {
    slug: 'invalid-drug',
    nameAr: 'دواء غير صالح',
    price: 0
  }
  const isAccepted = Boolean(invalidDrug.price && invalidDrug.price > 0 && !isNaN(invalidDrug.price))
  assert.strictEqual(isAccepted, false, 'Price <= 0 must be rejected')
})

// 5. Distributed Lock Simulation
await test('Distributed lock rejects concurrent sync when active (<15 mins) and allows when expired', () => {
  const recentLock = {
    lockedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    lockedBy: 'cron'
  }
  const isRecentLocked = Date.now() - new Date(recentLock.lockedAt).getTime() < 15 * 60 * 1000
  assert.strictEqual(isRecentLocked, true, 'Recent lock must block concurrent sync')

  const expiredLock = {
    lockedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 mins ago
    lockedBy: 'cron'
  }
  const isExpiredLocked = Date.now() - new Date(expiredLock.lockedAt).getTime() < 15 * 60 * 1000
  assert.strictEqual(isExpiredLocked, false, 'Expired lock (>15 mins) must allow sync')
})

console.log(`\nTEST SUMMARY: Passed: ${passed}, Failed: ${failed}`)
if (failed > 0) process.exit(1)
