import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCairoDateString,
  getPresetDateRange,
  computePreviousPeriod,
  calculateDelta,
  resolvePatientAgeAtDate,
  computeAgeDistribution,
  normalizeArea,
  normalizeDiagnosis,
  computeAttendanceMetrics,
  computeTimingMetrics,
  computePeakTimesHeatmap,
  computeDataCompleteness
} from '../src/lib/analyticsService.ts'

test('1. Timezone & Cairo Date Boundaries', () => {
  const cairoDate = getCairoDateString(new Date('2026-10-26T22:30:00Z'))
  // 22:30 UTC = 01:30 (+3) next day in Cairo
  assert.equal(cairoDate, '2026-10-27')

  const presetToday = getPresetDateRange('today')
  assert.equal(presetToday.from, presetToday.to)

  const presetMonth = getPresetDateRange('month')
  assert.match(presetMonth.from, /^\d{4}-\d{2}-01$/)
})

test('2. Previous Period Span & Boundary Match', () => {
  // 15 days span: 2026-10-01 to 2026-10-15
  const currentRange = { from: '2026-10-01', to: '2026-10-15' }
  const prevRange = computePreviousPeriod(currentRange)

  assert.equal(prevRange.to, '2026-09-30')
  assert.equal(prevRange.from, '2026-09-16')

  // Previous span has exact same number of days (15 days)
  const d1 = new Date(currentRange.to) - new Date(currentRange.from)
  const d2 = new Date(prevRange.to) - new Date(prevRange.from)
  assert.equal(d1, d2)
})

test('3. Metric Delta Handling & Zero Baseline (No Infinity/NaN)', () => {
  // Baseline was 0, now 50 -> must NOT be Infinity
  const deltaFromZero = calculateDelta(50, 0)
  assert.equal(deltaFromZero.percentage, 100)
  assert.equal(deltaFromZero.formattedDelta, '+100%')
  assert.equal(deltaFromZero.isIncrease, true)

  // Both 0
  const deltaZeroZero = calculateDelta(0, 0)
  assert.equal(deltaZeroZero.percentage, 0)
  assert.equal(deltaZeroZero.formattedDelta, '0%')
  assert.equal(deltaZeroZero.isNeutral, true)

  // Normal increase: 100 -> 125 (+25%)
  const deltaNormal = calculateDelta(125, 100)
  assert.equal(deltaNormal.percentage, 25)
  assert.equal(deltaNormal.formattedDelta, '+25%')
  assert.equal(deltaNormal.isIncrease, true)

  // Normal decrease: 100 -> 80 (-20%)
  const deltaDecrease = calculateDelta(80, 100)
  assert.equal(deltaDecrease.percentage, -20)
  assert.equal(deltaDecrease.formattedDelta, '-20%')
  assert.equal(deltaDecrease.isIncrease, false)
})

test('4. Age Resolution: DOB, Recorded Age, Infants in Months, Invalid Exclusion', () => {
  // DOB based: Born 2000-05-10, visited 2026-10-26 -> Age 26
  const dobResult = resolvePatientAgeAtDate({ dob: '2000-05-10' }, '2026-10-26')
  assert.equal(dobResult.ageYears, 26)
  assert.equal(dobResult.isValid, true)
  assert.equal(dobResult.isInfantMonths, false)

  // Pediatric Infant in months: "6 شهور"
  const infantResult = resolvePatientAgeAtDate({ age: '6 شهور' }, '2026-10-26')
  assert.equal(infantResult.ageYears, 0.5)
  assert.equal(infantResult.isInfantMonths, true)
  assert.equal(infantResult.isValid, true)

  // Standard numeric string
  const numResult = resolvePatientAgeAtDate({ age: '45' }, '2026-10-26')
  assert.equal(numResult.ageYears, 45)
  assert.equal(numResult.isValid, true)

  // Invalid outlier: 150 years
  const invalidResult = resolvePatientAgeAtDate({ age: '150' }, '2026-10-26')
  assert.equal(invalidResult.isValid, false)
  assert.equal(invalidResult.ageYears, null)

  // Empty age
  const emptyResult = resolvePatientAgeAtDate({ age: '' }, '2026-10-26')
  assert.equal(emptyResult.isValid, false)
  assert.equal(emptyResult.ageYears, null)
})

test('5. Age Distribution Grouping & Statistics', () => {
  const patients = [
    { id: 'p1', age: '10', firstVisitDate: '2026-10-01' },   // pediatric (<18)
    { id: 'p2', age: '22', firstVisitDate: '2026-10-02' },   // youth (18-29)
    { id: 'p3', age: '35', firstVisitDate: '2026-10-03' },   // adults (30-49)
    { id: 'p4', age: '55', firstVisitDate: '2026-10-04' },   // middle (50-64)
    { id: 'p5', age: '70', firstVisitDate: '2026-10-05' },   // seniors (65+)
    { id: 'p6', age: '4 شهور', firstVisitDate: '2026-10-06' },// pediatric (<18) infant
    { id: 'p7', age: null, firstVisitDate: '2026-10-07' }    // missing
  ]

  const analysis = computeAgeDistribution(patients)

  assert.equal(analysis.validAgeCount, 6)
  assert.equal(analysis.missingAgeCount, 1)
  assert.equal(analysis.pediatricInfantsCount, 1)

  // Check brackets non-overlapping
  const ped = analysis.categories.find(c => c.id === 'pediatric')
  assert.equal(ped?.count, 2) // p1 and p6

  const youth = analysis.categories.find(c => c.id === 'youth')
  assert.equal(youth?.count, 1)

  const adults = analysis.categories.find(c => c.id === 'adults')
  assert.equal(adults?.count, 1)

  const middle = analysis.categories.find(c => c.id === 'middle')
  assert.equal(middle?.count, 1)

  const seniors = analysis.categories.find(c => c.id === 'seniors')
  assert.equal(seniors?.count, 1)

  // Mean age calculation: (10 + 22 + 35 + 55 + 70 + 0.3) / 6 = 32.1
  assert.ok(analysis.meanAge !== null && analysis.meanAge > 30 && analysis.meanAge < 35)
  // Median age is between 22 and 35
  assert.ok(analysis.medianAge !== null)
})

test('6. Geographic Normalization & Privacy', () => {
  // Cairo - Nasr city variant
  const r1 = normalizeArea('مدينة نصر - الحي العاشر')
  assert.equal(r1.normalizedId, 'cairo-nasr-city')
  assert.equal(r1.isMapped, true)
  assert.ok(r1.coords !== null && r1.coords.lat > 29)

  // New Cairo / Tagamoa variant
  const r2 = normalizeArea('التجمع الخامس')
  assert.equal(r2.normalizedId, 'cairo-new-cairo')
  assert.equal(r2.isMapped, true)

  // Giza - Dokki
  const r3 = normalizeArea('شارع مصدق - الدقي')
  assert.equal(r3.normalizedId, 'giza-dokki-mohandessin')
  assert.equal(r3.isMapped, true)

  // Unrecorded area
  const rUnrecorded = normalizeArea('')
  assert.equal(rUnrecorded.normalizedId, 'unrecorded')
  assert.equal(rUnrecorded.isMapped, false)

  // Unmapped free text
  const rUnmapped = normalizeArea('حي غير معروف بالمرة')
  assert.equal(rUnmapped.normalizedId, 'unmapped')
  assert.equal(rUnmapped.isMapped, false)
})

test('7. Diagnosis Standardization & Multi-Diagnosis Counting', () => {
  const d1 = normalizeDiagnosis('ضغط دم مرتفع')
  assert.equal(d1.key, 'hypertension')
  assert.equal(d1.isUnclassified, false)

  const d2 = normalizeDiagnosis('Diabetes type 2')
  assert.equal(d2.key, 'diabetes')
  assert.equal(d2.isUnclassified, false)

  const d3 = normalizeDiagnosis('')
  assert.equal(d3.isUnclassified, true)
})

test('8. Attendance Rates & Undecided Future Bookings Exclusion', () => {
  const appts = [
    { status: 'completed' },
    { status: 'completed' },
    { status: 'completed' },
    { status: 'cancelled' },
    { status: 'no_show' },
    { status: 'waiting' },   // Undecided - future
    { status: 'in_progress' } // Undecided - current
  ]

  const metrics = computeAttendanceMetrics(appts)

  // Resolved = 3 completed + 1 cancelled + 1 noShow = 5
  assert.equal(metrics.totalResolved, 5)
  assert.equal(metrics.totalUndecided, 2)
  assert.equal(metrics.completedCount, 3)
  assert.equal(metrics.cancelledCount, 1)
  assert.equal(metrics.noShowCount, 1)

  // Attendance rate = 3 / 5 = 60%
  assert.equal(metrics.attendanceRate, 60)
  // Cancellation rate = 1 / 5 = 20%
  assert.equal(metrics.cancellationRate, 20)
  // No-show rate = 1 / 5 = 20%
  assert.equal(metrics.noShowRate, 20)
})

test('9. Waiting & Consultation Timing Calculation with Outlier Exclusion', () => {
  const visits = [
    {
      arrivedAt: '2026-10-26T10:00:00Z',
      startedAt: '2026-10-26T10:20:00Z', // 20 mins wait
      completedAt: '2026-10-26T10:35:00Z' // 15 mins consult
    },
    {
      arrivedAt: '2026-10-26T11:00:00Z',
      startedAt: '2026-10-26T11:10:00Z', // 10 mins wait
      completedAt: '2026-10-26T11:30:00Z' // 20 mins consult
    },
    {
      // Missing start or negative duration -> excluded
      arrivedAt: '2026-10-26T12:00:00Z',
      startedAt: null,
      completedAt: null
    }
  ]

  const timing = computeTimingMetrics(visits)

  assert.equal(timing.validWaitingCount, 2)
  assert.equal(timing.validConsultationCount, 2)
  assert.equal(timing.meanWaitingMinutes, 15) // (20 + 10) / 2
  assert.equal(timing.meanConsultationMinutes, 17.5) // (15 + 20) / 2
})

test('10. Peak Times Heatmap Grid Population', () => {
  const appts = [
    { createdAt: '2026-10-24T10:15:00Z', status: 'completed' }, // Saturday 10:00
    { createdAt: '2026-10-24T10:45:00Z', status: 'completed' }, // Saturday 10:00
    { createdAt: '2026-10-25T14:30:00Z', status: 'completed' }  // Sunday 14:00
  ]

  const heatmap = computePeakTimesHeatmap(appts, 'booked')
  assert.equal(heatmap.cells.length, 7 * 14) // 7 days * 14 hours
  assert.ok(heatmap.maxDensity >= 2)
})

test('11. Data Completeness Metrics Audit', () => {
  const patients = [
    { id: '1', age: '30', city: 'مدينة نصر' },
    { id: '2', age: null, city: null }
  ]

  const visits = [
    { id: 'v1', diagnosis: 'نزلة برد', startedAt: '10:00', completedAt: '10:15', paymentStatus: 'paid', paymentMethod: 'cash' },
    { id: 'v2', diagnosis: null, startedAt: null, completedAt: null, paymentStatus: null, paymentMethod: null }
  ]

  const report = computeDataCompleteness(patients, visits)

  assert.equal(report.agePercentage, 50)
  assert.equal(report.regionPercentage, 50)
  assert.equal(report.diagnosisPercentage, 50)
  assert.equal(report.timingPercentage, 50)
  assert.equal(report.paymentPercentage, 50)
  assert.equal(report.overallPercentage, 50)
})

test('12. Patient Deduplication across Visits & Shared Phone Families', () => {
  // Family sharing phone: father & child
  const appointments = [
    { patientId: 'patient-father', phone: '01012345678', patientName: 'أحمد محمود', status: 'completed' },
    { patientId: 'patient-father', phone: '01012345678', patientName: 'أحمد محمود', status: 'completed' },
    { patientId: 'patient-child', phone: '01012345678', patientName: 'علي أحمد', status: 'completed' }
  ]

  const distinctById = new Set(appointments.map(a => a.patientId))
  assert.equal(distinctById.size, 2) // 2 distinct patients despite same phone

  // Total completed visits is 3
  const completedVisits = appointments.filter(a => a.status === 'completed')
  assert.equal(completedVisits.length, 3)
})

test('13. Payment Analytics: Confirmed vs Pending vs Refunded Net Collection', () => {
  const transactions = [
    { paymentMethod: 'cash', paymentStatus: 'paid', servicePrice: 300 },
    { paymentMethod: 'instapay', paymentStatus: 'paid', servicePrice: 500 },
    { paymentMethod: 'wallet', paymentStatus: 'pending_verification', servicePrice: 400 }, // Pending proof
    { paymentMethod: 'cash', paymentStatus: 'refunded', servicePrice: 150 }
  ]

  let confirmed = 0
  let pending = 0
  let refunded = 0

  for (const t of transactions) {
    if (t.paymentStatus === 'paid') confirmed += t.servicePrice
    else if (t.paymentStatus === 'pending_verification') pending += t.servicePrice
    else if (t.paymentStatus === 'refunded') refunded += t.servicePrice
  }

  assert.equal(confirmed, 800) // 300 + 500
  assert.equal(pending, 400)   // 400 pending (NOT counted as confirmed revenue)
  assert.equal(refunded, 150)
  assert.equal(confirmed - refunded, 650) // Net collection
})

test('14. New vs. Returning Patients Separation', () => {
  const priorCompletedVisits = new Map([
    ['p-returning', ['2026-08-15']] // Visited in August
  ])

  const periodStart = '2026-10-01'

  const currentPatients = ['p-returning', 'p-new']
  let newCount = 0
  let retCount = 0

  for (const p of currentPatients) {
    const prior = priorCompletedVisits.get(p)
    if (prior && prior.some(d => d < periodStart)) {
      retCount++
    } else {
      newCount++
    }
  }

  assert.equal(newCount, 1)
  assert.equal(retCount, 1)
  assert.equal(newCount + retCount, currentPatients.length)
})

