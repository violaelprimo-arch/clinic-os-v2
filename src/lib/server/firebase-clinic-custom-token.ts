import 'server-only'
import { getFirebaseServerCredentials, signServiceJwt } from '@/lib/server/firebase-rest'

/**
 * Integrates the existing username/password verifier with Firebase Authentication.
 * A verified clinic identity receives a short-lived Firebase custom token.
 *
 * Username is an alias in Firestore; it is NOT an email and is never
 * fabricated as an actual patient/staff mailbox.
 *
 * Do not grant tenant-wide custom claims here: legacy clinic documents still
 * contain credential hashes and must not be exposed via Firestore client SDK.
 * Tenant data access remains behind the existing scoped server APIs.
 */
export async function createClinicFirebaseCustomToken(args: {
  clinicId: string
  role: 'doctor' | 'assistant'
  accountKey: string
}): Promise<string> {
  const { email } = getFirebaseServerCredentials()
  const accountKey = args.accountKey.trim().toLowerCase()
  if (!args.clinicId || args.clinicId.length > 256 ||
      !accountKey || accountKey.length > 254 ||
      !['doctor', 'assistant'].includes(args.role)) {
    throw new Error('INVALID_CLINIC_AUTH_IDENTITY')
  }

  // Stable, tenant-scoped Firebase UID, safe even with legacy Firestore IDs.
  const digest = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`${args.clinicId}\u0000${args.role}\u0000${accountKey}`))
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  const uid = `clinic_${args.role}_${hex.slice(0, 48)}`
  const now = Math.floor(Date.now() / 1000)

  return signServiceJwt({
    iss: email,
    sub: email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
    claims: { clinicRole: args.role, clinic_id: args.clinicId }
  })
}
