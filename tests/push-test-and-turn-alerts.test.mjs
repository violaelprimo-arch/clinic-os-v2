import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server.js'
import { POST as testPushPost } from '../src/app/api/push/test/route.ts'
import {
  buildDeviceTestTag,
  buildPushTag,
  dispatchPatientPushNotification,
  executeDeviceTestPush,
  getApproachingEventId,
  getSubscriptionId,
  getTurnReadyEventId,
} from '../src/lib/pushDispatcher.ts'

const VAPID_PUBLIC = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

function createInMemoryPushStore(initialDocs = {}) {
  const docs = new Map(Object.entries(initialDocs))
  return {
    docs,
    readDocument: async (docPath) => docs.get(docPath) ?? null,
    writeDocument: async (docPath, data, merge = false) => {
      const prev = merge ? (docs.get(docPath) ?? {}) : {}
      docs.set(docPath, { ...prev, ...data })
    },
    createDocument: async (collection, data, docId) => {
      const docPath = `${collection}/${docId}`
      if (docs.has(docPath)) throw new Error('RATE_LIMITED')
      docs.set(docPath, { id: docId, ...data })
    },
    queryDocumentsByField: async (collection, field, value) => {
      const results = []
      for (const [key, doc] of docs.entries()) {
        if (!key.startsWith(`${collection}/`)) continue
        if (doc?.[field] === value) {
          results.push({ id: key.slice(collection.length + 1), ...doc })
        }
      }
      return results
    },
    getVapidConfig: () => ({
      publicKey: VAPID_PUBLIC,
      privateKey: 'test-private-key-placeholder-not-real',
      subject: 'mailto:support@yalla-clinic.com',
    }),
  }
}

test('1. /api/push/test has zero TEST_RATE_LIMITED_TRY_AGAIN_IN_ONE_MINUTE and enforces origin + auth', async () => {
  const srcRoot = path.resolve('src')
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8')
        assert.equal(
          text.includes('TEST_RATE_LIMITED_TRY_AGAIN_IN_ONE_MINUTE'),
          false,
          `Unexpected rate-limit error string found in ${full}`,
        )
      }
    }
  }
  walk(srcRoot)

  const crossOrigin = await testPushPost(
    new NextRequest('https://yalla-demo.yalla-clinic.com/api/push/test', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clinicId: 'demo', appointmentId: 'appt1', endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }),
    }),
  )
  assert.equal(crossOrigin.status, 403)
  assert.deepEqual(await crossOrigin.json(), { error: 'INVALID_ORIGIN' })

  const unauthenticated = await testPushPost(
    new NextRequest('https://yalla-demo.yalla-clinic.com/api/push/test', {
      method: 'POST',
      headers: {
        origin: 'https://yalla-demo.yalla-clinic.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clinicId: 'demo', appointmentId: 'appt1', endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }),
    }),
  )
  assert.equal(unauthenticated.status, 403)
  assert.deepEqual(await unauthenticated.json(), { error: 'VERIFIED_DEVICE_REQUIRED' })
})

test('2. Consecutive test pushes dispatch immediately back-to-back with unique <=32-char Topic/tags', async () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/device-consecutive-test'
  const subId = await getSubscriptionId(endpoint)
  let clock = Date.parse('2026-11-11T15:00:00.000Z')
  const store = createInMemoryPushStore({
    [`push_subscriptions/${subId}`]: {
      id: subId,
      clinicId: 'clinic_demo',
      role: 'patient',
      endpoint,
      keys: { p256dh: 'k1', auth: 'a1' },
      vapidPublicKey: VAPID_PUBLIC,
      appointmentIds: ['appt_101'],
      status: 'active',
      lastTestAt: new Date(clock - 1).toISOString(), // 1ms ago: would fail under old 60s limit
    },
  })

  const sent = []
  const deps = {
    ...store,
    now: () => clock,
    sendWebPushNotification: async (sub, payload) => {
      sent.push({ endpoint: sub.endpoint, payload })
      return { success: true, status: 201 }
    },
  }

  const first = await executeDeviceTestPush({
    endpoint,
    clinicId: 'clinic_demo',
    clinicSlug: 'yalla-demo',
    appointmentId: 'appt_101',
    role: 'patient',
  }, deps)
  clock += 1
  const second = await executeDeviceTestPush({
    endpoint,
    clinicId: 'clinic_demo',
    clinicSlug: 'yalla-demo',
    appointmentId: 'appt_101',
    role: 'patient',
  }, deps)

  assert.equal(first.ok, true)
  assert.equal(first.status, 200)
  assert.equal(second.ok, true)
  assert.equal(second.status, 200)
  assert.equal(sent.length, 2)
  assert.notEqual(sent[0].payload.tag, sent[1].payload.tag)
  for (const item of sent) {
    assert.equal(item.payload.type, 'test_notification')
    assert.equal(item.payload.urgency, 'high')
    assert.ok(item.payload.tag.length <= 32, `tag too long: ${item.payload.tag}`)
    assert.match(item.payload.tag, /^[A-Za-z0-9_-]{1,32}$/)
  }

  // Ownership / tenant isolation checks remain enforced
  const wrongAppt = await executeDeviceTestPush({
    endpoint,
    clinicId: 'clinic_demo',
    appointmentId: 'appt_999',
    role: 'patient',
  }, deps)
  assert.equal(wrongAppt.ok, false)
  assert.equal(wrongAppt.status, 403)

  const wrongClinic = await executeDeviceTestPush({
    endpoint,
    clinicId: 'other_clinic',
    appointmentId: 'appt_101',
    role: 'patient',
  }, deps)
  assert.equal(wrongClinic.ok, false)
  assert.equal(wrongClinic.status, 403)

  const wrongVapid = await executeDeviceTestPush({
    endpoint,
    clinicId: 'clinic_demo',
    appointmentId: 'appt_101',
    role: 'patient',
  }, {
    ...deps,
    getVapidConfig: () => ({ publicKey: 'DIFFERENT_KEY', privateKey: 'x', subject: 'mailto:a@b.c' }),
  })
  assert.equal(wrongVapid.ok, false)
  assert.equal(wrongVapid.status, 403)
})

test('3. Rapid test_notification -> approaching_turn -> turn_ready within seconds dispatch independently without Topic collision', async () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/device-rapid-queue'
  const subId = await getSubscriptionId(endpoint)
  const appointmentId = 'clinic_demo_20261111_patient0002'
  let clock = Date.parse('2026-11-11T15:10:00.000Z')
  const store = createInMemoryPushStore({
    [`push_subscriptions/${subId}`]: {
      id: subId,
      clinicId: 'clinic_demo',
      role: 'patient',
      endpoint,
      keys: { p256dh: 'p1', auth: 'a1' },
      vapidPublicKey: VAPID_PUBLIC,
      appointmentIds: [appointmentId],
      status: 'active',
    },
  })

  const sent = []
  const deps = {
    ...store,
    now: () => clock,
    sendWebPushNotification: async (_sub, payload) => {
      sent.push({ at: clock, ...payload, topic: payload.tag.slice(0, 32) })
      return { success: true, status: 201 }
    },
  }

  // T+0s: Immediate test push
  const testRes = await executeDeviceTestPush({
    endpoint, clinicId: 'clinic_demo', clinicSlug: 'yalla-demo', appointmentId, role: 'patient',
  }, deps)
  assert.equal(testRes.ok, true)

  // T+2s: Patient transitions to next in line ("اقترب دورك")
  clock += 2000
  const appt = { id: appointmentId, queue_number: 2 }
  const apprRes = await dispatchPatientPushNotification({
    clinicId: 'clinic_demo',
    appointmentId,
    type: 'approaching_turn',
    title: 'أنت المريض التالي للدخول!',
    body: 'يرجى مراجعة صفحة متابعة الدور.',
    tag: buildPushTag('approaching_turn', appointmentId, '1'),
    eventId: getApproachingEventId(appt, 1),
    urgency: 'high',
    ttl: 300,
  }, deps)
  assert.equal(apprRes.deliveredCount, 1)

  // T+4s: Doctor starts appointment #2 ("دورك الآن")
  clock += 2000
  const calledAt = new Date(clock).toISOString()
  const turnRes = await dispatchPatientPushNotification({
    clinicId: 'clinic_demo',
    appointmentId,
    type: 'turn_ready',
    title: 'حان دورك الآن للدخول!',
    body: 'رقم دورك #2. يرجى التوجه لغرفة الكشف.',
    tag: buildPushTag('turn_ready', appointmentId, '0'),
    eventId: getTurnReadyEventId(appt, 'start', calledAt),
    urgency: 'high',
    ttl: 600,
  }, deps)
  assert.equal(turnRes.deliveredCount, 1)

  assert.equal(sent.length, 3)
  assert.deepEqual(sent.map((x) => x.type), ['test_notification', 'approaching_turn', 'turn_ready'])
  assert.equal(new Set(sent.map((x) => x.topic)).size, 3, 'Each distinct alert must have a unique <=32-char Topic')
  assert.equal(new Set(sent.map((x) => x.tag)).size, 3, 'Each distinct alert must have a unique SW tag')
  for (const item of sent) {
    assert.equal(item.urgency, 'high')
  }
})

test('4. Identical event deduplication blocks concurrent & repeated sends while recall/requeue fire independently', async () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/device-dedup-check'
  const subId = await getSubscriptionId(endpoint)
  const appointmentId = 'clinic_demo_20261111_patient0003'
  const clock = Date.parse('2026-11-11T15:20:00.000Z')
  const store = createInMemoryPushStore({
    [`push_subscriptions/${subId}`]: {
      id: subId,
      clinicId: 'clinic_demo',
      role: 'patient',
      endpoint,
      keys: { p256dh: 'p2', auth: 'a2' },
      vapidPublicKey: VAPID_PUBLIC,
      appointmentIds: [appointmentId],
      status: 'active',
    },
  })

  let signalFirstInFlight
  const firstInFlight = new Promise((resolve) => {
    signalFirstInFlight = resolve
  })
  let releaseFirstSend
  const firstSendStarted = new Promise((resolve) => {
    releaseFirstSend = resolve
  })
  const sent = []
  let callNum = 0
  const deps = {
    ...store,
    now: () => clock,
    sendWebPushNotification: async (_sub, payload) => {
      callNum += 1
      if (callNum === 1) {
        signalFirstInFlight()
        // Hold first request in-flight while concurrent duplicate arrives
        await firstSendStarted
      }
      sent.push(payload)
      return { success: true, status: 201 }
    },
  }

  const appt = { id: appointmentId, queue_number: 3 }
  const eventId = getApproachingEventId(appt, 1)

  // Launch p1 and wait until it marks push_outbox 'processing' & reaches gateway send
  const p1 = dispatchPatientPushNotification({
    clinicId: 'clinic_demo', appointmentId, type: 'approaching_turn',
    title: 'اقترب دورك', body: 'متبقي مريض واحد', eventId, urgency: 'high',
    tag: buildPushTag('approaching_turn', appointmentId, '1'),
  }, deps)
  await firstInFlight

  // While p1 is still in-flight ('processing'), concurrent duplicate p2 must skip immediately
  const r2 = await dispatchPatientPushNotification({
    clinicId: 'clinic_demo', appointmentId, type: 'approaching_turn',
    title: 'اقترب دورك', body: 'متبقي مريض واحد', eventId, urgency: 'high',
    tag: buildPushTag('approaching_turn', appointmentId, '1'),
  }, deps)
  assert.equal(r2.deliveredCount, 0)
  assert.equal(sent.length, 0)

  releaseFirstSend()
  const r1 = await p1
  assert.equal(r1.deliveredCount, 1)
  assert.equal(sent.length, 1, 'Concurrent duplicate must not send a second push')

  // Subsequent duplicate after delivery reports deliveredCount=1 without sending a duplicate push
  const r3 = await dispatchPatientPushNotification({
    clinicId: 'clinic_demo', appointmentId, type: 'approaching_turn',
    title: 'اقترب دورك', body: 'متبقي مريض واحد', eventId, urgency: 'high',
    tag: buildPushTag('approaching_turn', appointmentId, '1'),
  }, deps)
  assert.equal(r3.deliveredCount, 1)
  assert.equal(sent.length, 1)

  // Repeated start for the same turn cycle is also deduplicated, while explicit recall is independent
  const startEventId = getTurnReadyEventId(appt, 'start', '2026-11-11T15:20:05.000Z')
  await dispatchPatientPushNotification({
    clinicId: 'clinic_demo', appointmentId, type: 'turn_ready',
    title: 'دورك الآن', body: 'ادخل الآن', eventId: startEventId, urgency: 'high',
    tag: buildPushTag('turn_ready', appointmentId, '0'),
  }, deps)
  await dispatchPatientPushNotification({
    clinicId: 'clinic_demo', appointmentId, type: 'turn_ready',
    title: 'دورك الآن', body: 'ادخل الآن', eventId: startEventId, urgency: 'high',
    tag: buildPushTag('turn_ready', appointmentId, '0'),
  }, deps)
  assert.equal(sent.length, 2, 'Duplicate start event must send turn_ready only once')

  // Explicit recall produces a fresh eventId and tag -> sends independently
  const recallAt = '2026-11-11T15:20:09.000Z'
  await dispatchPatientPushNotification({
    clinicId: 'clinic_demo', appointmentId, type: 'turn_ready',
    title: 'دورك الآن', body: 'إعادة نداء',
    eventId: getTurnReadyEventId(appt, 'recall', recallAt),
    urgency: 'high',
    tag: buildPushTag('turn_ready', appointmentId, recallAt.replace(/[^0-9]/g, '').slice(-8)),
  }, deps)
  assert.equal(sent.length, 3, 'Explicit recall must dispatch independently')

  // Requeued cycle produces an independent approaching eventId
  const requeuedAppt = { ...appt, requeuedAt: '2026-11-11T15:25:00.000Z' }
  assert.notEqual(getApproachingEventId(requeuedAppt, 1), eventId)
  assert.notEqual(buildDeviceTestTag(), buildDeviceTestTag())
})

test('5. Patient & staff test-push UI guards block concurrent double-click and re-enable immediately in finally', () => {
  const patientUi = fs.readFileSync(
    path.resolve('src/components/clinic/PatientPushNotificationManager.tsx'),
    'utf8',
  )
  const bellUi = fs.readFileSync(
    path.resolve('src/components/clinic/NotificationCenter.tsx'),
    'utf8',
  )
  const pwaClient = fs.readFileSync(path.resolve('src/lib/pwaService.ts'), 'utf8')

  assert.match(patientUi, /testInFlightRef\s*=\s*useRef\(false\)/)
  assert.match(patientUi, /if\s*\(\s*testInFlightRef\.current\s*\|\|\s*testing\s*\|\|\s*loading\s*\)\s*return/)
  assert.match(patientUi, /finally\s*\{\s*testInFlightRef\.current\s*=\s*false[\s;]+setTesting\(false\)/)
  assert.match(patientUi, /disabled=\{testing\s*\|\|\s*loading\}/)
  assert.doesNotMatch(patientUi, /setTimeout\([^)]*setTesting\(false\)/)

  assert.match(bellUi, /testPushInFlightRef\s*=\s*useRef\(false\)/)
  assert.match(bellUi, /if\s*\(\s*testPushInFlightRef\.current\s*\|\|\s*pushBusy\s*\)\s*return/)
  assert.match(bellUi, /finally\s*\{\s*testPushInFlightRef\.current\s*=\s*false[\s;]+setPushBusy\(false\)/)

  assert.match(pwaClient, /credentials:\s*'same-origin'/)
  assert.match(pwaClient, /cache:\s*'no-store'/)
})
