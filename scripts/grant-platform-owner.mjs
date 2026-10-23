// Run locally with firebase-admin installed and GOOGLE_APPLICATION_CREDENTIALS
// pointed at the project's service-account JSON. Never commit credentials.
import { readFile } from 'node:fs/promises'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const projectId = 'clinic-os-d2d1b'
const expectedEmail = 'yallacodex@gmail.com'
const uid = process.env.OWNER_UID
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!uid || !credentialsPath) {
  throw Error('OWNER_UID and GOOGLE_APPLICATION_CREDENTIALS are required')
}

let credentials
try {
  credentials = JSON.parse(await readFile(credentialsPath, 'utf8'))
} catch {
  throw Error('FIREBASE_CREDENTIALS_INVALID')
}
if (
  credentials?.type !== 'service_account' ||
  credentials.project_id !== projectId
) throw Error('FIREBASE_CREDENTIAL_PROJECT_MISMATCH')

initializeApp({ credential: applicationDefault(), projectId })
const auth = getAuth()
const user = await auth.getUser(uid)

if (
  user.email?.toLowerCase() !== expectedEmail ||
  !user.emailVerified ||
  user.disabled
) throw Error('Expected verified, enabled owner email and exact UID')

await auth.setCustomUserClaims(uid, {
  ...(user.customClaims || {}),
  platformOwner: true,
  ownerUid: uid,
  ownerEmail: expectedEmail,
})

const updated = await auth.getUser(uid)
if (
  updated.uid !== uid ||
  updated.email?.toLowerCase() !== expectedEmail ||
  updated.disabled ||
  !updated.emailVerified ||
  updated.customClaims?.platformOwner !== true ||
  updated.customClaims?.ownerUid !== uid ||
  updated.customClaims?.ownerEmail !== expectedEmail
) throw Error('OWNER_CLAIMS_VERIFICATION_FAILED')

console.log('Owner claims configured:', {
  uid: updated.uid,
  emailVerified: updated.emailVerified,
  enabled: !updated.disabled,
  platformOwner: updated.customClaims.platformOwner,
  ownerUidMatches: updated.customClaims.ownerUid === uid,
  ownerEmailMatches: updated.customClaims.ownerEmail === expectedEmail,
})
