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
let cachedToken: { value: string; expires: number } | undefined
let pendingToken: Promise<string> | undefined

export function getFirebaseServerCredentials() {
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
    account.project_id
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
export async function signServiceJwt(payload: Record<string, unknown>) {
  const { key } = getFirebaseServerCredentials()
  const body =
    base64url(
      new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    ) +
    '.' +
    base64url(new TextEncoder().encode(JSON.stringify(payload)))
  const der = Uint8Array.from(
    atob(key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
    (c) => c.charCodeAt(0),
  )
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(body),
  )
  return body + '.' + base64url(new Uint8Array(signature))
}
export async function googleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60000)
    return cachedToken.value
  if (pendingToken) return pendingToken
  pendingToken = (async () => {
    const { email } = getFirebaseServerCredentials(),
      now = Math.floor(Date.now() / 1000)
    const assertion = await signServiceJwt({
      iss: email,
      scope: 'https://www.googleapis.com/auth/datastore',
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
    cachedToken = {
      value: data.access_token,
      expires: Date.now() + Number(data.expires_in || 3600) * 1000,
    }
    return data.access_token
  })().finally(() => {
    pendingToken = undefined
  })
  return pendingToken
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
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${path.split('/').map(encodeURIComponent).join('/')}`
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
  const response = await request(documentUrl(path))
  if (response.status === 404) return null
  if (!response.ok) throw new Error('FIRESTORE_READ_FAILED')
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
export async function deleteDocument(path: string) {
  const response = await request(documentUrl(path), { method: 'DELETE' })
  if (!response.ok && response.status !== 404)
    throw new Error('FIRESTORE_DELETE_FAILED')
}
export async function queryDocuments(collection: string, approvedOnly = false) {
  // 1. Attempt structured runQuery (without remote composite orderBy to avoid missing-index errors)
  try {
    const url = documentUrl('') + ':runQuery'
    const response = await request(url.replace('/documents/:', '/documents:'), {
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
    if (response.ok) {
      const rows = (await response.json()) as {
        document?: FirestoreDocument
      }[]
      const docs = rows.flatMap((row) => (row.document ? [unpack(row.document)] : []))
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

  // 2. Direct Collection List Fallback (Standard Firestore REST endpoint, requires 0 indexes)
  try {
    const listUrl = documentUrl(collection) + '?pageSize=200'
    const listResponse = await request(listUrl)
    if (listResponse.ok) {
      const data = (await listResponse.json()) as { documents?: FirestoreDocument[] }
      let docs = (data.documents || []).map(unpack)
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

  throw new Error('FIRESTORE_QUERY_FAILED')
}
