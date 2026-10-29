/**
 * Cryptographic helpers for password hashing and session tokens.
 * Fully compatible with Cloudflare Workers (Web Crypto API) and Node.js.
 */

const AUTH_SALT_SECRET = process.env.AUTH_SECRET || 'clinic-os-v2-secure-cairo-salt-key-2026'

/**
 * Hash a password with salt using SHA-256 via Web Crypto API.
 */
export async function hashPassword(password: string, salt: string = AUTH_SALT_SECRET): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(`${salt}:${password}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify a password against a stored hash (or legacy plaintext with auto-detection).
 */
export async function verifyPassword(providedPassword: string, storedHashOrPlain: string): Promise<boolean> {
  if (!providedPassword || !storedHashOrPlain) return false

  // Check if matches as hash
  const computedHash = await hashPassword(providedPassword)
  if (computedHash === storedHashOrPlain) return true

  // Legacy fallback: if stored value is still plain-text, verify direct match
  if (providedPassword === storedHashOrPlain) return true

  return false
}

/**
 * Create a signed session token.
 */
export async function createSessionToken(payload: {
  role: 'owner' | 'doctor' | 'assistant' | 'patient'
  email?: string
  phone?: string
  name: string
  clinicId: string
  slug?: string
  patientId?: string
  branchId?: string
  branchName?: string
  mustChangePassword?: boolean
}): Promise<string> {
  const data = {
    ...payload,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  }

  const json = JSON.stringify(data)
  const base64Data = btoa(unescape(encodeURIComponent(json)))
  const enc = new TextEncoder()
  const signatureBuffer = await crypto.subtle.digest('SHA-256', enc.encode(`${base64Data}:${AUTH_SALT_SECRET}`))
  const sigArray = Array.from(new Uint8Array(signatureBuffer))
  const signature = sigArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)

  return `${base64Data}.${signature}`
}

/**
 * Verify a session token.
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
    const [base64Data, signature] = token.split('.')
    const enc = new TextEncoder()
    const signatureBuffer = await crypto.subtle.digest('SHA-256', enc.encode(`${base64Data}:${AUTH_SALT_SECRET}`))
    const sigArray = Array.from(new Uint8Array(signatureBuffer))
    const expectedSig = sigArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)

    if (signature !== expectedSig) {
      return { valid: false, error: 'SIGNATURE_MISMATCH' }
    }

    const json = decodeURIComponent(escape(atob(base64Data)))
    const payload = JSON.parse(json)

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return { valid: false, error: 'TOKEN_EXPIRED' }
    }

    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, error: err.message || 'PARSE_ERROR' }
  }
}
