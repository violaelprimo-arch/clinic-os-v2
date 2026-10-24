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
export async function createOwnerSession(email: string, uid: string, secret: string) {
  const payload = to64(
    encoder.encode(
      JSON.stringify({
        role: 'owner',
        email,
        uid,
        audience: 'yalla-owner',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
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
): Promise<{ email: string; uid: string } | null> {
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
      typeof data.uid !== 'string' || !data.uid ||
      !Number.isFinite(data.expiresAt) ||
      !Number.isFinite(data.issuedAt) ||
      data.expiresAt <= Date.now() ||
      data.issuedAt > Date.now() + 60000
    )
      return null
    return { email: data.email, uid: data.uid }
  } catch {
    return null
  }
}
