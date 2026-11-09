/**
 * Cryptographic helpers for password hashing, session tokens, and signed record access.
 * Fully compatible with Cloudflare Workers (Web Crypto API) and Node.js.
 * Implements PBKDF2 with unique salts, HMAC-SHA256 tokens, and constant-time comparison.
 */

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim()
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
  }
  return bytes
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function getSessionSigningSecret(): string {
  const configured = process.env.CLINIC_SESSION_SECRET || process.env.AUTH_SECRET
  if (configured && configured.length >= 32) return configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CLINIC_SESSION_SECRET_REQUIRED_IN_PRODUCTION')
  }
  return 'clinic-os-v2-default-session-secret-key-32chars!'
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSessionSigningSecret()
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Modern PBKDF2 Password Hashing with 100,000 iterations and unique 16-byte random salt.
 * Stored format: pbkdf2:100000:<saltHex>:<hashHex>
 */
export async function hashPassword(password: string, customSaltHex?: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = customSaltHex
    ? hexToBytes(customSaltHex)
    : crypto.getRandomValues(new Uint8Array(16))

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  )

  const actualSaltHex = bytesToHex(salt)
  const hashHex = bytesToHex(new Uint8Array(derived))
  return `pbkdf2:100000:${actualSaltHex}:${hashHex}`
}

/**
 * Verify a password against a stored hash.
 * Supports modern PBKDF2 and backward-compatible verification for legacy SHA-256 hashes.
 * Plaintext passwords are NEVER accepted.
 */
export async function verifyPassword(providedPassword: string, storedHash: string): Promise<boolean> {
  if (!providedPassword || !storedHash) return false

  // 1. Modern PBKDF2 hash verification
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':')
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10) || 100000
      const saltHex = parts[2]
      const expectedHashHex = parts[3]

      const enc = new TextEncoder()
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(providedPassword),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      )

      const derived = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: hexToBytes(saltHex) as unknown as ArrayBuffer,
          iterations,
          hash: 'SHA-256'
        },
        passwordKey,
        256
      )

      const computedHex = bytesToHex(new Uint8Array(derived))
      return constantTimeCompare(computedHex, expectedHashHex)
    }
  }

  // 2. Backward compatibility with legacy SHA-256 hashes (64 hex characters)
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const enc = new TextEncoder()
    const legacySalt = process.env.AUTH_SECRET || 'clinic-os-v2-secure-cairo-salt-key-2026'
    const data = enc.encode(`${legacySalt}:${providedPassword}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const computedLegacy = bytesToHex(new Uint8Array(hashBuffer))
    return constantTimeCompare(computedLegacy.toLowerCase(), storedHash.toLowerCase())
  }

  // Plaintext fallback is permanently disabled
  return false
}

/**
 * Create a cryptographically signed HMAC-SHA256 session token.
 */
export async function createSessionToken(payload: {
  role: 'owner' | 'doctor' | 'assistant' | 'patient'
  email?: string
  username?: string
  phone?: string
  name: string
  clinicId: string
  slug?: string
  patientId?: string
  branchId?: string
  branchName?: string
  mustChangePassword?: boolean
  credentialsVersion?: number
}): Promise<string> {
  const data = {
    ...payload,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  }

  const json = JSON.stringify(data)
  const base64Data = btoa(unescape(encodeURIComponent(json)))
  const enc = new TextEncoder()

  const hmacKey = await getHmacKey()
  const sigBuffer = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(base64Data))
  const signature = bytesToHex(new Uint8Array(sigBuffer))

  return `${base64Data}.${signature}`
}

/**
 * Verify an HMAC-SHA256 session token using timing-safe verification.
 */
export async function verifySessionToken(token: string): Promise<{
  valid: boolean
  payload?: any
  error?: string
}> {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'INVALID_TOKEN_FORMAT' }
  }

  try {
    const [base64Data, signatureHex] = token.split('.')
    if (!base64Data || !signatureHex) {
      return { valid: false, error: 'MALFORMED_TOKEN' }
    }

    const enc = new TextEncoder()
    const hmacKey = await getHmacKey()
    const signatureBytes = hexToBytes(signatureHex)

    const isValid = await crypto.subtle.verify(
      'HMAC',
      hmacKey,
      signatureBytes as unknown as ArrayBuffer,
      enc.encode(base64Data)
    )

    if (!isValid) {
      return { valid: false, error: 'SIGNATURE_MISMATCH' }
    }

    const json = decodeURIComponent(escape(atob(base64Data)))
    const payload = JSON.parse(json)

    if (!Number.isFinite(payload.expiresAt) || !Number.isFinite(payload.issuedAt) ||
        payload.issuedAt > Date.now() + 60000 || Date.now() > payload.expiresAt) {
      return { valid: false, error: 'TOKEN_EXPIRED' }
    }

    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, error: err.message || 'PARSE_ERROR' }
  }
}

/**
 * Create a temporary signed share token for invoices and prescriptions.
 * Allows patients to view/print via WhatsApp or SMS links without logging in.
 */
export async function createShareToken(options: {
  clinicId: string
  recordId: string
  type: 'invoice' | 'prescription'
  expiresInHours?: number
}): Promise<string> {
  const { clinicId, recordId, type, expiresInHours = 168 } = options // default 7 days
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000

  const payload = `${clinicId}:${recordId}:${type}:${expiresAt}`
  const enc = new TextEncoder()
  const hmacKey = await getHmacKey()
  const sigBuffer = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(payload))
  const sigHex = bytesToHex(new Uint8Array(sigBuffer)).slice(0, 32)

  const tokenData = btoa(`${payload}:${sigHex}`)
  return tokenData
}

/**
 * Verify a temporary signed share token.
 */
export async function verifyShareToken(
  token: string,
  expected: {
    clinicId: string
    recordId: string
    type: 'invoice' | 'prescription'
  }
): Promise<boolean> {
  if (!token) return false
  try {
    const raw = atob(token)
    const parts = raw.split(':')
    if (parts.length !== 5) return false

    const [tClinicId, tRecordId, tType, tExpiresAtStr, tSigHex] = parts
    const expiresAt = parseInt(tExpiresAtStr, 10)

    if (Date.now() > expiresAt) return false
    if (tClinicId !== expected.clinicId) return false
    if (tRecordId !== expected.recordId) return false
    if (tType !== expected.type) return false

    const payload = `${tClinicId}:${tRecordId}:${tType}:${tExpiresAtStr}`
    const enc = new TextEncoder()
    const hmacKey = await getHmacKey()
    const sigBuffer = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(payload))
    const expectedSigHex = bytesToHex(new Uint8Array(sigBuffer)).slice(0, 32)

    return constantTimeCompare(expectedSigHex, tSigHex)
  } catch {
    return false
  }
}
