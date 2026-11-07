import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isClinicSuspended,
  isSuspendedReadOnlyPath,
  isOwnerSectionVisible,
  OWNER_CONTROLLED_SECTIONS,
} from '../src/lib/clinicAccessPolicy.ts'

test('date-only expiration remains valid through Cairo calendar day', () => {
  const clinic = { isActive: true, expirationDate: '2026-11-08' }
  assert.equal(isClinicSuspended(clinic, new Date('2026-11-08T20:59:00Z')), false)
  assert.equal(isClinicSuspended(clinic, new Date('2026-11-08T22:01:00Z')), true)
})

test('subscription disabled or past expiration is suspended', () => {
  assert.equal(isClinicSuspended({isActive:false}), true)
  assert.equal(isClinicSuspended({isActive:true,expirationDate:'2026-01-01T00:00:00Z'},new Date('2026-11-08T00:00:00Z')),true)
  assert.equal(isClinicSuspended({isActive:true,expirationDate:'2027-01-01T00:00:00Z'},new Date('2026-11-08T00:00:00Z')),false)
})

test('suspension only opens read-only patient history, finance and accounts', () => {
  const base='/clinic/demo/admin'
  for(const s of ['/accounts','/finance','/patients','/patients/123']) {
    assert.equal(isSuspendedReadOnlyPath(base+s,'demo'),true,s)
  }
  for(const s of ['', '/booking','/drugs','/prescriptions','/settings','/branches','/analytics','/patients/123/edit','/accounts/change']) {
    assert.equal(isSuspendedReadOnlyPath(base+s,'demo'),false,s)
  }
  assert.equal(isSuspendedReadOnlyPath('/clinic/another/admin/accounts','demo'),false)
})

test('nested visibility entries hide their children without hiding siblings', () => {
  const clinic={hiddenSections:['settings.branding','settings.profile.contact']}
  assert.equal(isOwnerSectionVisible(clinic,'settings.branding.colors'),false)
  assert.equal(isOwnerSectionVisible(clinic,'settings.profile.contact'),false)
  assert.equal(isOwnerSectionVisible(clinic,'settings.profile.doctor'),true)
  assert.equal(isOwnerSectionVisible(clinic,'settings.services'),true)
  assert.ok(OWNER_CONTROLLED_SECTIONS.some(x=>x.id==='settings.queue.capacity'))
})
