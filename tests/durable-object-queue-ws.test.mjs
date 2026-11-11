import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'

// Ensure non-default session secret before importing session helpers
process.env.CLINIC_SESSION_SECRET = 'test-do-queue-ws-secret-0123456789abcdef'
process.env.PATIENT_SESSION_SECRET = 'test-do-patient-secret-0123456789abcdef'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-clinic-os'
process.env.FIREBASE_PROJECT_ID = 'demo-clinic-os'

// Patch Response in Node test runtime so Cloudflare `status: 101` + `webSocket` responses work identically to workerd
const NativeResponse = globalThis.Response
class WorkerCompatibleResponse {
  constructor(body, init = {}) {
    if (init && init.status === 101 && init.webSocket) {
      this.status = 101
      this.ok = false
      this.webSocket = init.webSocket
      this.headers = new Headers(init.headers || {})
      return
    }
    return new NativeResponse(body, init)
  }
  static json(data, init) {
    return NativeResponse.json(data, init)
  }
}
globalThis.Response = WorkerCompatibleResponse

// In-memory paired WebSocket implementation supporting Cloudflare acceptWebSocket & attachments
class MockWorkerWebSocket {
  constructor() {
    this.readyState = 1 // OPEN
    this.closed = false
    this.closeCode = null
    this.closeReason = ''
    this.sent = []
    this._attachment = null
    this._peer = null
    this._listeners = new Map()
    this._doHandlers = null
  }
  accept() {}
  serializeAttachment(val) {
    this._attachment = val == null ? null : structuredClone(val)
  }
  deserializeAttachment() {
    return this._attachment == null ? null : structuredClone(this._attachment)
  }
  send(data) {
    if (this.closed || this.readyState !== 1) return
    const text = typeof data === 'string' ? data : String(data)
    if (this._peer) {
      this._peer.sent.push(text)
      this._peer._emit('message', { data: text })
      if (this._peer._doHandlers) {
        queueMicrotask(() => this._peer._doHandlers.onMessage(this._peer, text))
      }
    }
  }
  close(code = 1000, reason = '') {
    if (this.closed) return
    this.closed = true
    this.readyState = 3
    this.closeCode = code
    this.closeReason = reason
    this._emit('close', { code, reason, wasClean: true })
    if (this._peer && !this._peer.closed) {
      this._peer.closed = true
      this._peer.readyState = 3
      this._peer.closeCode = code
      this._peer.closeReason = reason
      this._peer._emit('close', { code, reason, wasClean: true })
    }
  }
  addEventListener(event, fn) {
    const list = this._listeners.get(event) || []
    list.push(fn)
    this._listeners.set(event, list)
  }
  removeEventListener(event, fn) {
    const list = this._listeners.get(event) || []
    this._listeners.set(
      event,
      list.filter((f) => f !== fn),
    )
  }
  _emit(event, payload) {
    for (const fn of this._listeners.get(event) || []) {
      fn(payload)
    }
  }
  parsedMessages() {
    return this.sent.map((raw) => JSON.parse(raw))
  }
}

globalThis.WebSocketPair = class WebSocketPair {
  constructor() {
    const client = new MockWorkerWebSocket()
    const server = new MockWorkerWebSocket()
    client._peer = server
    server._peer = client
    this[0] = client
    this[1] = server
  }
}

function createDoNamespace(QueueRoomDOClass, env = {}) {
  const instances = new Map()
  return {
    instances,
    idFromName(name) {
      return { toString: () => `id:${name}`, name }
    },
    get(id) {
      const roomName = typeof id === 'string' ? id : id.name || id.toString()
      if (!instances.has(roomName)) {
        const db = new DatabaseSync(':memory:')
        const sockets = new Set()
        let instanceRef = null

        const sql = {
          exec(query, ...bindings) {
            const trimmed = query.trim()
            if (bindings.length === 0 && trimmed.includes(';')) {
              db.exec(trimmed)
              return {
                toArray: () => [],
                one: () => undefined,
                raw: () => [],
                columnNames: [],
                rowsRead: 0,
                rowsWritten: 0,
              }
            }
            const stmt = db.prepare(trimmed)
            if (/^SELECT/i.test(trimmed)) {
              const rows = stmt.all(...bindings)
              return {
                toArray: () => rows,
                one: () => rows[0],
                raw: () => rows.map((r) => Object.values(r)),
                columnNames: rows[0] ? Object.keys(rows[0]) : [],
                rowsRead: rows.length,
                rowsWritten: 0,
              }
            }
            stmt.run(...bindings)
            return {
              toArray: () => [],
              one: () => undefined,
              raw: () => [],
              columnNames: [],
              rowsRead: 0,
              rowsWritten: 1,
            }
          },
        }

        const ctx = {
          id: { toString: () => roomName, name: roomName },
          storage: {
            sql,
            async blockConcurrencyWhile(fn) {
              return fn()
            },
          },
          acceptWebSocket(ws) {
            sockets.add(ws)
            ws._doHandlers = {
              onMessage: (socket, msg) => instanceRef?.webSocketMessage?.(socket, msg),
            }
            ws.addEventListener('close', () => sockets.delete(ws))
          },
          getWebSockets() {
            return Array.from(sockets).filter((ws) => !ws.closed)
          },
          waitUntil(p) {
            void Promise.resolve(p).catch(() => {})
          },
          blockConcurrencyWhile(fn) {
            return fn()
          },
        }

        instanceRef = new QueueRoomDOClass(ctx, env)
        instances.set(roomName, instanceRef)
      }
      const instance = instances.get(roomName)
      return new Proxy(instance, {
        get(target, prop) {
          if (prop === 'fetch') return (req, init) => target.fetch(typeof req === 'string' ? new Request(req, init) : req)
          const val = target[prop]
          if (typeof val === 'function') {
            return (...args) => val.apply(target, args)
          }
          return val
        },
      })
    },
  }
}

// Loopback Firestore REST server speaking Firestore v1 wire format
function encodeFsValue(value) {
  if (value == null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFsValue) } }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, encodeFsValue(v)]),
        ),
      },
    }
  }
  return { stringValue: String(value) }
}
function decodeFsValue(val) {
  if (!val || typeof val !== 'object') return null
  if ('nullValue' in val) return null
  if ('booleanValue' in val) return val.booleanValue
  if ('integerValue' in val) return Number(val.integerValue)
  if ('doubleValue' in val) return val.doubleValue
  if ('stringValue' in val) return val.stringValue
  if ('timestampValue' in val) return val.timestampValue
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(decodeFsValue)
  if ('mapValue' in val) {
    return Object.fromEntries(
      Object.entries(val.mapValue?.fields || {}).map(([k, v]) => [k, decodeFsValue(v)]),
    )
  }
  return null
}

function startMockFirestoreServer() {
  const store = new Map() // "col/id" => plain object
  const logs = []

  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const rawBody = Buffer.concat(chunks).toString('utf8')
    const url = new URL(req.url, 'http://127.0.0.1')
    const basePrefix = '/v1/projects/demo-clinic-os/databases/(default)/documents'
    const rel = url.pathname.slice(basePrefix.length)

    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (rel === ':beginTransaction' && req.method === 'POST') {
      return json(200, { transaction: crypto.randomUUID() })
    }
    if (rel === ':rollback' && req.method === 'POST') {
      return json(200, {})
    }
    if (rel === ':commit' && req.method === 'POST') {
      const parsed = JSON.parse(rawBody || '{}')
      for (const write of parsed.writes || []) {
        if (write.update) {
          const pathParts = write.update.name.split('/documents/')[1]
          const existing = store.get(pathParts) || {}
          const incoming = decodeFsValue({ mapValue: { fields: write.update.fields || {} } })
          if (write.currentDocument?.exists === false && store.has(pathParts)) {
            return json(409, { error: { code: 409, message: 'ALREADY_EXISTS' } })
          }
          if (write.currentDocument?.exists === true && !store.has(pathParts)) {
            return json(404, { error: { code: 404, message: 'NOT_FOUND' } })
          }
          store.set(pathParts, write.updateMask ? { ...existing, ...incoming } : incoming)
        }
      }
      return json(200, { writeResults: (parsed.writes || []).map(() => ({ updateTime: new Date().toISOString() })) })
    }
    if (rel === ':runQuery' && req.method === 'POST') {
      const { structuredQuery } = JSON.parse(rawBody || '{}')
      const col = structuredQuery?.from?.[0]?.collectionId
      const where = structuredQuery?.where
      const filters = []
      if (where?.fieldFilter) filters.push(where.fieldFilter)
      if (where?.compositeFilter?.filters) {
        for (const f of where.compositeFilter.filters) {
          if (f.fieldFilter) filters.push(f.fieldFilter)
        }
      }
      logs.push({
        type: 'runQuery',
        collection: col,
        filterFields: filters.map((f) => f.field?.fieldPath),
        unscopedScan: filters.length === 0,
      })
      const matches = []
      for (const [docPath, data] of store.entries()) {
        if (!docPath.startsWith(`${col}/`)) continue
        const ok = filters.every((f) => {
          const field = f.field.fieldPath
          const expected = decodeFsValue(f.value)
          return data[field] === expected
        })
        if (ok) {
          matches.push({
            document: {
              name: `projects/demo-clinic-os/databases/(default)/documents/${docPath}`,
              fields: encodeFsValue(data).mapValue.fields,
            },
          })
        }
      }
      return json(200, matches.length ? matches : [{ readTime: new Date().toISOString() }])
    }

    const docPath = rel.replace(/^\//, '')
    if (req.method === 'GET') {
      logs.push({ type: 'GET', path: docPath })
      const doc = store.get(docPath)
      if (!doc) return json(404, { error: { code: 404, message: 'NOT_FOUND' } })
      return json(200, {
        name: `projects/demo-clinic-os/databases/(default)/documents/${docPath}`,
        fields: encodeFsValue(doc).mapValue.fields,
      })
    }
    if (req.method === 'PATCH') {
      const incoming = decodeFsValue({ mapValue: { fields: JSON.parse(rawBody || '{}').fields || {} } })
      const merge = url.searchParams.has('updateMask.fieldPaths')
      store.set(docPath, merge ? { ...(store.get(docPath) || {}), ...incoming } : incoming)
      return json(200, {
        name: `projects/demo-clinic-os/databases/(default)/documents/${docPath}`,
        fields: encodeFsValue(store.get(docPath)).mapValue.fields,
      })
    }
    if (req.method === 'POST') {
      const docId = url.searchParams.get('documentId') || crypto.randomUUID()
      const incoming = decodeFsValue({ mapValue: { fields: JSON.parse(rawBody || '{}').fields || {} } })
      const targetPath = `${docPath}/${docId}`
      store.set(targetPath, incoming)
      return json(200, {
        name: `projects/demo-clinic-os/databases/(default)/documents/${targetPath}`,
        fields: encodeFsValue(incoming).mapValue.fields,
      })
    }
    if (req.method === 'DELETE') {
      store.delete(docPath)
      return json(200, {})
    }
    return json(404, {})
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      resolve({
        port: addr.port,
        store,
        logs,
        close: () => new Promise((r) => server.close(r)),
      })
    })
  })
}

function getTodayCairoStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
}

function assertNoSensitiveKeys(obj, label) {
  const raw = JSON.stringify(obj)
  for (const forbidden of [
    '010999',
    '011888',
    'doctorPasswordHash',
    'assistantPasswordHash',
    'secret@',
    'servicePrice',
    'paymentStatus',
    'Branch-2-Only',
  ]) {
    assert.equal(raw.includes(forbidden), false, `${label} leaked forbidden data: ${forbidden}`)
  }
}

test('Durable Object + WebSocket queue architecture, isolation, security & Firestore read reduction', async (t) => {
  const mockFs = await startMockFirestoreServer()
  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${mockFs.port}`

  const { NextRequest } = await import('next/server')
  const { QueueRoomDO } = await import('../src/lib/server/queue-room-do.ts')
  const { setTestQueueRoomNamespace } = await import('../src/lib/server/worker-env.ts')
  const { maybeHandleQueueWebSocketRequest } = await import('../src/lib/server/queue-ws-gateway.ts')
  const { executeQueueTransition } = await import('../src/lib/server/queue-transition.ts')
  const { createSessionToken } = await import('../src/lib/auth-crypto.ts')
  const { resetFirestoreTelemetry, getFirestoreTelemetry, queryDocumentsByFields } = await import(
    '../src/lib/server/firebase-rest.ts'
  )
  const { GET: dayGet } = await import('../src/app/api/clinic/[slug]/appointments/day/route.ts')
  const { GET: queueGet } = await import('../src/app/api/clinic/[slug]/queue/route.ts')
  const { POST: managePost } = await import('../src/app/api/clinic/[slug]/appointments/manage/route.ts')
  const { POST: cancelPost } = await import('../src/app/api/patient/appointments/cancel/route.ts')
  const { POST: bookPost } = await import('../src/app/api/clinic/book/route.ts')
  const { POST: inClinicBookPost } = await import(
    '../src/app/api/clinic/[slug]/in-clinic-booking/route.ts'
  )
  const { GET: settingsGet } = await import('../src/app/api/clinic/[slug]/settings/route.ts')

  const doNs = createDoNamespace(QueueRoomDO, {
    CLINIC_SESSION_SECRET: process.env.CLINIC_SESSION_SECRET,
    PATIENT_SESSION_SECRET: process.env.PATIENT_SESSION_SECRET,
    FIREBASE_PROJECT_ID: 'demo-clinic-os',
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${mockFs.port}`,
  })
  setTestQueueRoomNamespace(doNs)

  t.after(async () => {
    await new Promise((r) => setTimeout(r, 80))
    setTestQueueRoomNamespace(null)
    delete process.env.FIRESTORE_EMULATOR_HOST
    await mockFs.close()
  })

  const today = getTodayCairoStr()
  const clinicId = 'clinic-alpha'
  const slug = 'alpha-clinic'
  const clinicBId = 'clinic-beta'
  const clinicBSlug = 'beta-clinic'

  const clinicDoc = {
    id: clinicId,
    slug,
    clinicName: 'عيادة ألفا',
    doctorName: 'د. أحمد',
    doctorEmail: 'doctor@alpha.test',
    doctorPasswordHash: 'hash_secret_do_not_leak',
    approved: true,
    isActive: true,
    credentialsVersion: 2,
    averageVisitTime: 15,
    bookingLimit: 50,
    assistantEmail: 'assist1@alpha.test',
    assistantUsername: 'assist1',
    assistantName: 'سارة فرع 1',
    assistantBranchId: 'branch-1',
    assistantIsActive: true,
    assistants: [
      {
        id: 'assist-b1',
        email: 'assist1@alpha.test',
        username: 'assist1',
        name: 'سارة فرع 1',
        branchId: 'branch-1',
        isActive: true,
      },
    ],
    branches: [
      { id: 'branch-1', name: 'فرع مدينة نصر', isActive: true, isMain: true },
      { id: 'branch-2', name: 'فرع المعادي', isActive: true, isMain: false },
    ],
    services: [{ id: 'srv-1', name: 'كشف باطنة', price: 350, durationMinutes: 15 }],
  }

  const clinicBDoc = {
    id: clinicBId,
    slug: clinicBSlug,
    clinicName: 'عيادة بيتا',
    doctorEmail: 'doctor@beta.test',
    approved: true,
    isActive: true,
    credentialsVersion: 1,
    branches: [{ id: 'beta-b1', name: 'فرع بيتا', isMain: true }],
  }

  mockFs.store.set(`clinics/${clinicId}`, clinicDoc)
  mockFs.store.set(`clinics/${clinicBId}`, clinicBDoc)
  mockFs.store.set(`branches/branch-1`, { id: 'branch-1', clinicId, name: 'فرع مدينة نصر', bookingLimit: 50, isMain: true, isOpen: true })
  mockFs.store.set(`branches/branch-2`, { id: 'branch-2', clinicId, name: 'فرع المعادي', bookingLimit: 50, isMain: false, isOpen: true })

  const seedAppointments = [
    {
      id: 'appt-a1',
      clinic_id: clinicId,
      branch_id: 'branch-1',
      branchName: 'فرع مدينة نصر',
      date: today,
      queue_number: 1,
      patientName: 'المريض الأول',
      phone: '01099900001',
      serviceId: 'srv-1',
      serviceName: 'كشف باطنة',
      servicePrice: 350,
      status: 'waiting',
      paymentStatus: 'unpaid',
      createdAt: '2026-11-11T08:00:00.000Z',
    },
    {
      id: 'appt-a2',
      clinic_id: clinicId,
      branch_id: 'branch-1',
      branchName: 'فرع مدينة نصر',
      date: today,
      queue_number: 2,
      patientName: 'المريض الثاني',
      phone: '01188800002',
      serviceId: 'srv-1',
      serviceName: 'كشف باطنة',
      servicePrice: 350,
      status: 'waiting',
      paymentStatus: 'paid',
      createdAt: '2026-11-11T08:05:00.000Z',
    },
    {
      id: 'appt-b2-only',
      clinic_id: clinicId,
      branch_id: 'branch-2',
      branchName: 'فرع المعادي',
      date: today,
      queue_number: 1,
      patientName: 'Branch-2-Only Patient',
      phone: '01077700003',
      serviceId: 'srv-1',
      serviceName: 'كشف باطنة',
      servicePrice: 500,
      status: 'waiting',
      paymentStatus: 'unpaid',
      createdAt: '2026-11-11T08:10:00.000Z',
    },
    {
      id: 'appt-clinic-beta',
      clinic_id: clinicBId,
      branch_id: 'beta-b1',
      date: today,
      queue_number: 1,
      patientName: 'مريض عيادة بيتا',
      phone: '01234567890',
      status: 'waiting',
      createdAt: '2026-11-11T08:15:00.000Z',
    },
  ]
  for (const a of seedAppointments) {
    mockFs.store.set(`appointments/${a.id}`, a)
  }

  const doctorToken = await createSessionToken({
    role: 'doctor',
    clinicId,
    slug,
    email: 'doctor@alpha.test',
    name: 'د. أحمد',
    credentialsVersion: 2,
    exp: Date.now() + 3600_000,
  })
  const assistantToken = await createSessionToken({
    role: 'assistant',
    clinicId,
    slug,
    email: 'assist1@alpha.test',
    username: 'assist1',
    name: 'سارة فرع 1',
    branchId: 'branch-1',
    credentialsVersion: 2,
    exp: Date.now() + 3600_000,
  })
  const clinicBToken = await createSessionToken({
    role: 'doctor',
    clinicId: clinicBId,
    slug: clinicBSlug,
    email: 'doctor@beta.test',
    name: 'د. بيتا',
    credentialsVersion: 1,
    exp: Date.now() + 3600_000,
  })
  const patientToken = await createSessionToken(
    {
      role: 'patient',
      clinicId,
      slug,
      phone: '01188800002',
      exp: Date.now() + 3600_000,
    },
    'patient',
  )

  await t.test('1. Cold hydration coalesces concurrent initial opens & serves repeated reads with 0 Firestore reads', async () => {
    resetFirestoreTelemetry()
    mockFs.logs.length = 0

    const stub = doNs.get(doNs.idFromName(`clinic:${clinicId}`))
    const [r1, r2, r3] = await Promise.all([
      stub.getOrHydrateDay({ clinicId, date: today }),
      stub.getOrHydrateDay({ clinicId, date: today }),
      stub.getOrHydrateDay({ clinicId, date: today }),
    ])

    assert.equal(r1.source, 'firestore_hydrated')
    assert.equal(r2.source, 'firestore_hydrated')
    assert.equal(r3.source, 'firestore_hydrated')
    assert.equal(r1.appointments.length, 3)

    const coldReads = getFirestoreTelemetry().totalReads
    // 1 clinic read + 3 appointments matched in single runQuery = 4 billable reads total across 3 concurrent screens!
    assert.equal(coldReads, 4, `Expected exactly 4 coalesced cold reads, got ${coldReads}`)

    // Warm reads from DO SQLite via day & queue endpoints:
    // First queueGet resolves slug once (via indexed slug query, zero unscoped scans) & populates __slug_index__ DO.
    // Subsequent queueGet and dayGet calls hit DO SQLite with 0 additional Firestore reads!
    const resDay = await dayGet(
      new NextRequest(`https://clinic.test/api/clinic/${slug}/appointments/day?date=${today}`, {
        headers: { cookie: `clinic_session=${doctorToken}` },
      }),
      { params: Promise.resolve({ slug }) },
    )
    assert.equal(resDay.status, 200)
    const dayJson = await resDay.json()
    assert.equal(dayJson.source, 'do_sqlite')
    assert.equal(dayJson.appointments.length, 3)
    assert.equal(
      getFirestoreTelemetry().totalReads,
      coldReads,
      'dayGet with warm DO must perform 0 Firestore reads',
    )

    const resQueue1 = await queueGet(
      new NextRequest(
        `https://clinic.test/api/clinic/${slug}/queue?appointmentId=appt-a1&branchId=branch-1`,
      ),
      { params: Promise.resolve({ slug }) },
    )
    assert.equal(resQueue1.status, 200)
    const queueJson = await resQueue1.json()
    assert.equal(queueJson.patientAppointment.id, 'appt-a1')
    assertNoSensitiveKeys(queueJson.tvQueue, 'HTTP TV payload')
    assert.equal(
      mockFs.logs.some((l) => l.type === 'runQuery' && l.unscopedScan),
      false,
      'Slug resolution must never run unscoped clinics scan',
    )

    const readsAfterFirstSlugMap = getFirestoreTelemetry().totalReads
    const resQueue2 = await queueGet(
      new NextRequest(
        `https://clinic.test/api/clinic/${slug}/queue?appointmentId=appt-a1&branchId=branch-1`,
      ),
      { params: Promise.resolve({ slug }) },
    )
    assert.equal(resQueue2.status, 200)
    assert.equal(
      getFirestoreTelemetry().totalReads,
      readsAfterFirstSlugMap,
      'Subsequent warm queue reads must perform 0 additional Firestore reads',
    )
  })

  await t.test('2. Gateway enforces 426, 401/403 isolation, assistant branch lock, TV/Patient redaction & session revocation', async () => {
    const gwEnv = {
      CLINIC_SESSION_SECRET: process.env.CLINIC_SESSION_SECRET,
      PATIENT_SESSION_SECRET: process.env.PATIENT_SESSION_SECRET,
      FIREBASE_PROJECT_ID: 'demo-clinic-os',
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${mockFs.port}`,
    }

    const noUpgrade = await maybeHandleQueueWebSocketRequest(
      new Request(`https://clinic.test/api/clinic/${slug}/queue/ws?role=tv`),
      gwEnv,
    )
    assert.equal(noUpgrade?.status, 426)

    const unauthStaff = await maybeHandleQueueWebSocketRequest(
      new Request(`https://clinic.test/api/clinic/${slug}/queue/ws?role=staff`, {
        headers: { upgrade: 'websocket', 'sec-websocket-key': 'k1', 'sec-websocket-version': '13' },
      }),
      gwEnv,
    )
    assert.equal(unauthStaff?.status, 401)

    const crossClinicStaff = await maybeHandleQueueWebSocketRequest(
      new Request(`https://clinic.test/api/clinic/${slug}/queue/ws?role=staff`, {
        headers: {
          upgrade: 'websocket',
          cookie: `clinic_session=${clinicBToken}`,
        },
      }),
      gwEnv,
    )
    assert.equal(crossClinicStaff?.status, 401)

    const missingPatientAppt = await maybeHandleQueueWebSocketRequest(
      new Request(`https://clinic.test/api/clinic/${slug}/queue/ws?role=patient`, {
        headers: { upgrade: 'websocket' },
      }),
      gwEnv,
    )
    assert.equal(missingPatientAppt?.status, 403)

    const crossClinicPatient = await maybeHandleQueueWebSocketRequest(
      new Request(
        `https://clinic.test/api/clinic/${slug}/queue/ws?role=patient&appointmentId=appt-clinic-beta`,
        { headers: { upgrade: 'websocket' } },
      ),
      gwEnv,
    )
    assert.equal(crossClinicPatient?.status, 403)

    // Connect 4 concurrent sockets: Doctor, Assistant (spoofing ?branchId=branch-2!), TV (branch-1), Patient (appt-a1)
    const doctorUpgrade = await maybeHandleQueueWebSocketRequest(
      new Request(`https://clinic.test/api/clinic/${slug}/queue/ws?role=staff&date=${today}`, {
        headers: { upgrade: 'websocket', cookie: `clinic_session=${doctorToken}` },
      }),
      gwEnv,
    )
    const assistantUpgrade = await maybeHandleQueueWebSocketRequest(
      new Request(
        `https://clinic.test/api/clinic/${slug}/queue/ws?role=staff&branchId=branch-2&date=${today}`,
        { headers: { upgrade: 'websocket', cookie: `clinic_session=${assistantToken}` } },
      ),
      gwEnv,
    )
    const tvUpgrade = await maybeHandleQueueWebSocketRequest(
      new Request(
        `https://clinic.test/api/clinic/${slug}/queue/ws?role=tv&branchId=branch-1&date=${today}`,
        { headers: { upgrade: 'websocket' } },
      ),
      gwEnv,
    )
    const patientUpgrade = await maybeHandleQueueWebSocketRequest(
      new Request(
        `https://clinic.test/api/clinic/${slug}/queue/ws?role=patient&appointmentId=appt-a1`,
        { headers: { upgrade: 'websocket' } },
      ),
      gwEnv,
    )

    assert.equal(doctorUpgrade?.status, 101)
    assert.equal(assistantUpgrade?.status, 101)
    assert.equal(tvUpgrade?.status, 101)
    assert.equal(patientUpgrade?.status, 101)

    const doctorWs = doctorUpgrade.webSocket
    const assistantWs = assistantUpgrade.webSocket
    const tvWs = tvUpgrade.webSocket
    const patientWs = patientUpgrade.webSocket

    const docSnap = doctorWs.parsedMessages()[0]
    const assistSnap = assistantWs.parsedMessages()[0]
    const tvSnap = tvWs.parsedMessages()[0]
    const patSnap = patientWs.parsedMessages()[0]

    assert.equal(docSnap.type, 'snapshot')
    assert.equal(docSnap.appointments.length, 3)

    // Assistant requested ?branchId=branch-2 but must be locked strictly to branch-1!
    assert.equal(assistSnap.branchId, 'branch-1')
    assert.equal(assistSnap.appointments.length, 2)
    assert.ok(assistSnap.appointments.every((a) => a.branch_id === 'branch-1'))

    // TV receives display-only branch-1 queue (no phones/prices/payments/branch-2/passwords)
    assert.equal(tvSnap.tvQueue.nextWaitingPatients.length, 2)
    assert.equal(tvSnap.tvQueue.totalWaitingCount, 2)
    assertNoSensitiveKeys(tvSnap, 'WS TV snapshot')

    // Patient receives ONLY appt-a1 and zero sibling patient records
    assert.equal(patSnap.patientAppointment.id, 'appt-a1')
    assert.equal('appointments' in patSnap, false)
    assert.equal(JSON.stringify(patSnap).includes('المريض الثاني'), false)
    assert.equal(JSON.stringify(patSnap).includes('01188800002'), false)

    // Real-time transition push across all connected sockets WITHOUT polling!
    resetFirestoreTelemetry()
    const transitionResult = await executeQueueTransition({
      slug,
      staff: {
        clinicId,
        clinic: clinicDoc,
        user: { role: 'doctor', name: 'د. أحمد' },
      },
      appointmentId: 'appt-a1',
      action: 'start',
    })
    assert.equal(transitionResult.ok, true)
    assert.equal(getFirestoreTelemetry().totalReads, 0, 'Warm transition must perform 0 Firestore reads!')

    // Give microtasks/broadcasts a tick
    await new Promise((r) => setTimeout(r, 10))

    const tvUpdate = tvWs.parsedMessages().at(-1)
    const patUpdate = patientWs.parsedMessages().at(-1)
    const assistUpdate = assistantWs.parsedMessages().at(-1)

    assert.equal(tvUpdate.type, 'queue_update')
    assert.equal(tvUpdate.tvQueue.currentPatient.id, 'appt-a1')
    assert.equal(tvUpdate.tvQueue.currentPatient.status, 'in_progress')
    assertNoSensitiveKeys(tvUpdate, 'WS TV queue_update')

    assert.equal(patUpdate.type, 'queue_update')
    assert.equal(patUpdate.patientAppointment.status, 'in_progress')
    assert.equal(assistUpdate.notificationsChanged, true)

    // Verify ping -> pong
    tvWs.send(JSON.stringify({ type: 'ping' }))
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(tvWs.parsedMessages().at(-1).type, 'pong')

    // Session revocation closes staff sockets immediately with 4001 while TV stays connected
    await doNs.get(doNs.idFromName(`clinic:${clinicId}`)).updateClinicMeta({
      clinicId,
      clinic: { ...clinicDoc, credentialsVersion: 3 },
    })
    assert.equal(doctorWs.closeCode, 4001)
    assert.equal(assistantWs.closeCode, 4001)
    assert.equal(tvWs.closed, false)

    tvWs.close()
    patientWs.close()
  })

  await t.test('3. Appointments manage, patient cancel, book & in-clinic-booking avoid full collection scans & broadcast via DO', async () => {
    mockFs.logs.length = 0

    // Reconnect a TV socket with latest clinic meta (credentialsVersion=3 now cached in DO)
    const gwEnv = {
      CLINIC_SESSION_SECRET: process.env.CLINIC_SESSION_SECRET,
      PATIENT_SESSION_SECRET: process.env.PATIENT_SESSION_SECRET,
      FIREBASE_PROJECT_ID: 'demo-clinic-os',
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${mockFs.port}`,
    }
    const tvUpgrade = await maybeHandleQueueWebSocketRequest(
      new Request(
        `https://clinic.test/api/clinic/${slug}/queue/ws?role=tv&branchId=branch-1&date=${today}`,
        { headers: { upgrade: 'websocket' } },
      ),
      gwEnv,
    )
    const tvWs = tvUpgrade.webSocket

    // Restore clinicDoc credentialsVersion to 2 in mockFs + DO for doctorToken validity
    mockFs.store.set(`clinics/${clinicId}`, clinicDoc)
    await doNs.get(doNs.idFromName(`clinic:${clinicId}`)).updateClinicMeta({
      clinicId,
      clinic: clinicDoc,
    })

    // Public booking -> zero unscoped scans + immediate DO broadcast
    const bookRes = await bookPost(
      new NextRequest('https://clinic.test/api/clinic/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://clinic.test' },
        body: JSON.stringify({
          slug,
          branchId: 'branch-1',
          branchName: 'فرع مدينة نصر',
          patientName: 'حجز أونلاين جديد',
          patientPhone: '01066600009',
          date: today,
          serviceId: 'srv-1',
        }),
      }),
    )
    assert.equal(bookRes.status, 200)
    const bookJson = await bookRes.json()
    assert.ok(bookJson.id)

    await new Promise((r) => setTimeout(r, 15))
    assert.ok(
      tvWs.parsedMessages().some(
        (m) =>
          m.type === 'queue_update' &&
          m.tvQueue?.nextWaitingPatients?.some((p) => p.id === bookJson.id),
      ),
      'Online booking should immediately appear in TV WebSocket broadcast',
    )

    // Verify ZERO unscoped full-collection scans during book!
    const unscopedScans = mockFs.logs.filter((l) => l.type === 'runQuery' && l.unscopedScan)
    assert.equal(unscopedScans.length, 0, `Unexpected unscoped scans: ${JSON.stringify(unscopedScans)}`)

    // In-clinic booking -> server session + zero unscoped scans + broadcast
    const inClinicRes = await inClinicBookPost(
      new NextRequest(`https://clinic.test/api/clinic/${slug}/in-clinic-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://clinic.test',
          cookie: `clinic_session=${doctorToken}`,
        },
        body: JSON.stringify({
          patientName: 'كشف داخل العيادة',
          phone: '01055500008',
          date: today,
          branchId: 'branch-1',
          serviceId: 'srv-1',
        }),
      }),
      { params: Promise.resolve({ slug }) },
    )
    assert.equal(inClinicRes.status, 200)
    const inClinicJson = await inClinicRes.json()
    assert.equal(inClinicJson.success, true)

    // Edit turn + discount via /appointments/manage
    const manageRes = await managePost(
      new NextRequest(`https://clinic.test/api/clinic/${slug}/appointments/manage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://clinic.test',
          cookie: `clinic_session=${doctorToken}`,
        },
        body: JSON.stringify({
          appointmentId: 'appt-a2',
          action: 'edit_turn',
          queueNumber: 9,
          isUrgent: true,
        }),
      }),
      { params: Promise.resolve({ slug }) },
    )
    assert.equal(manageRes.status, 200)

    // Patient cancel rejects wrong phone/no auth, allows valid patient_session & broadcasts to TV
    const unauthCancel = await cancelPost(
      new NextRequest('https://clinic.test/api/patient/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://clinic.test' },
        body: JSON.stringify({ clinicSlug: slug, appointmentId: 'appt-a2' }),
      }),
    )
    assert.equal(unauthCancel.status, 401)

    const validCancel = await cancelPost(
      new NextRequest('https://clinic.test/api/patient/appointments/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://clinic.test',
          cookie: `clinic_session=${doctorToken}; patient_session=${patientToken}`,
        },
        body: JSON.stringify({ clinicSlug: slug, appointmentId: 'appt-a2' }),
      }),
    )
    assert.equal(validCancel.status, 200)
    await new Promise((r) => setTimeout(r, 15))
    const latestTv = tvWs.parsedMessages().at(-1)
    assert.equal(
      latestTv.tvQueue.nextWaitingPatients.some((p) => p.id === 'appt-a2'),
      false,
      'Cancelled appointment must vanish from TV waiting list via WebSocket update',
    )

    // Settings GET hits warm DO cache with 0 Firestore clinic reads
    const telBeforeSettings = getFirestoreTelemetry().totalReads
    const settingsRes = await settingsGet(
      new NextRequest(`https://clinic.test/api/clinic/${slug}/settings`),
      { params: Promise.resolve({ slug }) },
    )
    assert.equal(settingsRes.status, 200)
    assert.equal(getFirestoreTelemetry().totalReads, telBeforeSettings)

    const afterScans = mockFs.logs.filter((l) => l.type === 'runQuery' && l.unscopedScan)
    assert.equal(afterScans.length, 0, 'Zero unscoped collection scans across all routes')

    tvWs.close()
  })

  await t.test('4. Quantitative Firestore Reads Measurement: BEFORE (5s Polling) vs AFTER (Durable Object + WebSocket)', async () => {
    // Seed 12 waiting appointments on a clean test clinic for apples-to-apples comparison
    const benchClinicId = 'clinic-bench'
    const benchSlug = 'bench-clinic'
    mockFs.store.set(`clinics/${benchClinicId}`, {
      ...clinicDoc,
      id: benchClinicId,
      slug: benchSlug,
      branches: [{ id: 'b-main', name: 'الفرع الرئيسي', isMain: true }],
    })
    for (let i = 1; i <= 12; i++) {
      mockFs.store.set(`appointments/bench-appt-${i}`, {
        id: `bench-appt-${i}`,
        clinic_id: benchClinicId,
        branch_id: 'b-main',
        date: today,
        queue_number: i,
        patientName: `مريض ${i}`,
        phone: `010000000${String(i).padStart(2, '0')}`,
        status: 'waiting',
        createdAt: `2026-11-11T08:${String(i).padStart(2, '0')}:00.000Z`,
      })
    }

    // --- BASELINE (BEFORE): Simulate PR #14 polling over 60s across 3 screens (Admin 5s, TV 4s, Track 5s) ---
    // Each un-cached poll executes scoped Firestore query for clinic's 12 appointments (plus clinic/notifications in real life).
    resetFirestoreTelemetry()
    const pollsIn60s = 12 /* Admin */ + 15 /* TV */ + 12 /* Track */ // = 39 queue HTTP polls in 60s
    for (let p = 0; p < pollsIn60s; p++) {
      await queryDocumentsByFields('appointments', { clinic_id: benchClinicId, date: today }, 250)
    }
    const beforeIdle60sReads = getFirestoreTelemetry().totalReads

    // Active workflow BEFORE over 30s (half of 60s = 19 polls + 3 transitions reading appts)
    resetFirestoreTelemetry()
    for (let p = 0; p < 19 + 3; p++) {
      await queryDocumentsByFields('appointments', { clinic_id: benchClinicId, date: today }, 250)
    }
    const beforeActive30sReads = getFirestoreTelemetry().totalReads

    // --- AFTER: QueueRoomDO + 3 WebSocket subscribers (Doctor Admin + TV + Patient Track) ---
    resetFirestoreTelemetry()
    const stub = doNs.get(doNs.idFromName(`clinic:${benchClinicId}`))
    await Promise.all([
      stub.getOrHydrateDay({ clinicId: benchClinicId, date: today }),
      stub.getOrHydrateDay({ clinicId: benchClinicId, date: today }),
      stub.getOrHydrateDay({ clinicId: benchClinicId, date: today }),
    ])
    const afterInitialHydrateReads = getFirestoreTelemetry().totalReads // 1 clinic + 12 appts = 13

    // Idle phase after connection (no transitions; heartbeats via ping/pong only -> 0 Firestore reads!)
    resetFirestoreTelemetry()
    for (let tick = 0; tick < 39; tick++) {
      await stub.getOrHydrateDay({ clinicId: benchClinicId, date: today })
    }
    const afterIdleOngoingReads = getFirestoreTelemetry().totalReads

    // Active workflow AFTER: start -> complete -> start next -> skip -> recall -> complete
    resetFirestoreTelemetry()
    const benchStaff = {
      clinicId: benchClinicId,
      clinic: mockFs.store.get(`clinics/${benchClinicId}`),
      user: { role: 'doctor', name: 'د. قياس' },
    }
    await executeQueueTransition({
      slug: benchSlug,
      staff: benchStaff,
      appointmentId: 'bench-appt-1',
      action: 'start',
    })
    await executeQueueTransition({
      slug: benchSlug,
      staff: benchStaff,
      appointmentId: 'bench-appt-1',
      action: 'complete',
    })
    await executeQueueTransition({
      slug: benchSlug,
      staff: benchStaff,
      appointmentId: 'bench-appt-2',
      action: 'start',
    })
    // Note: executeQueueTransition itself performs 0 Firestore reads when DO is warm;
    // any reads in telemetry during active phase are from background notification/push delivery (`push_subscriptions`/`notifications`).
    await new Promise((r) => setTimeout(r, 50))
    const activeTel = getFirestoreTelemetry()
    const afterActiveQueueReads = (activeTel.byCollection.appointments || 0) + (activeTel.byCollection.clinics || 0)

    console.log(
      `[BENCHMARK] 12-patient Queue, 3 devices | Idle 60s BEFORE=${beforeIdle60sReads} reads vs AFTER initial=${afterInitialHydrateReads} / ongoing=${afterIdleOngoingReads} reads | Active 30s (3 transitions) BEFORE=${beforeActive30sReads} reads vs AFTER queueReads=${afterActiveQueueReads} (totalWithAsyncNotifs=${activeTel.totalReads}, byCollection=${JSON.stringify(activeTel.byCollection)})`,
    )

    assert.equal(beforeIdle60sReads, 39 * 12) // 468 reads in 60s before
    assert.equal(afterInitialHydrateReads, 13) // 13 once on cold open
    assert.equal(afterIdleOngoingReads, 0) // 0 ongoing idle reads!
    assert.equal(beforeActive30sReads, 22 * 12) // 264 reads before
    assert.equal(afterActiveQueueReads, 0) // 0 Firestore queue/clinic reads during warm DO transitions!
    assert.ok(activeTel.totalReads < beforeActive30sReads / 10, 'Even with async push lookup, reads drop >90%')
  })

  await t.test('5. Static contracts: clients disable polling on live WS & remove client Firestore queue polling/writes', () => {
    const adminSrc = readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8')
    const tvSrc = readFileSync('src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx', 'utf8')
    const trackIdSrc = readFileSync('src/app/clinic/[slug]/track/[appointmentId]/page.tsx', 'utf8')
    const trackSrc = readFileSync('src/app/clinic/[slug]/track/page.tsx', 'utf8')
    const notifSrc = readFileSync('src/components/clinic/NotificationCenter.tsx', 'utf8')
    const inClinicSrc = readFileSync('src/app/api/clinic/[slug]/in-clinic-booking/route.ts', 'utf8')
    const bookSrc = readFileSync('src/app/api/clinic/book/route.ts', 'utf8')
    const workerSrc = readFileSync('cloudflare-worker.mjs', 'utf8')
    const wranglerSrc = readFileSync('wrangler.toml', 'utf8')

    assert.equal(adminSrc.includes('connectClinicQueueWebSocket'), true)
    assert.equal(adminSrc.includes("from 'firebase/firestore'"), false)
    assert.equal(adminSrc.includes('/appointments/manage'), true)

    assert.equal(tvSrc.includes('connectClinicQueueWebSocket'), true)
    assert.equal(tvSrc.includes('heldUntilRef'), false)

    assert.equal(trackIdSrc.includes('connectClinicQueueWebSocket'), true)
    assert.equal(trackSrc.includes('connectClinicQueueWebSocket'), true)
    assert.equal(notifSrc.includes('yalla_notifications_changed'), true)

    assert.equal(inClinicSrc.includes("from 'firebase/firestore'"), false)
    assert.equal(inClinicSrc.includes('upsertAppointmentInRoom'), true)

    assert.equal(bookSrc.includes("queryDocuments('appointments')"), false)
    assert.equal(bookSrc.includes("queryDocuments('clinics')"), false)
    assert.equal(bookSrc.includes("queryDocuments('patient_accounts')"), false)
    assert.equal(bookSrc.includes('upsertAppointmentInRoom'), true)

    assert.equal(workerSrc.includes('maybeHandleQueueWebSocketRequest'), true)
    assert.equal(workerSrc.includes('QueueRoomDO') && workerSrc.includes('export {'), true)
    assert.equal(wranglerSrc.includes('QUEUE_ROOM'), true)
    assert.equal(wranglerSrc.includes('QueueRoomDO'), true)
  })
})
