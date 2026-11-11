import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('staff branch widgets never try to create branches from a browser Firebase session', () => {
  const selector = read('src/components/clinic/BranchSelector.tsx')
  const booking = read('src/components/clinic/InClinicBookingView.tsx')
  const service = read('src/lib/branchService.ts')
  assert.doesNotMatch(selector, /ensureClinicHasMainBranch\(clinic\)/)
  assert.doesNotMatch(booking, /ensureClinicHasMainBranch\(clinic\)/)
  assert.doesNotMatch(service, /await addDoc\(branchesRef/)
  assert.match(service, /CLINIC_HAS_NO_REGISTERED_BRANCH/)
  assert.match(service, /Array\.isArray\(data\.branches\)/)
})

test('owner platform credentials stay behind a session-protected server API', () => {
  const owner = read('src/app/owner/OwnerDashboardClient.tsx')
  const route = read('src/app/api/owner/platform-config/route.ts')
  assert.doesNotMatch(owner, /getDocs\(collection\(db, 'system'\)\)/)
  assert.doesNotMatch(owner, /setDoc\(doc\(db, 'system', 'config'\)/)
  assert.match(owner, /fetch\('\/api\/owner\/platform-config'/)
  assert.match(route, /await requireOwner\(request\)/)
  assert.match(route, /readDocument\('system\/config'\)/)
  assert.match(route, /writeDocument\('system\/config'/)
  assert.match(route, /hasGlobalAiKey/)
  assert.doesNotMatch(route, /globalAiKey:\s*config\.globalAiKey/)
  assert.doesNotMatch(route, /resendApiKey:\s*config\.resendApiKey/)
  assert.match(route, /if \(ai\) secretChanges\.globalAiKey = ai/)
  assert.match(route, /if \(resend\) secretChanges\.resendApiKey = resend/)
})

test('firebase readiness probe is owner-only and does not disclose private credentials', () => {
  const route = read('src/app/api/owner/firebase-status/route.ts')
  assert.match(route, /await requireOwner\(request\)/)
  assert.match(route, /getFirebaseServerCredentials\(\)/)
  assert.match(route, /await readDocument\('system\/platformSettings'\)/)
  assert.match(route, /credentialsConfigured/)
  assert.match(route, /firestoreReachable/)
  assert.doesNotMatch(route, /privateKey:/)
  assert.doesNotMatch(route, /access_token:/)
})

test('owner token claims match Firestore owner rules before issuing the owner session', () => {
  const verifier = read('src/lib/server/firebase-owner-auth.ts')
  const api = read('src/app/api/auth/owner-login/route.ts')
  assert.match(verifier, /claims\.platformOwner !== true/)
  assert.match(verifier, /claims\.ownerUid !== ownerUid/)
  assert.match(verifier, /claims\.ownerEmail !== OWNER_EMAIL/)
  assert.match(verifier, /claims\.email_verified !== true/)
  assert.match(api, /OWNER_FIREBASE_CLAIMS_REQUIRED/)
  const script = read('scripts/verify-owner-firebase-claims.mjs')
  assert.match(script, /process\.argv\.includes\('--apply'\)/)
  assert.match(script, /OWNER_IDENTITY_MISMATCH_OR_EMAIL_NOT_VERIFIED/)
})

test('doctor dashboard and TV share a scoped authenticated queue source', () => {
  const dashboard = read('src/components/clinic/AdminDashboard.tsx')
  const endpoint = read('src/app/api/clinic/[slug]/appointments/day/route.ts')
  const tv = read('src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx')
  assert.ok(dashboard.includes('/appointments/day?date='))
  assert.ok(dashboard.includes('setQueueLoadError('))
  assert.ok(!dashboard.includes('onSnapshot(\\n      q,\\n      (snapshot)'))
  assert.ok(endpoint.includes('await getCurrentClinicStaff(req, slug)'))
  assert.ok(endpoint.includes("queryDocumentsByFields('appointments'"))
  assert.ok(endpoint.includes("staff.user.role === 'assistant'"))
  assert.ok(endpoint.includes('QUEUE_RESULT_LIMIT_REACHED'))
  assert.ok(tv.includes('queue?tv=1'))
})
