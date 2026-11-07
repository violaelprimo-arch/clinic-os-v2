import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalizeBranches, mainBranchDuplicateKey } from '../src/lib/branchCanonical.ts'

const base = { clinicId: 'clinic-1', name: 'الفرع الرئيسي', address: 'مستشفى النيل', isMain: true }

test('Duplicated main branch is displayed once and its closed record wins', () => {
  const listed = canonicalizeBranches([
    { ...base, id: 'original', isOpen: true, updatedAt: '2026-11-07T11:00:00Z' },
    { ...base, id: 'legacy-copy', isOpen: false, updatedAt: '2026-11-06T11:00:00Z' },
  ])
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, 'legacy-copy')
  assert.equal(listed[0].isOpen, false)
})

test('Archiving the closed duplicate lets the retained branch receive bookings', () => {
  const listed = canonicalizeBranches([
    { ...base, id: 'original', isOpen: true },
    { ...base, id: 'legacy-copy', isOpen: false, isArchived: true },
  ])
  assert.deepEqual(listed.map((b) => b.id), ['original'])
})

test('Different physical branches and different clinics never collapse', () => {
  const listed = canonicalizeBranches([
    { ...base, id: 'main', isOpen: true },
    { ...base, id: 'other-location', address: 'مستشفى السلام', isOpen: true },
    { ...base, id: 'other-clinic', clinicId: 'clinic-2', isOpen: true },
    { ...base, id: 'real-secondary', isMain: false, name: 'فرع المعادي', isOpen: true },
  ])
  assert.equal(listed.length, 4)
})

test('No main key for an unnamed placeholder address', () => {
  assert.equal(mainBranchDuplicateKey({ ...base, id: 'main', address: 'عنوان الفرع' }), null)
})
