import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parsePriceUpdates, parseDrugDetail, parseSourceDate, medicineSlug } from '../src/lib/server/dawaagate-parser.ts'
import { canonicalDrugIdentifier } from '../src/lib/drugUtils.ts'
import { getCairoDateString, getCairoHour } from '../src/lib/server/medicine-sync-service.ts'
const fixture = await readFile(new URL('./fixtures/dawaa-price-facts.html', import.meta.url), 'utf8')
test('current DawaaGate price table reads column date and follows actual pagination', () => {
  const page = parsePriceUpdates(fixture, 1)
  assert.equal(page.drugs.length, 2)
  assert.equal(page.hasNext, true)
  assert.equal(page.drugs[1].price, 165)
  assert.equal(page.drugs[1].oldPrice, 150)
  assert.equal(page.drugs[1].sourceDate, '2026-11-08')
})
test('detail JSON-LD @graph is supported and reads the exact box price', () => {
  const html = `<h1>بلانكورين 30 كبسولة</h1>
    <script type="application/ld+json">{"@graph":[{"@type":"Drug","name":"بلانكورين 30 كبسولة","alternateName":"planchoren 30 capsules","activeIngredient":"Folic Acid + Iron","manufacturer":{"name":"Egypt Care Pharma"}}]}</script>
    <span class="ddm-price-num">165.00</span><span class="ddm-price-old">السعر القديم: 150.00 جنيه</span>
    <p class="ddm-fresh-change"><time datetime="2026-11-08">8 نوفمبر</time></p>
    <p class="ddm-fresh-verified"><time datetime="2026-11-09">اليوم</time></p>`
  const drug = parseDrugDetail(html, 'planchoren-30-capsules')
  assert.equal(drug.price, 165)
  assert.equal(drug.company, 'Egypt Care Pharma')
  assert.equal(drug.sourceVerifiedDate, '2026-11-09')
})
test('empty source, invalid prices and missing change dates fail closed', () => {
  assert.throws(() => parsePriceUpdates('<html>Maintenance</html>', 1))
  assert.throws(() => parsePriceUpdates(fixture.replace('750.00', '0.00'), 1))
  assert.throws(() => parsePriceUpdates(fixture.replace('9 نوفمبر 2026', 'unknown'), 1))
})
test('package, strength and dosage form remain distinct SKUs', () => {
  assert.notEqual(canonicalDrugIdentifier('Augmentin 1g 14 Tablets'), canonicalDrugIdentifier('Augmentin 1g 7 Tablets'))
  assert.notEqual(canonicalDrugIdentifier('Drug 500 mg tablets'), canonicalDrugIdentifier('Drug 250 mg tablets'))
  assert.notEqual(canonicalDrugIdentifier('Drug 30 capsules'), canonicalDrugIdentifier('Drug 30 tablets'))
})
test('only HTTPS medicine URLs from the configured source are accepted', () => {
  assert.equal(medicineSlug('https://evil.example/medicine/a'), undefined)
  assert.equal(medicineSlug('http://www.dawaagate.com/medicine/a'), undefined)
  assert.equal(medicineSlug('/medicine/planchoren-30-capsules'), 'planchoren-30-capsules')
  assert.equal(parseSourceDate('٨ نوفمبر ٢٠٢٦'), '2026-11-08')
})
test('06:00 Cairo scheduling supports winter, summer and midnight rollover', () => {
  assert.equal(getCairoHour(new Date('2026-11-09T04:00:00Z')), 6)
  assert.equal(getCairoHour(new Date('2026-07-09T03:00:00Z')), 6)
  assert.equal(getCairoHour(new Date('2026-11-08T22:00:00Z')), 0)
  assert.equal(getCairoDateString(new Date('2026-11-08T22:00:00Z')), '2026-11-09')
})
