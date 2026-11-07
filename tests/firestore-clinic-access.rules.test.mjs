import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

let env
before(async () => {
  const [hostname, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8789').split(':')
  env = await initializeTestEnvironment({
    projectId: 'demo-clinic-access-tests',
    firestore: {
      host: hostname,
      port: Number(port),
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'clinics/clinicA'), {
      slug: 'clinic-a',
      clinicName: 'Clinic A',
      isActive: true,
      hiddenSections: ['settings.security'],
      expirationDate: '2027-12-31',
    })
    await setDoc(doc(db, 'clinics/clinicStopped'), {
      slug: 'stopped',
      clinicName: 'Stopped Clinic',
      isActive: false,
    })
    await setDoc(doc(db, 'branches/branchA'), {
      clinic_id: 'clinicA', clinicId: 'clinicA',
      name: 'Registered Branch', isMain: true, isOpen: true,
    })
    await setDoc(doc(db, 'appointments/apptA'), {
      clinic_id: 'clinicA', patientName: 'Test', status: 'waiting',
    })
    await setDoc(doc(db, 'appointments/apptStopped'), {
      clinic_id: 'clinicStopped', patientName: 'History', status: 'completed',
    })
    await setDoc(doc(db, 'patient_accounts/stoppedPatient'), {
      clinic_id: 'clinicStopped', phone: '01000000000',
    })
  })
})
after(async () => { await env?.cleanup() })

const authDb = (clinicId, uid = 'doctor-1') =>
  env.authenticatedContext(uid, { clinicId, clinic_id: clinicId }).firestore()

const ownerDb = () =>
  env.authenticatedContext('real-owner', {
    platformOwner: true, ownerEmail: 'yallacodex@gmail.com',
    ownerUid: 'real-owner', email_verified: true,
  }).firestore()

test('public visitors cannot forge bookings, counters or branch locations', async () => {
  const db = env.unauthenticatedContext().firestore()
  await assertFails(setDoc(doc(db, 'appointments/forged'), {
    clinic_id: 'clinicA', patientName: 'Forged',
  }))
  await assertFails(setDoc(doc(db, 'clinic_daily_counters/forged'), {
    clinicId: 'clinicA', lastQueueNumber: 99999,
  }))
  await assertFails(setDoc(doc(db, 'branches/forged'), {
    clinic_id: 'clinicA', name: 'Fake Branch',
  }))
})

test('active doctor can operate own branch, but cannot rewrite its identity or make another main', async () => {
  const db = authDb('clinicA')
  await assertSucceeds(updateDoc(doc(db, 'branches/branchA'), { isOpen: false }))
  await assertSucceeds(updateDoc(doc(db, 'branches/branchA'), { isOpen: true }))
  await assertFails(updateDoc(doc(db, 'branches/branchA'), { name: 'Hijacked Name' }))
  await assertFails(updateDoc(doc(db, 'branches/branchA'), { isMain: false }))
  await assertFails(deleteDoc(doc(db, 'branches/branchA')))
  await assertFails(setDoc(doc(db, 'branches/forgedDoctor'), {
    clinic_id: 'clinicA', name: 'Unauthorized New Branch',
  }))
})

test('tenant cannot grant themselves owner features or change subscription', async () => {
  const db = authDb('clinicA')
  await assertSucceeds(updateDoc(doc(db, 'clinics/clinicA'), {
    clinicName: 'Updated Clinic Name',
  }))
  await assertFails(updateDoc(doc(db, 'clinics/clinicA'), { isActive: false }))
  await assertFails(updateDoc(doc(db, 'clinics/clinicA'), { expirationDate: '2099-01-01' }))
  await assertFails(updateDoc(doc(db, 'clinics/clinicA'), { hiddenSections: [] }))
  await assertFails(updateDoc(doc(db, 'clinics/clinicA'), { allowFinance: true }))
  await assertFails(updateDoc(doc(db, 'clinics/clinicA'), { doctorPasswordHash: 'fake' }))
})

test('clinic scope cannot be switched by claiming another clinic ID in the payload', async () => {
  const db = authDb('clinicA')
  await assertFails(updateDoc(doc(db, 'clinics/clinicStopped'), {
    clinicName: 'Wrong Tenant',
  }))
  await assertFails(updateDoc(doc(db, 'appointments/apptStopped'), {
    status: 'deleted',
  }))
})

test('stopped doctor can read existing records, but cannot perform any write', async () => {
  const db = authDb('clinicStopped', 'doctor-stopped')
  await assertSucceeds(getDoc(doc(db, 'patient_accounts/stoppedPatient')))
  await assertSucceeds(getDoc(doc(db, 'appointments/apptStopped')))
  await assertFails(updateDoc(doc(db, 'clinics/clinicStopped'), {
    clinicName: 'After Stop',
  }))
  await assertFails(updateDoc(doc(db, 'appointments/apptStopped'), {
    status: 'waiting',
  }))
  await assertFails(setDoc(doc(db, 'clinic_daily_counters/blocked'), {
    clinicId: 'clinicStopped', lastQueueNumber: 1,
  }))
})

test('verified owner can manage and reactivate clinics and register branches', async () => {
  const db = ownerDb()
  await assertSucceeds(updateDoc(doc(db, 'clinics/clinicStopped'), { isActive: true }))
  await assertSucceeds(setDoc(doc(db, 'branches/ownerNew'), {
    clinic_id: 'clinicStopped', clinicId: 'clinicStopped',
    name: 'New Clinic Location', isOpen: false, isMain: true,
  }))
})
