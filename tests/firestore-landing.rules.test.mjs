import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  deleteDoc,
} from 'firebase/firestore'

const environments = []
const emulatorUrl = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8789'}`,
)

before(async () => {
  for (const [name, rulesFile] of [
    ['canonical', 'firestore.rules'],
    ['compat', 'firestore.landing-compat.rules'],
  ]) {
    const env = await initializeTestEnvironment({
      projectId: 'demo-clinic-landing-' + name,
      firestore: {
        host: emulatorUrl.hostname,
        port: Number(emulatorUrl.port),
        rules: await readFile(
          new URL('../' + rulesFile, import.meta.url),
          'utf8',
        ),
      },
    })
    environments.push({ name, env })
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      for (const path of [
        'site_settings/landing_page',
        'site_settings/private',
        'owners/platform',
        'settings/global',
        'landing_feedback/pending',
        'trial_requests/request',
        'landing_rate_limits/bucket',
        'clinics/fixture',
        'appointments/fixture',
      ]) {
        await setDoc(doc(db, path), { fixture: true })
      }
    })
  }
})
after(async () => {
  for (const { env } of environments) await env.cleanup()
})

test('visitors can get the published landing document, but cannot list settings or publish changes', async () => {
  for (const { env } of environments) {
    const db = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(db, 'site_settings/landing_page')))
    await assertFails(getDocs(collection(db, 'site_settings')))
    await assertFails(getDoc(doc(db, 'site_settings/private')))
    await assertFails(
      setDoc(doc(db, 'site_settings/landing_page'), { overwritten: true }),
    )
  }
})
test('anonymous clients cannot read, insert or delete owner credentials, pending reviews or trial leads', async () => {
  for (const { env } of environments) {
    const db = env.unauthenticatedContext().firestore()
    for (const root of [
      'owners',
      'settings',
      'landing_feedback',
      'trial_requests',
      'landing_rate_limits',
    ]) {
      await assertFails(getDocs(collection(db, root)))
      await assertFails(getDoc(doc(db, root + '/fixture')))
      await assertFails(
        setDoc(doc(db, root + '/fixture'), { overwritten: true }),
      )
      await assertFails(deleteDoc(doc(db, root + '/fixture')))
    }
  }
})
test('clinic authentication and a mismatched owner email never grant landing administration', async () => {
  for (const { env } of environments) {
    for (const claims of [
      { role: 'doctor', clinicId: 'fixture' },
      { platformOwner: true, ownerEmail: 'other@example.test' },
    ]) {
      const db = env.authenticatedContext('clinic-fixture', claims).firestore()
      await assertFails(getDoc(doc(db, 'owners/platform')))
      await assertFails(getDocs(collection(db, 'trial_requests')))
      await assertFails(
        setDoc(doc(db, 'site_settings/landing_page'), { overwritten: true }),
      )
    }
  }
})
test('the server-issued platform owner claim can manage the CMS and existing administrative data', async () => {
  for (const { env } of environments) {
    const db = env
      .authenticatedContext('platform-owner', {
        platformOwner: true,
        ownerEmail: 'yallacodex@gmail.com',
        ownerUid: 'platform-owner',
        email_verified: true,
      })
      .firestore()
    for (const path of [
      'site_settings/landing_page',
      'owners/platform',
      'trial_requests/request',
      'clinics/fixture',
    ]) {
      await assertSucceeds(getDoc(doc(db, path)))
      await assertSucceeds(
        setDoc(doc(db, path), { fixture: true, changed: true }),
      )
    }
  }
})
test('compatibility rules deny unauthenticated access to appointments', async () => {
  const { env } = environments.find((item) => item.name === 'compat')
  const db = env.unauthenticatedContext().firestore()
  await assertFails(getDoc(doc(db, 'appointments/fixture')))
  await assertFails(setDoc(doc(db, 'appointments/fixture'), { fixture: true }))
})
