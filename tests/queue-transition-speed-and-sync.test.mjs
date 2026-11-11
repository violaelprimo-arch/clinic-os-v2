import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { executeQueueTransition } from '../src/lib/server/queue-transition.ts'
import {
  computeQueueWatermark,
  mergeQueueWatermark,
  shouldAcceptQueueSnapshot,
} from '../src/lib/queueSync.ts'

function createStatefulMockDeps(options = {}) {
  const pushDelayMs = options.pushDelayMs ?? 0
  const commitDelayMs = options.commitDelayMs ?? 0
  const notifDelayMs = options.notifDelayMs ?? 0
  const failPush = Boolean(options.failPush)
  const failCommit = Boolean(options.failCommit)

  const clinicDoc = {
    id: 'clinic_demo',
    slug: 'yalla-demo',
    clinicName: 'Yalla Demo Clinic',
    queueMode: 'fifo',
  }

  const appointments = new Map([
    ['appt_1', { id: 'appt_1', clinic_id: 'clinic_demo', branch_id: 'br_1', date: '2026-11-11', queue_number: 1, patientName: 'المريض الأول', phone: '01011111111', status: 'waiting', paymentStatus: 'paid', createdAt: '2026-11-11T08:00:00.000Z' }],
    ['appt_2', { id: 'appt_2', clinic_id: 'clinic_demo', branch_id: 'br_1', date: '2026-11-11', queue_number: 2, patientName: 'المريض الثاني', phone: '01022222222', status: 'waiting', paymentStatus: 'paid', createdAt: '2026-11-11T08:05:00.000Z' }],
    ['appt_3', { id: 'appt_3', clinic_id: 'clinic_demo', branch_id: 'br_1', date: '2026-11-11', queue_number: 3, patientName: 'المريض الثالث', phone: '01033333333', status: 'waiting', paymentStatus: 'paid', createdAt: '2026-11-11T08:10:00.000Z' }],
    ['appt_4', { id: 'appt_4', clinic_id: 'clinic_demo', branch_id: 'br_1', date: '2026-11-11', queue_number: 4, patientName: 'المريض الرابع', phone: '01044444444', status: 'waiting', paymentStatus: 'paid', createdAt: '2026-11-11T08:15:00.000Z' }],
    ['appt_other_branch', { id: 'appt_other_branch', clinic_id: 'clinic_demo', branch_id: 'br_2', date: '2026-11-11', queue_number: 1, patientName: 'فرع آخر', phone: '01055555555', status: 'waiting', paymentStatus: 'paid', createdAt: '2026-11-11T08:20:00.000Z' }],
  ])

  const backgroundPromises = []
  const sentPushes = []
  const sentNotifs = []
  let tickMs = Date.parse('2026-11-11T10:00:00.000Z')

  const deps = {
    now: () => {
      tickMs += 100
      return tickMs
    },
    getToday: () => '2026-11-11',
    waitUntil: (p) => {
      backgroundPromises.push(p)
    },
    readDocument: async (path) => {
      if (path === `clinics/${clinicDoc.id}`) return { ...clinicDoc }
      if (path.startsWith('appointments/')) {
        const id = path.slice('appointments/'.length)
        const doc = appointments.get(id)
        return doc ? { ...doc } : null
      }
      return null
    },
    queryDocumentsByFields: async (collection, filters) => {
      if (collection !== 'appointments') return []
      return Array.from(appointments.values())
        .filter((a) => (!filters.clinic_id || a.clinic_id === filters.clinic_id) && (!filters.date || a.date === filters.date))
        .map((a) => ({ ...a }))
    },
    commitDocumentPatches: async (patches) => {
      if (commitDelayMs > 0) await new Promise((r) => setTimeout(r, commitDelayMs))
      if (failCommit) throw new Error('FIRESTORE_COMMIT_FAILED')
      for (const patch of patches) {
        const id = patch.path.split('/').pop()
        const existing = appointments.get(id) || {}
        appointments.set(id, { ...existing, ...patch.data })
      }
    },
    createServerNotification: async (payload) => {
      if (notifDelayMs > 0) await new Promise((r) => setTimeout(r, notifDelayMs))
      if (failPush) throw new Error('NOTIFICATION_WRITE_FAILED')
      sentNotifs.push(payload)
      return { id: `notif_${sentNotifs.length}` }
    },
    dispatchPatientPushNotification: async (payload) => {
      if (pushDelayMs > 0) await new Promise((r) => setTimeout(r, pushDelayMs))
      if (failPush) throw new Error('PUSH_GATEWAY_TIMEOUT')
      sentPushes.push(payload)
      return { deliveredCount: 1, failedCount: 0 }
    },
  }

  return { deps, appointments, backgroundPromises, sentPushes, sentNotifs }
}

test('1. HTTP transition returns updated appointments immediately without waiting for slow 1500ms Push gateway', async () => {
  const { deps, backgroundPromises, sentPushes, sentNotifs } = createStatefulMockDeps({
    commitDelayMs: 25,
    pushDelayMs: 1500,
    notifDelayMs: 300,
  })

  const startedAt = Date.now()
  const res = await executeQueueTransition(
    {
      slug: 'yalla-demo',
      staff: { clinicId: 'clinic_demo', user: { role: 'doctor' } },
      appointmentId: 'appt_1',
      action: 'start',
    },
    deps,
  )
  const httpElapsedMs = Date.now() - startedAt

  assert.equal(res.ok, true)
  assert.equal(res.status, 200)
  assert.ok(httpElapsedMs < 250, `Expected immediate return < 250ms, got ${httpElapsedMs}ms`)

  // Authoritative state is immediately returned to caller before push completes
  const updated1 = res.body.appointments.find((a) => a.id === 'appt_1')
  assert.equal(updated1.status, 'in_progress')
  assert.ok(updated1.updatedAt)
  assert.ok(res.body.queueWatermark)
  assert.ok(res.body.queueWatermark.maxModifiedMs > 0)

  // Background push was scheduled cleanly on waitUntil and is still running after HTTP returned
  assert.equal(backgroundPromises.length, 1)
  assert.equal(sentPushes.length, 0, 'Push must not block the HTTP mutation response')

  await Promise.all(backgroundPromises)
  assert.ok(sentPushes.some((p) => p.type === 'turn_ready' && p.appointmentId === 'appt_1'))
  assert.ok(sentPushes.some((p) => p.type === 'approaching_turn' && p.appointmentId === 'appt_2'))
  assert.ok(sentNotifs.length >= 2)
})

test('2. Slow or failing Push gateway never breaks or delays confirmed queue transition', async () => {
  const { deps, appointments, backgroundPromises } = createStatefulMockDeps({
    pushDelayMs: 200,
    failPush: true,
  })

  const res = await executeQueueTransition(
    {
      slug: 'yalla-demo',
      staff: { clinicId: 'clinic_demo', user: { role: 'doctor' } },
      appointmentId: 'appt_1',
      action: 'start',
    },
    deps,
  )

  assert.equal(res.ok, true)
  assert.equal(appointments.get('appt_1').status, 'in_progress')
  assert.equal(backgroundPromises.length, 1)
  // Background Promise.allSettled must resolve cleanly without throwing unhandled rejection
  await assert.doesNotReject(() => Promise.all(backgroundPromises))
})

test('3. Failed Firestore commit preserves state and never dispatches phantom Push alerts', async () => {
  const { deps, appointments, backgroundPromises } = createStatefulMockDeps({
    failCommit: true,
  })

  await assert.rejects(
    () =>
      executeQueueTransition(
        {
          slug: 'yalla-demo',
          staff: { clinicId: 'clinic_demo', user: { role: 'doctor' } },
          appointmentId: 'appt_1',
          action: 'start',
        },
        deps,
      ),
    /FIRESTORE_COMMIT_FAILED/,
  )

  assert.equal(appointments.get('appt_1').status, 'waiting')
  assert.equal(backgroundPromises.length, 0)
})

test('4. Rapid consecutive workflow (start -> complete -> start -> skip -> recall -> requeue -> no_show) and branch RBAC', async () => {
  const { deps, appointments } = createStatefulMockDeps()
  const doctor = { clinicId: 'clinic_demo', user: { role: 'doctor' } }

  // 1) Start P1
  const s1 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_1', action: 'start' }, deps)
  assert.equal(s1.ok, true)
  assert.equal(s1.body.appointments.find((a) => a.id === 'appt_1').status, 'in_progress')

  // 2) Immediately complete P1 -> next transition allowed immediately
  const c1 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_1', action: 'complete' }, deps)
  assert.equal(c1.ok, true)
  assert.equal(c1.body.appointments.find((a) => a.id === 'appt_1').status, 'completed')

  // Reject invalid duplicate complete on completed appointment
  const c1Again = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_1', action: 'complete' }, deps)
  assert.equal(c1Again.ok, false)
  assert.equal(c1Again.status, 409)

  // 3) Start P2
  const s2 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_2', action: 'start' }, deps)
  assert.equal(s2.ok, true)
  assert.equal(s2.body.appointments.find((a) => a.id === 'appt_2').status, 'in_progress')

  // 4) Skip P2 -> marks P2 skipped & auto-calls P3
  const skip2 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_2', action: 'skip' }, deps)
  assert.equal(skip2.ok, true)
  assert.equal(skip2.body.calledId, 'appt_3')
  assert.equal(appointments.get('appt_2').status, 'skipped')
  assert.equal(appointments.get('appt_3').status, 'in_progress')

  // 5) Recall P3
  const rec3 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_3', action: 'recall' }, deps)
  assert.equal(rec3.ok, true)
  assert.equal(rec3.body.calledId, 'appt_3')

  // 6) Requeue skipped P2 -> back to waiting with priorityNext
  const req2 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_2', action: 'requeue' }, deps)
  assert.equal(req2.ok, true)
  assert.equal(appointments.get('appt_2').status, 'waiting')
  assert.equal(appointments.get('appt_2').priorityNext, true)

  // 7) No-show P4
  const ns4 = await executeQueueTransition({ slug: 'yalla-demo', staff: doctor, appointmentId: 'appt_4', action: 'no_show' }, deps)
  assert.equal(ns4.ok, true)
  assert.equal(appointments.get('appt_4').status, 'no_show')

  // 8) Branch RBAC: assistant from br_1 cannot mutate br_2
  const assistantDenied = await executeQueueTransition(
    {
      slug: 'yalla-demo',
      staff: { clinicId: 'clinic_demo', user: { role: 'assistant', branchId: 'br_1' } },
      appointmentId: 'appt_other_branch',
      action: 'start',
    },
    deps,
  )
  assert.equal(assistantDenied.ok, false)
  assert.equal(assistantDenied.status, 403)
  assert.equal(assistantDenied.error, 'BRANCH_ACCESS_DENIED')
})

test('5. Monotonic QueueWatermark blocks out-of-order and pre-mutation poll responses while accepting newer device updates', () => {
  const t10 = Date.parse('2026-11-11T10:00:10.000Z')
  const t12 = Date.parse('2026-11-11T10:00:12.000Z')
  const t15 = Date.parse('2026-11-11T10:00:15.000Z')

  // Mutation committed at t12
  let current = computeQueueWatermark(
    [{ id: 'a1', status: 'in_progress', updatedAt: new Date(t12).toISOString() }],
    t12,
    t12,
  )
  current = mergeQueueWatermark(current, current, { isMutation: true })

  // Pre-mutation slow poll started at t10 carrying old state at t10 -> MUST REJECT
  const preMutationPoll = computeQueueWatermark(
    [{ id: 'a1', status: 'waiting', updatedAt: new Date(t10).toISOString() }],
    t10,
  )
  assert.equal(shouldAcceptQueueSnapshot(current, preMutationPoll, { reqSeq: 3, lastAcceptedSeq: 2 }), false)

  // Older request sequence returning late -> MUST REJECT even with same timestamp
  assert.equal(shouldAcceptQueueSnapshot(current, current, { reqSeq: 1, lastAcceptedSeq: 2 }), false)

  // Another device commits an update at t15 -> MUST ACCEPT
  const newerDevicePoll = computeQueueWatermark(
    [{ id: 'a1', status: 'completed', updatedAt: new Date(t15).toISOString() }],
    t15,
  )
  assert.equal(shouldAcceptQueueSnapshot(current, newerDevicePoll, { reqSeq: 4, lastAcceptedSeq: 2 }), true)
})

test('6. Live sync contracts: no-store cache headers, no TV 15s hold timer, push timeout, and instant UI wiring', () => {
  const queueRoute = fs.readFileSync('src/app/api/clinic/[slug]/queue/route.ts', 'utf8')
  const dayRoute = fs.readFileSync('src/app/api/clinic/[slug]/appointments/day/route.ts', 'utf8')
  const transitionRoute = fs.readFileSync('src/app/api/clinic/[slug]/appointments/transition/route.ts', 'utf8')
  const paymentConfirmRoute = fs.readFileSync('src/app/api/clinic/[slug]/payments/confirm/route.ts', 'utf8')
  const webPush = fs.readFileSync('src/lib/webPushServer.ts', 'utf8')
  const adminDashboard = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8')
  const tvClient = fs.readFileSync('src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx', 'utf8')
  const trackAppt = fs.readFileSync('src/app/clinic/[slug]/track/[appointmentId]/page.tsx', 'utf8')
  const trackPhone = fs.readFileSync('src/app/clinic/[slug]/track/page.tsx', 'utf8')
  const notifCenter = fs.readFileSync('src/components/clinic/NotificationCenter.tsx', 'utf8')

  for (const [name, src] of [
    ['queueRoute', queueRoute],
    ['dayRoute', dayRoute],
    ['transitionRoute', transitionRoute],
    ['paymentConfirmRoute', paymentConfirmRoute],
  ]) {
    assert.match(src, /dynamic\s*=\s*['"]force-dynamic['"]/, `${name} must force dynamic`)
    assert.match(src, /no-store/, `${name} must disable HTTP caching`)
  }

  assert.match(webPush, /AbortSignal\.timeout\(8000\)/)
  assert.match(paymentConfirmRoute, /getCurrentClinicStaff/)
  assert.match(paymentConfirmRoute, /scheduleBackgroundTask/)

  assert.match(adminDashboard, /applyAppointmentsWithWatermark/)
  assert.match(adminDashboard, /transitionLockRef/)
  assert.match(adminDashboard, /handleNoShow\(b\.id\)/)
  assert.match(adminDashboard, /publishClinicQueueSignal/)

  assert.doesNotMatch(tvClient, /heldUntilRef/)
  assert.doesNotMatch(tvClient, /setLastCalledPatient/)
  assert.match(tvClient, /subscribeClinicQueueSignal/)
  assert.match(tvClient, /shouldAcceptQueueSnapshot/)

  assert.match(trackAppt, /subscribeClinicQueueSignal/)
  assert.match(trackAppt, /shouldAcceptQueueSnapshot/)
  assert.match(trackPhone, /subscribeClinicQueueSignal/)
  assert.match(trackPhone, /shouldAcceptQueueSnapshot/)
  assert.match(notifCenter, /subscribeClinicQueueSignal/)
})
