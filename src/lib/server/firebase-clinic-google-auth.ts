import 'server-only'

type GoogleClaims = {
  aud?: string
  iss?: string
  sub?: string
  email?: string
  email_verified?: boolean
  iat?: number
  exp?: number
  auth_time?: number
  firebase?: { sign_in_provider?: string }
}

export async function verifyClinicGoogleIdToken(idToken: unknown): Promise<{ email: string; uid: string }> {
  if (typeof idToken !== 'string' || idToken.length > 8192 || idToken.split('.').length !== 3)
    throw new Error('GOOGLE_TOKEN_INVALID')

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!projectId || !apiKey) throw new Error('GOOGLE_AUTH_NOT_CONFIGURED')

  let claims: GoogleClaims
  try {
    const body = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    claims = JSON.parse(atob(body.padEnd(Math.ceil(body.length / 4) * 4, '=')))
  } catch { throw new Error('GOOGLE_TOKEN_INVALID') }

  const now = Math.floor(Date.now() / 1000)
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
    !claims.sub || !claims.email || claims.email_verified !== true ||
    claims.firebase?.sign_in_provider !== 'google.com' ||
    !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) ||
    !Number.isFinite(claims.auth_time) || Number(claims.iat) > now + 60 ||
    Number(claims.auth_time) > now + 60 || Number(claims.exp) <= now)
    throw new Error('GOOGLE_TOKEN_INVALID')

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }), cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  )
  if (!response.ok) throw new Error('GOOGLE_TOKEN_INVALID')
  const data = (await response.json()) as {
    users?: { localId?: string; email?: string; emailVerified?: boolean; disabled?: boolean; validSince?: string }[]
  }
  const user = data.users?.[0]
  if (!user || user.disabled || user.emailVerified !== true ||
    user.localId !== claims.sub ||
    user.email?.toLowerCase() !== claims.email.toLowerCase() ||
    (user.validSince && Number(claims.iat) < Number(user.validSince)))
    throw new Error('GOOGLE_ACCOUNT_NOT_VERIFIED')

  return { email: user.email.toLowerCase(), uid: user.localId }
}
