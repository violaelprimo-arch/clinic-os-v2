import { test } from 'node:test'
import assert from 'node:assert/strict'

// 1. Cairo Timezone Date Resolution Helper Test
function toCairoDateInfo(dateInput) {
  const AR_DAYS_MAP = {
    Saturday: 'السبت',
    Sunday: 'الأحد',
    Monday: 'الاثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
    Friday: 'الجمعة'
  }

  if (!dateInput) {
    const now = new Date()
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now)
    const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(now)
    return { dateStr, dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
  }

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number)
    const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(anchor)
    return { dateStr: dateInput.trim(), dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
  }

  const d = new Date(dateInput)
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d)
  const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(d)
  return { dateStr, dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
}

// 2. Financial Aggregator Engine Test
function computeFinancialMetrics({ appointments, fromDate, toDate, branchId }) {
  const WEEK_DAY_KEYS = [
    'Saturday',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday'
  ]
  const AR_DAYS_MAP = {
    Saturday: 'السبت',
    Sunday: 'الأحد',
    Monday: 'الاثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
    Friday: 'الجمعة'
  }

  const branchFiltered = appointments.filter((item) => {
    if (!branchId || branchId === 'all') return true
    const bId = item.branch_id || item.branchId
    if (bId) return bId === branchId
    return branchId === 'main'
  })

  const filtered = branchFiltered.filter((item) => {
    if (item.status === 'cancelled') return false
    const salesDateInfo = toCairoDateInfo(item.date || item.createdAt)
    const itemDate = salesDateInfo.dateStr
    if (fromDate && itemDate < fromDate) return false
    if (toDate && itemDate > toDate) return false
    return true
  })

  let totalRevenue = 0
  let collected = 0
  let due = 0
  let totalDiscounts = 0

  const paymentMethodsMap = {
    cash: { amount: 0, count: 0 },
    instapay: { amount: 0, count: 0 },
    wallet: { amount: 0, count: 0 },
    card: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 }
  }

  const weeklyMap = {}
  WEEK_DAY_KEYS.forEach((k) => {
    weeklyMap[k] = { revenue: 0, collected: 0, count: 0 }
  })

  const timelineMap = {}

  filtered.forEach((appt) => {
    const origPrice = Number(appt.originalPrice || appt.servicePrice) || 0
    const price = Number(appt.servicePrice) || origPrice
    const disc = Number(appt.discountApplied ?? appt.discount?.amount ?? 0) || (origPrice > price ? origPrice - price : 0)

    // Strict accounting rule:
    // Only paymentStatus === 'paid' is collected!
    // Completed status does NOT mean paid!
    // Pending transfer does NOT mean paid!
    const isPaid = appt.paymentStatus === 'paid'
    const effectiveCollected = isPaid ? (Number(appt.collectedAmount ?? price) || price) : 0

    totalRevenue += origPrice
    totalDiscounts += disc

    if (isPaid) {
      collected += effectiveCollected
    } else {
      due += (origPrice - disc)
    }

    const rawMethod = String(appt.paymentMethod || 'cash').trim().toLowerCase()
    let normMethod = 'other'
    if (rawMethod === 'cash' || rawMethod === 'كاش') normMethod = 'cash'
    else if (rawMethod === 'instapay' || rawMethod === 'انستاباي' || rawMethod === 'إنستاباي') normMethod = 'instapay'
    else if (rawMethod === 'wallet' || rawMethod === 'محفظة' || rawMethod === 'فودافون كاش') normMethod = 'wallet'
    else if (rawMethod === 'card' || rawMethod === 'credit' || rawMethod === 'visa' || rawMethod === 'فيزا') normMethod = 'card'

    if (isPaid) {
      paymentMethodsMap[normMethod].amount += effectiveCollected
      paymentMethodsMap[normMethod].count += 1
    }

    const salesDateInfo = toCairoDateInfo(appt.date || appt.createdAt)
    const dayKey = salesDateInfo.dayKey
    const dateStr = salesDateInfo.dateStr

    if (weeklyMap[dayKey]) {
      weeklyMap[dayKey].revenue += origPrice
      weeklyMap[dayKey].count += 1
      if (isPaid) {
        weeklyMap[dayKey].collected += effectiveCollected
      }
    }

    if (!timelineMap[dateStr]) {
      timelineMap[dateStr] = {
        date: dateStr,
        day: salesDateInfo.arDay,
        revenue: 0,
        collected: 0,
        count: 0
      }
    }
    timelineMap[dateStr].revenue += origPrice
    timelineMap[dateStr].count += 1
    if (isPaid) {
      timelineMap[dateStr].collected += effectiveCollected
    }
  })

  const weekly = WEEK_DAY_KEYS.map((k) => ({
    key: k,
    day: AR_DAYS_MAP[k] || k,
    revenue: weeklyMap[k].revenue,
    collected: weeklyMap[k].collected,
    count: weeklyMap[k].count
  }))

  const timeline = Object.keys(timelineMap).sort().map((d) => timelineMap[d])

  return {
    totalRevenue,
    collected,
    due,
    totalDiscounts,
    appointmentsCount: filtered.length,
    weekly,
    timeline,
    paymentMethods: paymentMethodsMap
  }
}

test('1. Three paid transactions of 250 EGP across 2 days sum to 750 on cards and chart points', () => {
  const mockAppointments = [
    { id: '1', date: '2026-11-04', servicePrice: 250, paymentStatus: 'paid', paymentMethod: 'cash' },
    { id: '2', date: '2026-11-04', servicePrice: 250, paymentStatus: 'paid', paymentMethod: 'instapay' },
    { id: '3', date: '2026-11-05', servicePrice: 250, paymentStatus: 'paid', paymentMethod: 'wallet' }
  ]

  const metrics = computeFinancialMetrics({
    appointments: mockAppointments,
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    branchId: 'all'
  })

  // Summary Card Totals
  assert.equal(metrics.totalRevenue, 750)
  assert.equal(metrics.collected, 750)
  assert.equal(metrics.due, 0)
  assert.equal(metrics.appointmentsCount, 3)

  // Chart Sum Invariant: sum of weekly chart points MUST equal summary card
  const weeklySumCollected = metrics.weekly.reduce((sum, item) => sum + item.collected, 0)
  const weeklySumRevenue = metrics.weekly.reduce((sum, item) => sum + item.revenue, 0)
  assert.equal(weeklySumCollected, 750)
  assert.equal(weeklySumRevenue, 750)

  // Chart Sum Invariant: sum of timeline chart points MUST equal summary card
  const timelineSumCollected = metrics.timeline.reduce((sum, item) => sum + item.collected, 0)
  const timelineSumRevenue = metrics.timeline.reduce((sum, item) => sum + item.revenue, 0)
  assert.equal(timelineSumCollected, 750)
  assert.equal(timelineSumRevenue, 750)

  // Payment methods breakdown
  assert.equal(metrics.paymentMethods.cash.amount, 250)
  assert.equal(metrics.paymentMethods.instapay.amount, 250)
  assert.equal(metrics.paymentMethods.wallet.amount, 250)
})

test('2. Completed status without paid paymentStatus does NOT enter collected; pending transfer is due', () => {
  const mockAppointments = [
    { id: '1', date: '2026-11-05', servicePrice: 300, status: 'completed', paymentStatus: 'unpaid', paymentMethod: 'cash' },
    { id: '2', date: '2026-11-05', servicePrice: 400, status: 'in_progress', paymentStatus: 'pending', paymentMethod: 'instapay' },
    { id: '3', date: '2026-11-05', servicePrice: 200, status: 'completed', paymentStatus: 'paid', paymentMethod: 'wallet' }
  ]

  const metrics = computeFinancialMetrics({
    appointments: mockAppointments,
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    branchId: 'all'
  })

  assert.equal(metrics.totalRevenue, 900)
  assert.equal(metrics.collected, 200) // ONLY the paid one is collected
  assert.equal(metrics.due, 700) // 300 + 400
})

test('3. Cairo Timezone midnight boundary evaluates correctly without date drift', () => {
  // 2026-11-04 23:59:00 Cairo time is 2026-11-04T21:59:00.000Z
  const lateNightUtc = '2026-11-04T21:59:00.000Z'
  const cairoLateNight = toCairoDateInfo(lateNightUtc)
  assert.equal(cairoLateNight.dateStr, '2026-11-04')
  assert.equal(cairoLateNight.arDay, 'الأربعاء')

  // 2026-11-05 00:05:00 Cairo time is 2026-11-04T22:05:00.000Z
  const justAfterMidnightUtc = '2026-11-04T22:05:00.000Z'
  const cairoMidnight = toCairoDateInfo(justAfterMidnightUtc)
  assert.equal(cairoMidnight.dateStr, '2026-11-05')
  assert.equal(cairoMidnight.arDay, 'الخميس')
})

test('4. Empty period returns all 7 days with zero values without throwing errors', () => {
  const metrics = computeFinancialMetrics({
    appointments: [],
    fromDate: '2026-12-01',
    toDate: '2026-12-31',
    branchId: 'all'
  })

  assert.equal(metrics.totalRevenue, 0)
  assert.equal(metrics.collected, 0)
  assert.equal(metrics.due, 0)
  assert.equal(metrics.weekly.length, 7)
  metrics.weekly.forEach((day) => {
    assert.equal(day.revenue, 0)
    assert.equal(day.collected, 0)
  })
})

test('5. Multi-branch isolation filters metrics according to branchId', () => {
  const mockAppointments = [
    { id: '1', date: '2026-11-05', servicePrice: 200, paymentStatus: 'paid', branch_id: 'branch_a' },
    { id: '2', date: '2026-11-05', servicePrice: 350, paymentStatus: 'paid', branch_id: 'branch_b' },
    { id: '3', date: '2026-11-05', servicePrice: 150, paymentStatus: 'paid', branch_id: 'branch_a' }
  ]

  const metricsA = computeFinancialMetrics({
    appointments: mockAppointments,
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    branchId: 'branch_a'
  })
  assert.equal(metricsA.totalRevenue, 350)
  assert.equal(metricsA.collected, 350)
  assert.equal(metricsA.appointmentsCount, 2)

  const metricsB = computeFinancialMetrics({
    appointments: mockAppointments,
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    branchId: 'branch_b'
  })
  assert.equal(metricsB.totalRevenue, 350)
  assert.equal(metricsB.collected, 350)
  assert.equal(metricsB.appointmentsCount, 1)
})
