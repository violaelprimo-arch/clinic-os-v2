import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getFirebaseServerCredentials,
  firebaseServerConfigured,
} from '../src/lib/server/firebase-rest.ts'

const names = [
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
]
const initial = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
)
function clear() {
  for (const name of names) delete process.env[name]
}
afterEach(() => {
  clear()
  for (const [name, value] of Object.entries(initial))
    if (value !== undefined) process.env[name] = value
})
const fixture = {
  project_id: 'demo-clinic-landing',
  client_email: 'fixture@demo-clinic-landing.iam.gserviceaccount.com',
  private_key: 'fixture-key\\nsecond-line',
}
test('a single private JSON setting supplies Firebase server credentials', () => {
  clear()
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(fixture)
  const data = getFirebaseServerCredentials()
  assert.equal(data.project, fixture.project_id)
  assert.equal(data.email, fixture.client_email)
  assert.equal(data.key, 'fixture-key\nsecond-line')
  assert.equal(firebaseServerConfigured(), true)
})
test('malformed or missing service-account settings fail closed without echoing credentials', () => {
  clear()
  assert.equal(firebaseServerConfigured(), false)
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{private-fixture'
  assert.throws(getFirebaseServerCredentials, {
    message: 'FIREBASE_SERVICE_ACCOUNT_INVALID',
  })
  assert.equal(firebaseServerConfigured(), false)
})
test('a service account for another project or email is rejected', () => {
  clear()
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(fixture)
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'different-project'
  assert.throws(getFirebaseServerCredentials, {
    message: 'FIREBASE_PROJECT_MISMATCH',
  })
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  process.env.FIREBASE_CLIENT_EMAIL =
    'different@demo-clinic-landing.iam.gserviceaccount.com'
  assert.throws(getFirebaseServerCredentials, {
    message: 'FIREBASE_SERVICE_ACCOUNT_MISMATCH',
  })
})
test('existing split Firebase credential settings remain supported', () => {
  clear()
  process.env.FIREBASE_CLIENT_EMAIL = fixture.client_email
  process.env.FIREBASE_PROJECT_ID = fixture.project_id
  process.env.FIREBASE_PRIVATE_KEY = fixture.private_key
  assert.equal(getFirebaseServerCredentials().key, 'fixture-key\nsecond-line')
})
