import 'server-only'
import { OWNER_EMAIL } from '@/lib/owner-session'

// Firebase Auth's accounts:lookup endpoint validates the user's Firebase ID token.
// We additionally bind the verified identity to the exact project, UID, and
// server-issued platformOwner claim. No password or token is stored in Firestore.
type LookupUser = {
  localId?: string
  email?: string
  emailVerified?: boolean
  disabled?: boolean
  validSince?: string
}
type TokenClaims = {
  aud?: string
  iss?: string
  sub?: string
  email?: string
  email_verified?: boolean
  platformOwner?: boolean
  ownerEmail?: string
  iat?: number
  exp?: number
  auth_time?: number
}

function parseClaims(token: string): TokenClaims {
  const parts = token.split('.')
  if (parts.length !== 3 || token.length > 8192) throw Error('OWNER_TOKEN_INVALID')
  const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')
  try {
    return JSON.parse(atob(padded)) as TokenClaims
  } catch {
    throw Error('OWNER_TOKEN_INVALID')
  }
}

export async function verifyFirebaseOwnerIdToken(idToken: unknown) {
  if (typeof idToken !== 'string') throw Error('OWNER_TOKEN_INVALID')
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const ownerUid = process.env.PLATFORM_OWNER_UID
  if (!apiKey || !projectId || !ownerUid || projectId !== 'clinic-os-d2d1b')
    throw Error('OWNER_FIREBASE_SETUP_REQUIRED')

  const claims = parseClaims(idToken)
  const now = Math.floor(Date.now() / 1000)
  if (
    claims.aud !== projectId ||
    claims.iss !== 'https://securetoken.google.com/' + projectId ||
    typeof claims.sub !== 'string' || !claims.sub ||
    claims.sub !== ownerUid ||
    claims.email?.toLowerCase() !== OWNER_EMAIL ||
    claims.platformOwner === false ||
    (claims.ownerEmail && claims.ownerEmail !== OWNER_EMAIL) ||
    !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) ||
    !Number.isFinite(claims.auth_time) ||
    Number(claims.iat) > now + 60 ||
    Number(claims.auth_time) > now + 60 ||
    Number(claims.exp) <= now
  ) throw Error('OWNER_ACCESS_DENIED')

  // Google verifies token signature, expiration, revocation and user existence.
  // The trusted server response must identify the same account as the ID token.
  let response: Response
  try {
    response = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    )
  } catch {
    throw Error('OWNER_AUTH_SERVICE_UNAVAILABLE')
  }
  if (!response.ok) throw Error('OWNER_TOKEN_INVALID')
  const result = (await response.json()) as { users?: LookupUser[] }
  const account = result.users?.[0]
  if (
    !account || account.disabled ||
    account.localId !== ownerUid ||
    account.localId !== claims.sub ||
    account.email?.toLowerCase() !== OWNER_EMAIL ||
    (account.validSince && Number(claims.iat) < Number(account.validSince))
  ) throw Error('OWNER_ACCESS_DENIED')

  return { uid: account.localId, email: OWNER_EMAIL }
}
