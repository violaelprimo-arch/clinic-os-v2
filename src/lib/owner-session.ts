// Server callers supply a secret. This module never embeds a fallback signing key.
export const OWNER_COOKIE = 'owner_session'
export const OWNER_EMAIL = 'yallacodex@gmail.com'
const encoder = new TextEncoder()
function to64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
function from64(text: string) {
  return Uint8Array.from(
    atob(text.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
}
async function signingKey(secret: string) {
  if (secret.length < 32) throw new Error('OWNER_SESSION_SECRET_NOT_CONFIGURED')
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}
export async function createOwnerSession(email: string, secret: string) {
  const payload = to64(
    encoder.encode(
      JSON.stringify({
        role: 'owner',
        email,
        audience: 'yalla-owner',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 7 * 86400000,
      }),
    ),
  )
  return (
    payload +
    '.' +
    to64(
      new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          await signingKey(secret),
          encoder.encode(payload),
        ),
      ),
    )
  )
}
export async function verifyOwnerSession(
  token: string,
  secret: string,
): Promise<{ email: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2 || token.length > 4096) return null
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      from64(parts[1]),
      encoder.encode(parts[0]),
    )
    if (!valid) return null
    const data = JSON.parse(new TextDecoder().decode(from64(parts[0])))
    if (
      data.role !== 'owner' ||
      data.audience !== 'yalla-owner' ||
      data.email !== OWNER_EMAIL ||
      !Number.isFinite(data.expiresAt) ||
      !Number.isFinite(data.issuedAt) ||
      data.expiresAt <= Date.now() ||
      data.issuedAt > Date.now() + 60000
    )
      return null
    return { email: data.email }
  } catch {
    return null
  }
}
export async function hashOwnerPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iterations = 210000
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${iterations}$${to64(salt)}$${to64(new Uint8Array(hash))}`
}
export async function verifyOwnerPassword(password: string, stored: string) {
  if (!stored.startsWith('pbkdf2$')) return false
  try {
    const [, count, salt, digest] = stored.split('$'),
      iterations = Number(count)
    if (iterations < 100000 || iterations > 1000000) return false
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const actual = new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: from64(salt), iterations, hash: 'SHA-256' },
          key,
          256,
        ),
      ),
      expected = from64(digest)
    if (actual.length !== expected.length) return false
    let difference = 0
    for (let i = 0; i < actual.length; i++)
      difference |= actual[i] ^ expected[i]
    return difference === 0
  } catch {
    return false
  }
}
