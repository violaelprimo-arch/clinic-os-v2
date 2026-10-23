// Run locally with firebase-admin installed and GOOGLE_APPLICATION_CREDENTIALS
// pointed at the project's service-account JSON. Never commit credentials.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const projectId = 'clinic-os-d2d1b'
const expectedEmail = 'yallacodex@gmail.com'
const uid = process.env.OWNER_UID

if (!uid || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw Error('OWNER_UID and GOOGLE_APPLICATION_CREDENTIALS are required')
}

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
console.log('Owner claims configured:', {
  uid: updated.uid,
  platformOwner: updated.customClaims?.platformOwner,
  ownerUidMatches: updated.customClaims?.ownerUid === uid,
})
