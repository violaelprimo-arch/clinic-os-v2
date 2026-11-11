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
