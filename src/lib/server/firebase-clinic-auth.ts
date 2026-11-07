import 'server-only'

type Claims = {
  aud?: string
  iss?: string
  sub?: string
  iat?: number
  exp?: number
  auth_time?: number
  firebase?: { sign_in_provider?: string }
}

function decodeClaims(token: string): Claims {
  if (token.length > 8192 || token.split('.').length !== 3) throw new Error('GOOGLE_TOKEN_INVALID')
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))) as Claims
  } catch {
    throw new Error('GOOGLE_TOKEN_INVALID')
  }
}

/**
 * Firebase Identity Toolkit validates signature, revocation, expiration and
 * account existence before the server trusts any claims or email.
 */
export async function verifyClinicGoogleIdToken(idToken: unknown): Promise<{ uid: string; email: string }> {
  if (typeof idToken !== 'string') throw new Error('GOOGLE_TOKEN_INVALID')
  const project = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!project || !apiKey) throw new Error('FIREBASE_SETUP_REQUIRED')
  const claims = decodeClaims(idToken)
  const now = Math.floor(Date.now() / 1000)
  if (claims.aud !== project ||
      claims.iss !== `https://securetoken.google.com/${project}` ||
      !claims.sub || !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) ||
      Number(claims.iat) > now + 60 || Number(claims.exp) <= now) {
    throw new Error('GOOGLE_TOKEN_INVALID')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
  if (!response.ok) throw new Error('GOOGLE_TOKEN_INVALID')
  const body = await response.json() as {
    users?: Array<{
      localId?: string
      email?: string
      emailVerified?: boolean
      disabled?: boolean
      validSince?: string
      providerUserInfo?: Array<{ providerId?: string }>
    }>
  }
  const account = body.users?.[0]
  if (!account || account.disabled || account.localId !== claims.sub ||
      !account.email || account.emailVerified !== true ||
      !account.providerUserInfo?.some((p) => p.providerId === 'google.com') ||
      (account.validSince && Number(claims.iat) < Number(account.validSince))) {
    throw new Error('GOOGLE_ACCOUNT_NOT_VERIFIED')
  }
  return { uid: account.localId, email: account.email.trim().toLowerCase() }
}
