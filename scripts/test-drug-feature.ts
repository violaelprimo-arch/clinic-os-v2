import { EGYPTIAN_DRUGS_CATALOG } from '../src/lib/egyptian-drugs'
import { matchesDrugSearch, normalizeSearchQuery, canonicalDrugIdentifier } from '../src/lib/drugUtils'

console.log('🧪 Starting Bilingual Egyptian Drug Catalog Automated Tests...')

// Test 1: Catalog size
console.log(`📦 Catalog size: ${EGYPTIAN_DRUGS_CATALOG.length} medications`)
if (EGYPTIAN_DRUGS_CATALOG.length < 1000) {
  throw new Error(`Expected at least 1,000 medications, got ${EGYPTIAN_DRUGS_CATALOG.length}`)
}

// Test 2: Bilingual names presence
let arCount = 0
let enCount = 0
let priceCount = 0

for (const d of EGYPTIAN_DRUGS_CATALOG) {
  if (d.commercial_name_ar || d.nameAr) arCount++
  if (d.commercial_name_en || d.name) enCount++
  if ((d.price || 0) > 0) priceCount++
}

console.log(`✅ Medications with Arabic commercial trade name: ${arCount}/${EGYPTIAN_DRUGS_CATALOG.length} (${((arCount/EGYPTIAN_DRUGS_CATALOG.length)*100).toFixed(1)}%)`)
console.log(`✅ Medications with English commercial trade name: ${enCount}/${EGYPTIAN_DRUGS_CATALOG.length} (${((enCount/EGYPTIAN_DRUGS_CATALOG.length)*100).toFixed(1)}%)`)
console.log(`✅ Medications with valid EGP daily prices: ${priceCount}/${EGYPTIAN_DRUGS_CATALOG.length} (${((priceCount/EGYPTIAN_DRUGS_CATALOG.length)*100).toFixed(1)}%)`)

if (arCount < 1000 || enCount < 1000) {
  throw new Error('Arabic or English trade names missing from primary catalog')
}

// Test 3: Search queries test
const testQueries = [
  // Arabic queries
  { q: 'بنادول', expectedMin: 3, label: 'Arabic Panadol (بدون ألف)' },
  { q: 'بانادول', expectedMin: 3, label: 'Arabic Panadol (بألف)' },
  { q: 'اوجمنتين', expectedMin: 2, label: 'Arabic Augmentin (ألف عادية)' },
  { q: 'أوجمنتين', expectedMin: 2, label: 'Arabic Augmentin (همزة)' },
  { q: 'كونترولوك', expectedMin: 1, label: 'Arabic Controloc' },
  { q: 'سيتال', expectedMin: 1, label: 'Arabic Cetal' },
  { q: 'كيتولاك', expectedMin: 1, label: 'Arabic Ketolac' },
  { q: 'سولبادين', expectedMin: 1, label: 'Arabic Solpadeine' },

  // English queries
  { q: 'panadol', expectedMin: 3, label: 'English Panadol' },
  { q: 'augmentin', expectedMin: 2, label: 'English Augmentin' },
  { q: 'controloc', expectedMin: 1, label: 'English Controloc' },
  { q: 'cetal', expectedMin: 1, label: 'English Cetal' },
  { q: 'ketolac', expectedMin: 1, label: 'English Ketolac' },
  { q: 'solpadeine', expectedMin: 1, label: 'English Solpadeine' },

  // Active Ingredient queries
  { q: 'paracetamol', expectedMin: 10, label: 'Active ingredient Paracetamol' },
  { q: 'amoxicillin', expectedMin: 5, label: 'Active ingredient Amoxicillin' },
  { q: 'pantoprazole', expectedMin: 3, label: 'Active ingredient Pantoprazole' },

  // Company queries
  { q: 'amoun', expectedMin: 3, label: 'Company Amoun' },
  { q: 'امون', expectedMin: 5, label: 'Company Amoun (Arabic)' },
  { q: 'eva', expectedMin: 5, label: 'Company Eva Pharma' }
]

console.log('\n🔍 Testing Bilingual Search Precision:')
let allPassed = true
for (const test of testQueries) {
  const matches = EGYPTIAN_DRUGS_CATALOG.filter(d => matchesDrugSearch(d, test.q))
  const passed = matches.length >= test.expectedMin
  console.log(`  ${passed ? '✅' : '❌'} [${test.label}] Query: "${test.q}" -> Found ${matches.length} results (expected >= ${test.expectedMin})`)
  if (!passed) allPassed = false
}

if (!allPassed) {
  throw new Error('Some search test queries failed!')
}

console.log('\n🎉 ALL 19 BILINGUAL SEARCH & DATA INTEGRITY TESTS PASSED SUCCESSFULLY!')
