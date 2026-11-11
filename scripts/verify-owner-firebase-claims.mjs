/**
 * Read-only by default. Checks platform-owner custom claims against the
 * Firestore isPlatformOwner() policy. Only --apply changes Firebase Auth.
 *
 * Run from an authorized local environment containing Firebase service
 * account credentials and PLATFORM_OWNER_UID. Never share or commit secrets.
 *
 *   node --env-file=.env.local scripts/verify-owner-firebase-claims.mjs
 *   node --env-file=.env.local scripts/verify-owner-firebase-claims.mjs --apply
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const expectedProject = 'clinic-os-d2d1b'
const expectedEmail = 'yallacodex@gmail.com'

function serverCredentials() {
  let json = {}
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    } catch {
      throw Error('SERVICE_ACCOUNT_JSON_INVALID')
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || json.project_id
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || json.client_email
  const key = process.env.FIREBASE_PRIVATE_KEY || json.private_key
  const privateKey = typeof key === 'string' ? key.replace(/\\n/g, '\n') : ''
  if (projectId !== expectedProject || (json.project_id && json.project_id !== projectId)) {
    throw Error('FIREBASE_PROJECT_MISMATCH')
  }
  if (!clientEmail || !privateKey || (json.client_email && json.client_email !== clientEmail)) {
    throw Error('FIREBASE_SERVICE_ACCOUNT_NOT_CONFIGURED')
  }
  return { projectId, clientEmail, privateKey }
}

async function main() {
  const uid = process.env.PLATFORM_OWNER_UID
  if (!uid || uid.length > 128) throw Error('PLATFORM_OWNER_UID_REQUIRED')
  const credential = serverCredentials()
  initializeApp({ credential: cert(credential), projectId: expectedProject })
  const client = getAuth()
  const owner = await client.getUser(uid)
  if (owner.email?.trim().toLowerCase() !== expectedEmail ||
      !owner.emailVerified || owner.disabled) {
    throw Error('OWNER_IDENTITY_MISMATCH_OR_EMAIL_NOT_VERIFIED')
  }
  const original = owner.customClaims || {}
  const needed = {
    platformOwner: true, ownerEmail: expectedEmail, ownerUid: uid,
  }
  const ready = original.platformOwner === true &&
    original.ownerEmail === needed.ownerEmail && original.ownerUid === uid
  if (!ready && process.argv.includes('--apply')) {
    await client.setCustomUserClaims(uid, { ...original, ...needed })
    console.log('CLAIMS_UPDATED: true. Sign out, then sign back in to refresh the ID token.')
  } else {
    console.log(`PROJECT_OK: true; OWNER_VERIFIED: true; OWNER_CLAIMS_READY: ${ready}`)
    if (!ready) console.log('Run this same script with --apply ONLY after confirming the owner identity.')
  }
}

main().catch(error => {
  // Do not log request bodies, private keys, user objects, access tokens or UIDs.
  const code = error instanceof Error ? error.message : 'UNKNOWN'
  const safeCodes = new Set([
    'SERVICE_ACCOUNT_JSON_INVALID', 'FIREBASE_PROJECT_MISMATCH',
    'FIREBASE_SERVICE_ACCOUNT_NOT_CONFIGURED', 'PLATFORM_OWNER_UID_REQUIRED',
    'OWNER_IDENTITY_MISMATCH_OR_EMAIL_NOT_VERIFIED',
  ])
  console.error(safeCodes.has(code) ? code : 'FIREBASE_CLAIMS_VERIFICATION_FAILED')
  process.exitCode = 1
})
