import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { acquireFirestoreLease, releaseFirestoreLease, readDocument, upsertDocumentBatch, readDocumentBatch } from '../src/lib/server/firebase-rest.ts'
const emulator = process.env.FIRESTORE_EMULATOR_HOST
if (!emulator) throw new Error('Run this test with the Firestore emulator, never a production project')
const nativeFetch = globalThis.fetch
let sourceFixtures = new Map()
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'demo-clinic-sync-lease',
  client_email: 'test@demo-clinic-sync-lease.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })
process.env.FIREBASE_PROJECT_ID = 'demo-clinic-sync-lease'
delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
// Only the OAuth handshake is mocked. All leases/commits run against an actual
// local Firestore conditional writes with real concurrent HTTP requests.
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (url.startsWith('https://www.dawaagate.com/')) {
    if (!sourceFixtures.has(url)) throw new Error('Unexpected source URL in test')
    return new Response(sourceFixtures.get(url), { status: 200 })
  }
  if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'owner', expires_in: 3600 })
  if (!url.startsWith('https://firestore.googleapis.com/v1/')) throw new Error('Unexpected network destination')
  return nativeFetch(url.replace('https://firestore.googleapis.com', `http://${emulator}`), init)
}
after(() => { globalThis.fetch = nativeFetch })
test('one concurrent owner obtains an atomic lease and nonowners cannot release it', async () => {
  const path = `sync_locks/test-${Date.now()}`
  const ids = Array.from({ length: 8 }, () => crypto.randomUUID())
  const leases = await Promise.all(ids.map(id => acquireFirestoreLease(path, id, 'test', 60000)))
  assert.equal(leases.filter(x => x.acquired).length, 1)
  const owner = ids[leases.findIndex(x => x.acquired)]
  assert.equal(await releaseFirestoreLease(path, 'wrong-owner'), false)
  assert.equal((await readDocument(path)).runId, owner)
  assert.equal(await releaseFirestoreLease(path, owner), true)
  assert.equal(await readDocument(path), null)
})
test('batch price writes preserve other metadata and nonexistent docs are handled explicitly', async () => {
  const path = `market_prices/test-${Date.now()}`
  await upsertDocumentBatch([{ path, data: { price: 150, ingredient: 'fixture' } }])
  await upsertDocumentBatch([{ path, data: { price: 165 } }])
  const docs = await readDocumentBatch([path, 'market_prices/does-not-exist'])
  assert.equal(docs.size, 1)
  assert.equal(docs.get(path.split('/')[1]).price, 165)
  assert.equal(docs.get(path.split('/')[1]).ingredient, 'fixture')
})

test('an expired lease can be taken over and the old owner cannot delete it', async () => {
  const path = `sync_locks/expired-${Date.now()}`
  await upsertDocumentBatch([{ path, data: { runId: 'old-owner', lockedAt: new Date(Date.now() - 120000).toISOString() } }])
  const next = await acquireFirestoreLease(path, 'new-owner', 'test', 60000)
  assert.equal(next.acquired, true)
  assert.equal(await releaseFirestoreLease(path, 'old-owner'), false)
  assert.equal((await readDocument(path)).runId, 'new-owner')
  assert.equal(await releaseFirestoreLease(path, 'new-owner'), true)
})

test('username and email login restore a Firebase identity on a second origin, with account revocation', async () => {
  const { NextRequest } = await import('next/server')
  const { POST: login } = await import('../src/app/api/auth/login/route.ts')
  const { POST: restore } = await import('../src/app/api/auth/session/route.ts')
  const { hashPassword } = await import('../src/lib/auth-crypto.ts')
  const { verify, createPublicKey } = await import('node:crypto')
  process.env.CLINIC_SESSION_SECRET = 'isolated-test-session-key-of-more-than-32-characters'
  const clinicId = `identity-${Date.now()}`
  const slug = clinicId
  const username = `test.${Date.now()}`
  const email = `${username}@example.test`
  const password = 'isolated-fixture-password'
  await upsertDocumentBatch([{ path: `clinics/${clinicId}`, data: {
    slug, doctorUsername: username, doctorEmail: email, doctorName: 'Fixture doctor',
    doctorPasswordHash: await hashPassword(password), isActive: true, credentialsVersion: 0,
  } }])
  const request = (identity, pass) => new NextRequest('http://app.local/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://app.local' },
    body: JSON.stringify({ identifier: identity, password: pass }),
  })
  const response = await login(request(username, password))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.user.clinicId, clinicId)
  assert.ok(!JSON.stringify(data).includes(password))
  const [header, body, signature] = data.firebaseCustomToken.split('.')
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${body}`), createPublicKey(privateKey), Buffer.from(signature, 'base64url')), true)
  const claims = JSON.parse(Buffer.from(body, 'base64url'))
  assert.equal(claims.claims.clinic_id, clinicId)
  assert.equal(claims.claims.clinicRole, 'doctor')
  assert.equal((await login(request(email, password))).status, 200)
  assert.equal((await login(request(username, 'wrong-password'))).status, 401)
  const cookieRequest = () => new NextRequest('http://other-origin.local/api/auth/session', {
    method: 'POST', headers: { Cookie: `clinic_session=${data.token}`, Origin: 'http://other-origin.local' },
  })
  const restored = await restore(cookieRequest())
  assert.equal(restored.status, 200)
  assert.ok((await restored.json()).firebaseCustomToken)
  const { POST: saveSettings } = await import('../src/app/api/clinic/[slug]/settings/route.ts')
  const saveRequest = (token, assistants) => new NextRequest(`http://app.local/api/clinic/${slug}/settings`, {
    method: 'POST', headers: { Cookie: `clinic_session=${token}`, Origin: 'http://app.local', 'Content-Type': 'application/json' },
    body: JSON.stringify({ assistants }),
  })
  const saved = await saveSettings(saveRequest(data.token, [{ id:'a1', username:'fixture.reception', password:'assistant-fixture' }]), { params:Promise.resolve({slug}) })
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).requiresSessionRefresh, true)
  const newToken = saved.cookies.get('clinic_session').value
  const storedAssistant = (await readDocument(`clinics/${clinicId}`)).assistants[0]
  assert.ok(storedAssistant.passwordHash.startsWith('pbkdf2:'))
  assert.equal(storedAssistant.password, undefined)
  assert.equal((await restore(cookieRequest())).status, 401)
  const savedAgain = await saveSettings(saveRequest(newToken, [{ id:'a1', username:'fixture.reception', name:'Edited name' }]), {params:Promise.resolve({slug})})
  assert.equal(savedAgain.status, 200)
  assert.equal((await savedAgain.json()).requiresSessionRefresh, false)
  assert.equal((await readDocument(`clinics/${clinicId}`)).assistants[0].passwordHash, storedAssistant.passwordHash)
  assert.equal((await login(request('fixture.reception', 'assistant-fixture'))).status, 200)
  await upsertDocumentBatch([{ path: `clinics/${clinicId}`, data: { credentialsVersion: 5 } }])
  assert.equal((await restore(cookieRequest())).status, 401)
})

test('targeted refresh persists a real source price without completing the daily job; empty source preserves it', async () => {
  const { runMedicineSync } = await import('../src/lib/server/medicine-sync-service.ts')
  await upsertDocumentBatch([{ path: 'sync_metadata/market_prices', data: { lastSuccessDate: '2000-01-01' } }])
  const url = 'https://www.dawaagate.com/medicine/planchoren-30-capsules'
  sourceFixtures.set(url, '<h1>بلانكورين 30 كبسولة</h1><span class="ddm-price-num">165.00</span>')
  const result = await runMedicineSync({ triggeredBy: 'manual_doctor', query: 'planchoren-30-capsules' })
  assert.equal(result.status, 'COMPLETED')
  assert.equal((await readDocument('market_prices/planchoren30capsules')).price, 165)
  assert.equal((await readDocument('sync_metadata/market_prices')).lastSuccessDate, '2000-01-01')
  sourceFixtures.set(url, '<h1>Maintenance</h1>')
  const failed = await runMedicineSync({ triggeredBy: 'manual_doctor', query: 'planchoren-30-capsules' })
  assert.equal(failed.status, 'FAILED')
  assert.equal((await readDocument('market_prices/planchoren30capsules')).price, 165)
})
test('daily batches persist progress and only mark success after the source cutoff is covered', async () => {
  const { readFile } = await import('node:fs/promises')
  const { runMedicineSync } = await import('../src/lib/server/medicine-sync-service.ts')
  const html = await readFile(new URL('./fixtures/dawaa-price-facts.html', import.meta.url), 'utf8')
  sourceFixtures.set('https://www.dawaagate.com/price-updates?page=1', html)
  sourceFixtures.set('https://www.dawaagate.com/price-updates?page=2', html.replaceAll('9 نوفمبر 2026', '9 نوفمبر 2000').replaceAll('8 نوفمبر 2026', '8 نوفمبر 2000'))
  const partial = await runMedicineSync({ triggeredBy: 'cron', pages: 1 })
  assert.equal(partial.status, 'PARTIAL')
  const progress = await readDocument('sync_metadata/market_prices')
  assert.equal(progress.checkpoint.nextPage, 2)
  assert.equal(progress.lastSuccessDate, '2000-01-01')
  const complete = await runMedicineSync({ triggeredBy: 'cron', pages: 1 })
  assert.equal(complete.status, 'COMPLETED')
  const done = await readDocument('sync_metadata/market_prices')
  assert.equal(done.checkpoint, null)
  assert.equal(done.lastSuccessDate, complete.cairoDate)
})
