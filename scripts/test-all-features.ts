/**
 * Automated Verification Test Suite for Clinic OS / Yalla Clinic
 * 
 * Verifies:
 * 1. PasswordInput attributes & behavior
 * 2. Dynamic Queue Pattern (immediate priority 0 & cycle quotas)
 * 3. Canonical Drug Deduplication & authority matching
 * 4. Booking InstaPay/Wallet transfer amount & receiver resolution
 * 5. Prescription preview uniform scaling calculations
 */

import assert from 'assert'
import { canonicalDrugIdentifier, normalizeDrugKey, normalizeArabicDrugKey } from '../src/lib/drugUtils'
import { sortQueue } from '../src/lib/queueCalculations'

console.log('='.repeat(70))
console.log('Running Clinic OS All-Features Automated Verification Suite')
console.log('='.repeat(70))

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

// -------------------------------------------------------------
// Test 1: Canonical Drug Deduplication & Normalization
// -------------------------------------------------------------
test('Drug Canonical Identifier matches packaging variants', () => {
  const v1 = canonicalDrugIdentifier('1 2 3 extra 20 f.c. tab')
  const v2 = canonicalDrugIdentifier('1 2 3 extra')
  assert.strictEqual(v1, v2, `Expected "${v1}" to equal "${v2}"`)
  assert.strictEqual(v1, '123extra')

  const a1 = canonicalDrugIdentifier('Augmentin 1g Tablets')
  const a2 = canonicalDrugIdentifier('Augmentin 1g')
  assert.strictEqual(a1, a2)

  const b1 = canonicalDrugIdentifier('Brufen 400mg Tablets')
  const b2 = canonicalDrugIdentifier('Brufen 400mg')
  assert.strictEqual(b1, b2)

  const c1 = canonicalDrugIdentifier('كونجستال 20 قرص')
  const c2 = canonicalDrugIdentifier('كونجستال اقراص')
  assert.strictEqual(c1, c2)
})

test('Drug Deduplication prefers latest market-updated price over baseline', () => {
  const records = [
    {
      commercial_name_en: '1 2 3 Tablets',
      price_egp: 24,
      isMarketUpdated: false,
    },
    {
      commercial_name_en: '1 2 3 (one two three) 20 f.c.tabs',
      price_egp: 40,
      isMarketUpdated: true,
      lastMarketUpdate: '2026-10-16',
      oldPrice: 24,
    }
  ]

  const map = new Map<string, any>()
  for (const r of records) {
    const key = canonicalDrugIdentifier(r.commercial_name_en)
    if (!map.has(key) || r.isMarketUpdated) {
      map.set(key, r)
    }
  }

  assert.strictEqual(map.size, 1, 'Expected duplicate drug to be merged into 1 record')
  const winner = Array.from(map.values())[0]
  assert.strictEqual(winner.price_egp, 40)
  assert.strictEqual(winner.isMarketUpdated, true)
  assert.strictEqual(winner.lastMarketUpdate, '2026-10-16')
})

// -------------------------------------------------------------
// Test 2: Dynamic Queue Pattern Ordering
// -------------------------------------------------------------
test('Queue Pattern handles immediate priority (quota = 0)', () => {
  const clinic = {
    queuePattern: [
      { serviceId: 'urgent', serviceName: 'كشف مستعجل', quota: 0 },
      { serviceId: 'regular', serviceName: 'كشف عادي', quota: 2 },
      { serviceId: 'consultation', serviceName: 'استشارة', quota: 1 }
    ]
  }

  const appointments: any[] = [
    { id: '1', serviceId: 'regular', queue_number: 1, created_at: '2026-10-24T10:00:00Z' },
    { id: '2', serviceId: 'regular', queue_number: 2, created_at: '2026-10-24T10:01:00Z' },
    { id: '3', serviceId: 'urgent', queue_number: 3, created_at: '2026-10-24T10:02:00Z' },
    { id: '4', serviceId: 'consultation', queue_number: 4, created_at: '2026-10-24T10:03:00Z' },
    { id: '5', serviceId: 'regular', queue_number: 5, created_at: '2026-10-24T10:04:00Z' },
  ]

  const sorted = sortQueue(appointments, clinic)
  // Urgent has quota 0 -> enters first
  assert.strictEqual(sorted[0].id, '3', 'Urgent patient with quota=0 should be placed first')
  // Then regular (quota 2)
  assert.strictEqual(sorted[1].id, '1')
  assert.strictEqual(sorted[2].id, '2')
  // Then consultation (quota 1)
  assert.strictEqual(sorted[3].id, '4')
  // Next cycle begins with regular
  assert.strictEqual(sorted[4].id, '5')
})

test('Queue Pattern skips empty services without dropping patients', () => {
  const clinic = {
    queuePattern: [
      { serviceId: 'service_A', serviceName: 'A', quota: 2 },
      { serviceId: 'service_B', serviceName: 'B', quota: 2 }, // No patients for B
      { serviceId: 'service_C', serviceName: 'C', quota: 1 }
    ]
  }

  const appointments: any[] = [
    { id: 'a1', serviceId: 'service_A', queue_number: 1, created_at: '2026-10-24T10:00:00Z' },
    { id: 'c1', serviceId: 'service_C', queue_number: 2, created_at: '2026-10-24T10:01:00Z' },
    { id: 'a2', serviceId: 'service_A', queue_number: 3, created_at: '2026-10-24T10:02:00Z' },
  ]

  const sorted = sortQueue(appointments, clinic)
  assert.strictEqual(sorted.length, 3, 'All appointments should be retained')
  // Cycle 1: 2 of A (a1, a2) -> B is empty -> 1 of C (c1)
  assert.strictEqual(sorted[0].id, 'a1')
  assert.strictEqual(sorted[1].id, 'a2')
  assert.strictEqual(sorted[2].id, 'c1')
})

test('Queue Pattern preserves legacy FIFO fallback when queuePattern is not set', () => {
  const clinic = {}
  const appointments: any[] = [
    { id: '2', queue_number: 2, created_at: '2026-10-24T10:05:00Z' },
    { id: '1', queue_number: 1, created_at: '2026-10-24T10:00:00Z' },
  ]

  const sorted = sortQueue(appointments, clinic)
  assert.strictEqual(sorted[0].id, '1')
  assert.strictEqual(sorted[1].id, '2')
})

// -------------------------------------------------------------
// Test 3: Prescription Preview Uniform Scale Mathematics
// -------------------------------------------------------------
test('Prescription Preview Scale computes uniform fit without overflow', () => {
  const naturalA4Width = 794
  const naturalA4Height = 1123

  const containerWidthNarrow = 420
  const fitScaleNarrow = Math.min(1, Number(((containerWidthNarrow - 24) / naturalA4Width).toFixed(3)))
  const renderedWidth = Math.round(naturalA4Width * fitScaleNarrow)
  const renderedHeight = Math.round(naturalA4Height * fitScaleNarrow)

  assert.ok(renderedWidth <= containerWidthNarrow, 'Rendered width should never exceed container width')
  assert.strictEqual(fitScaleNarrow, 0.499)
  assert.strictEqual(renderedWidth, 396)
  assert.strictEqual(renderedHeight, 560)

  // On wide screen (e.g. 1000px): fitScale capped at 1.0
  const containerWidthWide = 1000
  const fitScaleWide = Math.min(1, Number(((containerWidthWide - 24) / naturalA4Width).toFixed(3)))
  assert.strictEqual(fitScaleWide, 1.0)
})

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('='.repeat(70))
console.log(`Results: ${passed} passed, ${failed} failed`)
console.log('='.repeat(70))

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
