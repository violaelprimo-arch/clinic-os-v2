import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OWNER_NAVIGATION_SECTIONS, ALL_OWNER_NAV_ITEMS } from '../src/components/owner/OwnerNavigationConfig.ts'

test('TASK 1: Owner Sidebar Sections contain all 4 required architecture groups', () => {
  const sectionIds = OWNER_NAVIGATION_SECTIONS.map((s) => s.id)
  assert.deepEqual(sectionIds, ['overview', 'platform', 'marketing', 'settings'])

  const overview = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'overview')
  assert.ok(overview, 'Overview section must exist')
  assert.equal(overview.titleAr, 'نظرة عامة')
  assert.equal(overview.titleEn, 'Overview')

  const platform = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'platform')
  assert.ok(platform, 'Platform section must exist')
  assert.equal(platform.titleAr, 'إدارة المنصة')
  assert.equal(platform.titleEn, 'Platform Management')

  const marketing = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'marketing')
  assert.ok(marketing, 'Marketing section must exist')
  assert.equal(marketing.titleAr, 'التسويق والتواصل')
  assert.equal(marketing.titleEn, 'Marketing & Communication')

  const settings = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'settings')
  assert.ok(settings, 'Settings section must exist')
  assert.equal(settings.titleAr, 'إعدادات المنصة')
  assert.equal(settings.titleEn, 'Platform Settings')
})

test('TASK 2: All 9 required tabs and actions exist in Owner Navigation', () => {
  const expectedItems = [
    'clinics',
    'clinic-requests',
    'doctors',
    'add',
    'packages',
    'landing',
    'whatsapp',
    'settings',
    'backup',
  ]

  const actualItemIds = ALL_OWNER_NAV_ITEMS.map((item) => item.id)
  assert.deepEqual(actualItemIds, expectedItems)
  assert.equal(actualItemIds.length, 9, 'Must have exactly 9 navigation items')
})

test('TASK 3: Overview section contains clinics and clinic-requests with badge', () => {
  const overview = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'overview')
  const itemIds = overview.items.map((i) => i.id)
  assert.deepEqual(itemIds, ['clinics', 'clinic-requests'])

  const requestsItem = overview.items.find((i) => i.id === 'clinic-requests')
  assert.equal(requestsItem.showBadge, true)
  assert.equal(requestsItem.labelAr, 'طلبات العيادات')
  assert.equal(requestsItem.labelEn, 'Clinic Requests')
})

test('TASK 4: Platform management section contains doctors, add (edit clinic), and packages', () => {
  const platform = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'platform')
  const itemIds = platform.items.map((i) => i.id)
  assert.deepEqual(itemIds, ['doctors', 'add', 'packages'])

  const editItem = platform.items.find((i) => i.id === 'add')
  assert.equal(editItem.labelAr, 'تعديل بيانات العيادة')
  assert.equal(editItem.labelEn, 'Edit Clinic Details')
})

test('TASK 5: Marketing section contains landing and whatsapp', () => {
  const marketing = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'marketing')
  const itemIds = marketing.items.map((i) => i.id)
  assert.deepEqual(itemIds, ['landing', 'whatsapp'])

  const whatsappItem = marketing.items.find((i) => i.id === 'whatsapp')
  assert.equal(whatsappItem.labelAr, 'إدارة واتساب العيادات')
  assert.ok(whatsappItem.activeClass?.includes('emerald'))
})

test('TASK 6: Settings section contains AI Global Key and JSON Backup action', () => {
  const settings = OWNER_NAVIGATION_SECTIONS.find((s) => s.id === 'settings')
  const itemIds = settings.items.map((i) => i.id)
  assert.deepEqual(itemIds, ['settings', 'backup'])

  const backupItem = settings.items.find((i) => i.id === 'backup')
  assert.equal(backupItem.isAction, true)
  assert.equal(backupItem.labelAr, 'نسخة احتياطية (JSON)')
})

test('TASK 7: Complete 1-to-1 parity with horizontal bar elements', () => {
  // Horizontal bar items from OwnerDashboardClient:
  const horizontalTabs = [
    'clinic-requests',
    'landing',
    'clinics',
    'whatsapp',
    'doctors',
    'packages',
    'add',
    'settings',
    'backup',
  ]

  const sidebarTabs = ALL_OWNER_NAV_ITEMS.map((item) => item.id)
  for (const hTab of horizontalTabs) {
    assert.ok(
      sidebarTabs.includes(hTab),
      `Horizontal tab ${hTab} must be accessible from sidebar`
    )
  }
})
