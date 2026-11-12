import 'server-only'

type Fields = Record<string, unknown>
type FirestoreValue = {
  nullValue?: null
  booleanValue?: boolean
  integerValue?: string
  doubleValue?: number
  stringValue?: string
  timestampValue?: string
  arrayValue?: { values?: FirestoreValue[] }
  mapValue?: { fields?: Record<string, FirestoreValue> }
}
type FirestoreDocument = {
  name: string
  fields?: Record<string, FirestoreValue>
}
const googleScopes = {
  firestore: 'https://www.googleapis.com/auth/datastore',
  storage: 'https://www.googleapis.com/auth/devstorage.read_write',
} as const
const cachedTokens = new Map<keyof typeof googleScopes, { value: string; expires: number }>()
const pendingTokens = new Map<keyof typeof googleScopes, Promise<string>>()

const TELEMETRY_SYMBOL = Symbol.for('clinic.os.firestore.telemetry')

export interface FirestoreTelemetrySnapshot {
  totalReads: number
  byOperation: Record<string, number>
  byCollection: Record<string, number>
  startedAt: string
}

function getTelemetryState(): FirestoreTelemetrySnapshot {
  const store = globalThis as Record<symbol, FirestoreTelemetrySnapshot | undefined>
  if (!store[TELEMETRY_SYMBOL]) {
    store[TELEMETRY_SYMBOL] = {
      totalReads: 0,
      byOperation: {},
      byCollection: {},
      startedAt: new Date().toISOString(),
    }
  }
  return store[TELEMETRY_SYMBOL]!
}

export function recordFirestoreRead(operation: string, billableReads = 1, collection?: string): void {
  const units = Math.max(1, Math.floor(Number(billableReads) || 1))
  const state = getTelemetryState()
  state.totalReads += units
  state.byOperation[operation] = (state.byOperation[operation] || 0) + units
  if (collection) {
    state.byCollection[collection] = (state.byCollection[collection] || 0) + units
  }
}

export function getFirestoreTelemetry(): FirestoreTelemetrySnapshot {
  const s = getTelemetryState()
  return {
    totalReads: s.totalReads,
    byOperation: { ...s.byOperation },
    byCollection: { ...s.byCollection },
    startedAt: s.startedAt,
  }
}

export function resetFirestoreTelemetry(): FirestoreTelemetrySnapshot {
  const fresh: FirestoreTelemetrySnapshot = {
    totalReads: 0,
    byOperation: {},
    byCollection: {},
    startedAt: new Date().toISOString(),
  }
  ;(globalThis as Record<symbol, FirestoreTelemetrySnapshot>)[TELEMETRY_SYMBOL] = fresh
  return getFirestoreTelemetry()
}

export class FirestoreQuotaError extends Error {
  status = 429
  code = 'FIRESTORE_QUOTA_EXHAUSTED'
  constructor(message = 'FIRESTORE_QUOTA_EXHAUSTED') {
    super(message)
    this.name = 'FirestoreQuotaError'
  }
}

export function isFirestoreQuotaError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof FirestoreQuotaError) return true
  const rec = error as { status?: number; code?: string; message?: string }
  return (
    rec.status === 429 ||
    rec.code === 'FIRESTORE_QUOTA_EXHAUSTED' ||
    String(rec.message || '').includes('FIRESTORE_QUOTA_EXHAUSTED')
  )
}

/** Loopback-only Firestore emulator support for automated local & DO integration verification. */
export function getFirestoreEmulatorOrigin(): string | null {
  const raw = String(process.env.FIRESTORE_EMULATOR_HOST || '').trim()
  if (!raw) return null
  const normalized = raw.startsWith('http://') ? raw : `http://${raw}`
  try {
    const parsed = new URL(normalized)
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
      /^\d{2,5}$/.test(parsed.port)
    ) {
      return `${parsed.protocol}//${parsed.host}`
    }
  } catch {
    return null
  }
  return null
}

export function getFirebaseServerCredentials() {
  const emulatorOrigin = getFirestoreEmulatorOrigin()
  let account: Record<string, unknown> = {}
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('INVALID_ACCOUNT')
      account = parsed
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_INVALID')
    }
  }
  const email = process.env.FIREBASE_CLIENT_EMAIL || account.client_email
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || account.private_key
  const key =
    typeof privateKey === 'string' ? privateKey.replace(/\\n/g, '\n') : ''
  const project =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    account.project_id ||
    (emulatorOrigin ? 'demo-clinic-os' : undefined)
  if (emulatorOrigin && typeof project === 'string' && project) {
    return {
      email: typeof email === 'string' && email ? email : 'emulator@local.test',
      key,
      project,
    }
  }
  if (
    typeof email !== 'string' ||
    !email ||
    !key ||
    typeof project !== 'string' ||
    !project
  )
    throw new Error('FIREBASE_SERVER_NOT_CONFIGURED')
  if (account.project_id && account.project_id !== project)
    throw new Error('FIREBASE_PROJECT_MISMATCH')
  if (account.client_email && account.client_email !== email)
    throw new Error('FIREBASE_SERVICE_ACCOUNT_MISMATCH')
  return { email, key, project }
}
export function firebaseServerConfigured() {
  try {
    getFirebaseServerCredentials()
    return true
  } catch {
    return false
  }
}
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
let cachedPrivateKey: { keyText: string; cryptoKey: CryptoKey } | undefined

export async function signServiceJwt(payload: Record<string, unknown>) {
  const { key } = getFirebaseServerCredentials()
  const body =
    base64url(
      new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    ) +
    '.' +
    base64url(new TextEncoder().encode(JSON.stringify(payload)))
  let privateKey: CryptoKey
  if (cachedPrivateKey && cachedPrivateKey.keyText === key) {
    privateKey = cachedPrivateKey.cryptoKey
  } else {
    const der = Uint8Array.from(
      atob(key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
      (c) => c.charCodeAt(0),
    )
    privateKey = await crypto.subtle.importKey(
      'pkcs8',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    cachedPrivateKey = { keyText: key, cryptoKey: privateKey }
  }
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(body),
  )
  return body + '.' + base64url(new Uint8Array(signature))
}
export async function googleAccessToken(service: keyof typeof googleScopes = 'firestore'): Promise<string> {
  if (service === 'firestore' && getFirestoreEmulatorOrigin()) return 'owner'
  const cachedToken = cachedTokens.get(service)
  const pendingToken = pendingTokens.get(service)
  if (cachedToken && cachedToken.expires > Date.now() + 60000)
    return cachedToken.value
  if (pendingToken) return pendingToken
  const requestToken = (async () => {
    const { email } = getFirebaseServerCredentials(),
      now = Math.floor(Date.now() / 1000)
    const assertion = await signServiceJwt({
      iss: email,
      scope: googleScopes[service],
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const data = (await response.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!response.ok || !data.access_token)
      throw new Error('FIREBASE_SERVICE_AUTH_FAILED')
    cachedTokens.set(service, {
      value: data.access_token,
      expires: Date.now() + Number(data.expires_in || 3600) * 1000,
    })
    return data.access_token
  })().finally(() => {
    pendingTokens.delete(service)
  })
  pendingTokens.set(service, requestToken)
  return requestToken
}
function encode(value: unknown): FirestoreValue {
  if (value == null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number')
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  if (typeof value === 'object')
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, encode(v)]),
        ),
      },
    }
  throw new Error('INVALID_FIRESTORE_VALUE')
}
function decode(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decode)
  return Object.fromEntries(
    Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [
      k,
      decode(v),
    ]),
  )
}
function unpack(doc: FirestoreDocument) {
  return {
    ...Object.fromEntries(
      Object.entries(doc.fields || {}).map(([k, v]) => [k, decode(v)]),
    ),
    id: doc.name.split('/').pop()!,
  } as Fields & { id: string }
}
function documentUrl(path: string) {
  const { project } = getFirebaseServerCredentials()
  const baseOrigin = getFirestoreEmulatorOrigin() || 'https://firestore.googleapis.com'
  const cleanSegments = path
    ? path
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/')
    : ''
  const suffix = cleanSegments ? `/${cleanSegments}` : ''
  return `${baseOrigin}/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents${suffix}`
}
async function request(url: string, init: RequestInit = {}) {
  const token = await googleAccessToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok && res.status !== 404) {
    const errorBody = await res.clone().text().catch(() => '')
    console.error(`[firebase-rest] Request to ${url} failed with status ${res.status}: ${errorBody}`)
  }
  return res
}
export async function readDocument(path: string) {
  const collection = path.split('/').filter(Boolean)[0]
  const response = await request(documentUrl(path))
  if (response.status === 429) throw new FirestoreQuotaError()
  if (response.status === 404) {
    recordFirestoreRead('readDocument', 1, collection)
    return null
  }
  if (!response.ok) throw new Error('FIRESTORE_READ_FAILED')
  recordFirestoreRead('readDocument', 1, collection)
  return unpack((await response.json()) as FirestoreDocument)
}
export async function writeDocument(path: string, data: Fields, merge = false) {
  const suffix = merge
    ? '?' +
      Object.keys(data)
        .map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k))
        .join('&')
    : ''
  const response = await request(documentUrl(path) + suffix, {
    method: 'PATCH',
    body: JSON.stringify({ fields: (encode(data).mapValue || {}).fields }),
  })
  if (!response.ok) throw new Error('FIRESTORE_WRITE_FAILED')
}
export async function createDocument(
  collection: string,
  data: Fields,
  documentId = crypto.randomUUID(),
) {
  const response = await request(
    documentUrl(collection) + '?documentId=' + encodeURIComponent(documentId),
    {
      method: 'POST',
      body: JSON.stringify({
        fields: (encode(data).mapValue || {}).fields,
      }),
    },
  )
  if (response.status === 409) throw new Error('RATE_LIMITED')
  if (!response.ok) throw new Error('FIRESTORE_WRITE_FAILED')
  return documentId
}
/**
 * Atomic field-level updates; used to guarantee exactly one selected main
 * branch. A failed precondition aborts the entire batch, not half the flags.
 */
export async function commitDocumentPatches(patches: Array<{ path: string; data: Fields }>): Promise<void> {
  if (!patches.length) return
  const writes = patches.map(({ path, data }) => ({
    update: {
      name: documentUrl(path).split('/v1/')[1],
      fields: (encode(data).mapValue || {}).fields || {},
    },
    updateMask: { fieldPaths: Object.keys(data) },
    currentDocument: { exists: true },
  }))
  const url = documentUrl('').replace(/\/$/, '') + ':commit'
  const response = await request(url, { method: 'POST', body: JSON.stringify({ writes }) })
  if (!response.ok) throw new Error('FIRESTORE_ATOMIC_COMMIT_FAILED')
}


/**
 * Server-only atomic appointment write. Uses a Firestore service account
 * transaction so public bookings never need anonymous Firestore write rules.
 * The shared daily counter serializes concurrent bookings for one branch/date.
 */
export async function createAtomicAppointmentServer(
  appointment: Record<string, unknown>,
  maxLimit: number,
  observedActiveCount: number,
  observedMaxQueueNumber: number,
): Promise<{ id: string; queueNumber: number }> {
  const clinicId = String(appointment.clinic_id || '')
  const date = String(appointment.date || '')
  const branchId = typeof appointment.branch_id === 'string' ? appointment.branch_id : ''
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(clinicId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      (branchId && !/^[a-zA-Z0-9_-]{1,128}$/.test(branchId))) {
    throw new Error('INVALID_BOOKING_SCOPE')
  }
  const counterPath = `clinic_daily_counters/${clinicId}_${branchId ? branchId + '_' : ''}${date}`
  const endpoint = documentUrl('').replace(/\/$/, '')
  const counterUrl = documentUrl(counterPath)
  const counterName = counterUrl.split('/v1/')[1]
  const apptId = crypto.randomUUID()
  const appointmentName = documentUrl(`appointments/${apptId}`).split('/v1/')[1]
  const count = Math.max(0, Number(observedActiveCount) || 0)
  const maxQueue = Math.max(0, Number(observedMaxQueueNumber) || 0)

  for (let attempt = 0; attempt < 6; attempt++) {
    let transaction = ''
    let committed = false
    try {
      const begin = await request(endpoint + ':beginTransaction', {
        method: 'POST',
        body: JSON.stringify({ options: { readWrite: {} } }),
      })
      if (!begin.ok) throw new Error('FIRESTORE_TRANSACTION_BEGIN_FAILED')
      const started = await begin.json() as { transaction?: string }
      if (!started.transaction) throw new Error('FIRESTORE_TRANSACTION_MISSING')
      transaction = started.transaction

      const counterRes = await request(counterUrl + '?transaction=' + encodeURIComponent(transaction))
      if (counterRes.status === 429) throw new FirestoreQuotaError()
      if (!counterRes.ok && counterRes.status !== 404)
        throw new Error('FIRESTORE_COUNTER_READ_FAILED')
      recordFirestoreRead('transactionRead', 1, 'clinic_daily_counters')
      const counterDoc = counterRes.ok ? unpack(await counterRes.json() as FirestoreDocument) : null
      const currentActive = Math.max(count, Number(counterDoc?.activeBookings) || 0)
      if (maxLimit > 0 && currentActive >= maxLimit)
        throw new Error(`QUOTA_EXCEEDED:${maxLimit}`)

      const nextQueue = Math.max(maxQueue, Number(counterDoc?.lastQueueNumber) || 0) + 1
      const timestamp = new Date().toISOString()
      const counter = {
        clinicId,
        branchId: branchId || null,
        date,
        lastQueueNumber: nextQueue,
        activeBookings: currentActive + 1,
        updatedAt: timestamp,
      }
      const appt = {
        ...appointment,
        branch_id: branchId || null,
        queue_number: nextQueue,
        createdAt: appointment.createdAt || timestamp,
      }
      const commit = await request(endpoint + ':commit', {
        method: 'POST',
        body: JSON.stringify({
          transaction,
          writes: [
            { update: { name: counterName, fields: (encode(counter).mapValue || {}).fields } },
            {
              update: { name: appointmentName, fields: (encode(appt).mapValue || {}).fields },
              currentDocument: { exists: false },
            },
          ],
        }),
      })
      if (commit.ok) {
        committed = true
        return { id: apptId, queueNumber: nextQueue }
      }
      // Firestore reports ABORTED for competing counter transactions.
      if (![409, 412, 429].includes(commit.status) || attempt === 5)
        throw new Error('FIRESTORE_BOOKING_COMMIT_FAILED')
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('QUOTA_EXCEEDED')) throw err
      if (attempt === 5) throw err
    } finally {
      // Do not roll back an already-committed booking: it adds needless latency.
      if (transaction && !committed) {
        await request(endpoint + ':rollback', {
          method: 'POST',
          body: JSON.stringify({ transaction }),
        }).catch(() => {})
      }
    }
  }
  throw new Error('FIRESTORE_BOOKING_CONFLICT')
}

/**
 * Acquire a lease with atomic Firestore preconditions. Creating a missing lock
 * requires exists=false; replacing an expired lease requires its updateTime.
 * Multiple contenders cannot both succeed, without holding transaction locks
 * across network calls (which can deadlock on a concurrently missing document).
 */
export async function acquireFirestoreLease(
  path: string, runId: string, triggeredBy: string, ttlMs: number,
): Promise<{ acquired: boolean; currentRunId?: string }> {
  if (!runId || !Number.isFinite(ttlMs) || ttlMs < 60000) throw new Error('INVALID_FIRESTORE_LEASE')
  const url = documentUrl(path)
  const payload = () => ({ fields: encode({ runId, lockedAt: new Date().toISOString(), lockedBy: triggeredBy }).mapValue?.fields || {} })
  const created = await request(url + '?currentDocument.exists=false', {
    method: 'PATCH', body: JSON.stringify(payload()),
  })
  if (created.ok) return { acquired: true, currentRunId: runId }
  if (![409, 412].includes(created.status)) throw new Error('FIRESTORE_LEASE_CREATE_FAILED')
  const response = await request(url)
  if (response.status === 429) throw new FirestoreQuotaError()
  if (response.status === 404) {
    recordFirestoreRead('leaseRead', 1, path.split('/').filter(Boolean)[0])
    return { acquired: false }
  }
  if (!response.ok) throw new Error('FIRESTORE_LEASE_READ_FAILED')
  recordFirestoreRead('leaseRead', 1, path.split('/').filter(Boolean)[0])
  const raw = await response.json() as FirestoreDocument & { updateTime?: string }
  const current = unpack(raw)
  const lockedAt = Date.parse(String(current.lockedAt || ''))
  if (Number.isFinite(lockedAt) && Date.now() - lockedAt < ttlMs) {
    return { acquired: false, currentRunId: String(current.runId || '') }
  }
  if (!raw.updateTime) throw new Error('FIRESTORE_LEASE_VERSION_MISSING')
  const replaced = await request(documentUrl('').replace(/\/$/, '') + ':commit', {
    method: 'POST', body: JSON.stringify({ writes: [{ update: {
      name: url.split('/v1/')[1], ...payload(),
    }, currentDocument: { updateTime: raw.updateTime } }] }),
  })
  if (replaced.ok) return { acquired: true, currentRunId: runId }
  if ([409, 412].includes(replaced.status)) return { acquired: false }
  throw new Error('FIRESTORE_LEASE_REPLACE_FAILED')
}

/** Conditional delete cannot remove a lease taken over by another worker. */
export async function releaseFirestoreLease(path: string, runId: string): Promise<boolean> {
  const url = documentUrl(path)
  const response = await request(url)
  if (response.status === 429) throw new FirestoreQuotaError()
  if (response.status === 404) {
    recordFirestoreRead('leaseRead', 1, path.split('/').filter(Boolean)[0])
    return false
  }
  if (!response.ok) throw new Error('FIRESTORE_LEASE_READ_FAILED')
  recordFirestoreRead('leaseRead', 1, path.split('/').filter(Boolean)[0])
  const raw = await response.json() as FirestoreDocument & { updateTime?: string }
  const current = unpack(raw)
  if (current.runId !== runId) return false
  if (!raw.updateTime) throw new Error('FIRESTORE_LEASE_VERSION_MISSING')
  const removed = await request(documentUrl('').replace(/\/$/, '') + ':commit', {
    method: 'POST', body: JSON.stringify({ writes: [{ delete: url.split('/v1/')[1], currentDocument: { updateTime: raw.updateTime } }] }),
  })
  if ([409, 412, 404].includes(removed.status)) return false
  if (!removed.ok) throw new Error('FIRESTORE_LEASE_RELEASE_FAILED')
  return true
}
export async function deleteDocument(path: string) {
  const response = await request(documentUrl(path), { method: 'DELETE' })
  if (!response.ok && response.status !== 404)
    throw new Error('FIRESTORE_DELETE_FAILED')
}
/** Indexed single-field lookup avoids unsafe partial 200-record collection scans. */
export async function queryDocumentsByField(
  collection: string,
  field: string,
  value: string,
  maxResults = 50,
) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field) ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(collection) ||
      typeof value !== 'string' || !value.trim()) {
    throw new Error('INVALID_FIRESTORE_LOOKUP')
  }
  const response = await request(documentUrl('').replace(/\/$/, '') + ':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: encode(value),
          },
        },
        limit: Math.max(1, Math.min(100, maxResults)),
      },
    }),
  })
  if (response.status === 429) throw new FirestoreQuotaError()
  if (!response.ok) throw new Error('FIRESTORE_LOOKUP_FAILED')
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  const docs = rows.flatMap(row => row.document ? [unpack(row.document)] : [])
  recordFirestoreRead('runQuery', Math.max(1, docs.length), collection)
  return docs
}

/**
 * Server-side scoped query for current-day queue snapshots. Do not read only
 * the first 200 unrelated historical appointments and then filter in memory.
 */
export async function queryDocumentsByFields(
  collection: string,
  conditions: Record<string, string>,
  maxResults = 250,
) {
  const fields = Object.entries(conditions)
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(collection) ||
      fields.length < 2 || fields.length > 4 ||
      fields.some(([field, value]) =>
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field) ||
        typeof value !== 'string' || !value)) {
    throw new Error('INVALID_FIRESTORE_SCOPED_LOOKUP')
  }
  const response = await request(documentUrl('').replace(/\/$/, '') + ':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: fields.map(([field, value]) => ({
              fieldFilter: {
                field: { fieldPath: field },
                op: 'EQUAL',
                value: encode(value),
              },
            })),
          },
        },
        limit: Math.max(1, Math.min(500, Math.floor(maxResults))),
      },
    }),
  })
  if (response.status === 429) throw new FirestoreQuotaError()
  if (!response.ok) throw new Error('FIRESTORE_SCOPED_LOOKUP_FAILED')
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  const docs = rows.flatMap(row => row.document ? [unpack(row.document)] : [])
  recordFirestoreRead('runQuery', Math.max(1, docs.length), collection)
  return docs
}

export async function queryDocuments(collection: string, approvedOnly = false) {
  let quotaExceeded = false
  // 1. Attempt structured runQuery (without remote composite orderBy to avoid missing-index errors)
  try {
    const url = documentUrl('').replace(/\/$/, '') + ':runQuery'
    const response = await request(url, {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          ...(approvedOnly
            ? {
                where: {
                  fieldFilter: {
                    field: { fieldPath: 'approved' },
                    op: 'EQUAL',
                    value: { booleanValue: true },
                  },
                },
              }
            : {}),
          limit: 200,
        },
      }),
    })
    if (response.status === 429) {
      quotaExceeded = true
    } else if (response.ok) {
      const rows = (await response.json()) as {
        document?: FirestoreDocument
      }[]
      const docs = rows.flatMap((row) => (row.document ? [unpack(row.document)] : []))
      recordFirestoreRead('runQuery', Math.max(1, docs.length), collection)
      docs.sort((a, b) => {
        const timeA = new Date(String(a.createdAt || 0)).getTime()
        const timeB = new Date(String(b.createdAt || 0)).getTime()
        return timeB - timeA
      })
      return docs
    }
  } catch (err) {
    console.warn(`[firebase-rest] runQuery failed for collection ${collection}, trying list fallback:`, err)
  }

  if (quotaExceeded) {
    throw new FirestoreQuotaError()
  }

  // 2. Direct Collection List Fallback (Standard Firestore REST endpoint, requires 0 indexes)
  try {
    const listUrl = documentUrl(collection) + '?pageSize=200'
    const listResponse = await request(listUrl)
    if (listResponse.status === 429) {
      quotaExceeded = true
    } else if (listResponse.ok) {
      const data = (await listResponse.json()) as { documents?: FirestoreDocument[] }
      let docs = (data.documents || []).map(unpack)
      recordFirestoreRead('listDocuments', Math.max(1, docs.length), collection)
      if (approvedOnly) {
        docs = docs.filter((d) => d.approved === true)
      }
      docs.sort((a, b) => {
        const timeA = new Date(String(a.createdAt || 0)).getTime()
        const timeB = new Date(String(b.createdAt || 0)).getTime()
        return timeB - timeA
      })
      return docs
    }
  } catch (err) {
    console.error(`[firebase-rest] listDocuments fallback failed for collection ${collection}:`, err)
  }

  if (quotaExceeded) {
    throw new FirestoreQuotaError()
  }

  throw new Error('FIRESTORE_QUERY_FAILED')
}

/** Upsert only supplied fields. Used for bounded medicine batches (<= 100 writes). */
export async function upsertDocumentBatch(patches: Array<{ path: string; data: Fields }>) {
  if (!patches.length) return
  if (patches.length > 100) throw new Error('FIRESTORE_BATCH_TOO_LARGE')
  const writes = patches.map(({ path, data }) => ({
    update: { name: documentUrl(path).split('/v1/')[1], fields: encode(data).mapValue?.fields || {} },
    updateMask: { fieldPaths: Object.keys(data) },
  }))
  const res = await request(documentUrl('').replace(/\/$/, '') + ':commit', {
    method: 'POST', body: JSON.stringify({ writes }),
  })
  if (!res.ok) throw new Error('FIRESTORE_BATCH_UPSERT_FAILED')
}

/** Retrieve a whole batch without one HTTP round trip per medicine. */
export async function readDocumentBatch(paths: string[]) {
  if (!paths.length) return new Map<string, Fields>()
  if (paths.length > 100) throw new Error('FIRESTORE_BATCH_TOO_LARGE')
  const res = await request(documentUrl('').replace(/\/$/, '') + ':batchGet', {
    method: 'POST', body: JSON.stringify({ documents: paths.map(p => documentUrl(p).split('/v1/')[1]) }),
  })
  if (res.status === 429) throw new FirestoreQuotaError()
  if (!res.ok) throw new Error('FIRESTORE_BATCH_READ_FAILED')
  const rows = await res.json() as Array<{ found?: FirestoreDocument }>
  recordFirestoreRead('readDocumentBatch', Math.max(1, rows.length), paths[0]?.split('/').filter(Boolean)[0])
  const docs = new Map<string, Fields>()
  for (const row of rows) if (row.found) docs.set(String(row.found.name.split('/').pop()), unpack(row.found))
  return docs
}
