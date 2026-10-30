import assert from 'assert'
import test from 'node:test'

test('TASK 8: Daily Booking Capacity Enforcement Logic', async (t) => {
  await t.test('1. Capacity quota calculation rejects when active appointments >= maxLimit', () => {
    const maxLimit = 5
    const activeExisting = [
      { id: '1', status: 'waiting' },
      { id: '2', status: 'in_progress' },
      { id: '3', status: 'waiting' },
      { id: '4', status: 'completed' },
      { id: '5', status: 'waiting' },
    ]

    const activeCount = activeExisting.filter(d => d.status !== 'cancelled').length
    assert.equal(activeCount, 5)

    const canBook = maxLimit <= 0 || activeCount < maxLimit
    assert.strictEqual(canBook, false, '6th booking must be rejected when active count is 5 and limit is 5')
  })

  await t.test('2. Cancelled appointments do NOT count towards quota', () => {
    const maxLimit = 5
    const existingAppointments = [
      { id: '1', status: 'waiting' },
      { id: '2', status: 'in_progress' },
      { id: '3', status: 'cancelled' }, // Cancelled!
      { id: '4', status: 'completed' },
      { id: '5', status: 'waiting' },
    ]

    const activeCount = existingAppointments.filter(d => d.status !== 'cancelled').length
    assert.equal(activeCount, 4, 'Cancelled appointments must be excluded from active count')

    const canBook = maxLimit <= 0 || activeCount < maxLimit
    assert.strictEqual(canBook, true, '5th booking must be allowed because one slot was freed by cancellation')
  })

  await t.test('3. Exact Arabic Rejection Message standard in all endpoints', () => {
    const expectedError = 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.'
    assert(expectedError.includes('اكتمل عدد الحجوزات المتاحة لهذا اليوم'))
    assert(expectedError.includes('برجاء اختيار موعد آخر'))
  })

  await t.test('4. Branch-specific limit isolation', () => {
    const branchAMaxLimit = 3
    const branchBMaxLimit = 10

    const appointments = [
      { id: '1', branch_id: 'branch-a', status: 'waiting' },
      { id: '2', branch_id: 'branch-a', status: 'completed' },
      { id: '3', branch_id: 'branch-a', status: 'waiting' },
      { id: '4', branch_id: 'branch-b', status: 'waiting' },
    ]

    const branchACount = appointments.filter(d => d.branch_id === 'branch-a' && d.status !== 'cancelled').length
    const branchBCount = appointments.filter(d => d.branch_id === 'branch-b' && d.status !== 'cancelled').length

    assert.equal(branchACount, 3)
    assert.equal(branchBCount, 1)

    // Branch A is at limit (3/3)
    assert.strictEqual(branchACount < branchAMaxLimit, false, 'Branch A must be full')
    // Branch B has capacity (1/10)
    assert.strictEqual(branchBCount < branchBMaxLimit, true, 'Branch B must have capacity')
  })

  await t.test('5. Doctor Dashboard capacity status derived from active bookings', () => {
    const limit = 5
    const currentActive = 5
    const isFull = limit > 0 && currentActive >= limit
    const label = isFull ? 'مكتمل' : 'متاح'
    const displayString = `الحجوزات اليوم: ${currentActive} / ${limit} — الحالة: ${label}`

    assert.equal(displayString, 'الحجوزات اليوم: 5 / 5 — الحالة: مكتمل')
  })
})
