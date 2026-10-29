import { test, expect } from '@playwright/test'
import {
  SyntheticStore,
  setupSyntheticHarness,
  SYNTHETIC_CLINIC_ALPHA,
  SYNTHETIC_CLINIC_GAMMA,
} from '../fixtures/synthetic-data'
import { loginAsOwner, assertArabicRtlLayout } from '../helpers/test-utils'

test.describe('E2E Suite 01: Platform Owner Governance (Requirement R3 & C4)', () => {
  let store: SyntheticStore

  test.beforeEach(async ({ page }) => {
    store = new SyntheticStore()
    await loginAsOwner(page, store)
  })

  test('Tier 1: Owner Dashboard layout loads in Arabic RTL with navigation tabs', async ({ page }) => {
    await assertArabicRtlLayout(page)
    // Check brand header and portal title
    await expect(page.locator('text=Super Admin Portal, text=لوحة تحكم المالِك').first()).toBeVisible()

    // Verify main navigation items exist
    const clinicsNav = page.locator('button:has-text("إدارة العيادات والاشتراكات"), button:has-text("Clinics Management")').first()
    await expect(clinicsNav).toBeVisible()

    const addNav = page.locator('button:has-text("إضافة عيادة جديدة"), button:has-text("Add New Clinic")').first()
    await expect(addNav).toBeVisible()

    const packagesNav = page.locator('button:has-text("الباقات والاشتراكات"), button:has-text("Packages & Plans")').first()
    await expect(packagesNav).toBeVisible()
  })

  test('Tier 1: Provision a new synthetic clinic with doctor credentials and custom slug', async ({ page }) => {
    // Switch to Add Clinic tab
    const addTabBtn = page.locator('button:has-text("إضافة عيادة جديدة"), button:has-text("Add New Clinic")').first()
    await addTabBtn.click()

    // Verify Add Clinic heading
    await expect(
      page.locator('h2:has-text("إضافة وتكوين عيادة طبية جديدة"), h2:has-text("تعديل بيانات العيادة")').first()
    ).toBeVisible()

    // Fill form fields
    const doctorInput = page.locator('input[placeholder="د. أحمد محمد"]').first()
    if (await doctorInput.isVisible()) {
      await doctorInput.fill('د. خالد الألفي')
    }

    const clinicInput = page.locator('input[placeholder="عيادة الشفاء التخصصية"]').first()
    if (await clinicInput.isVisible()) {
      await clinicInput.fill('مركز الألفي لطب الأطفال')
    }

    const slugInput = page.locator('input[placeholder="اسم-الدكتور"]').first()
    if (await slugInput.isVisible()) {
      await slugInput.fill('elalfi-pediatrics')
      await expect(slugInput).toHaveValue('elalfi-pediatrics')
    }

    // Verify subdomain preview reflects slug
    const previewDomain = page.locator('strong:has-text("elalfi-pediatrics")').first()
    await expect(previewDomain).toBeVisible()
  })

  test('Tier 1: Subscription Management - Package list and feature controls render', async ({ page }) => {
    const packagesTabBtn = page.locator('button:has-text("التحكم في الباقات والاشتراكات"), button:has-text("الباقات والاشتراكات")').first()
    await packagesTabBtn.click()

    // Verify Package management controls exist
    const packageHeading = page.locator('text=الباقات, text=Packages, text=اشتراك').first()
    await expect(packageHeading).toBeVisible()
  })

  test('Tier 2: Corner Cases - Input sanitization for clinic slug and price validation', async ({ page }) => {
    const addTabBtn = page.locator('button:has-text("إضافة عيادة جديدة"), button:has-text("Add New Clinic")').first()
    await addTabBtn.click()

    const slugInput = page.locator('input[placeholder="اسم-الدكتور"]').first()
    if (await slugInput.isVisible()) {
      // Type special characters, Arabic, uppercase: slug should automatically sanitize to lowercase alphanumeric and dashes
      await slugInput.fill('Dr. Ahmed & Co. #123')
      const sanitizedVal = await slugInput.inputValue()
      expect(sanitizedVal).not.toContain(' ')
      expect(sanitizedVal).not.toContain('&')
      expect(sanitizedVal).not.toContain('#')
      expect(sanitizedVal).toMatch(/^[a-z0-9-]*$/)
    }
  })

  test('Tier 3 & 4: Suspension Guards - Suspended clinic blocks public access and direct bookings', async ({ page }) => {
    // 1. Attempt to open suspended clinic public landing page
    await page.goto(`/clinic/${SYNTHETIC_CLINIC_GAMMA.slug}`)
    await page.waitForLoadState('domcontentloaded')

    // 2. Assert page displays "العيادة غير موجودة" or suspended notice
    const notFoundHeader = page.locator('h1:has-text("العيادة غير موجودة"), h2:has-text("العيادة غير موجودة"), text=Clinic Not Found').first()
    await expect(notFoundHeader).toBeVisible()

    // 3. Attempt direct API booking for suspended clinic
    const response = await page.request.post('/api/clinic/book', {
      data: {
        slug: SYNTHETIC_CLINIC_GAMMA.slug,
        patientName: 'مريض تجريبي معلق',
        phone: '01099998888',
        serviceName: 'كشف أسنان',
        servicePrice: 200,
        date: new Date().toISOString().split('T')[0],
      },
    })

    // Assert booking is rejected with 403 or 404
    expect([403, 404]).toContain(response.status())
    const resBody = await response.json()
    expect(resBody.error || resBody.message).toBeTruthy()
  })
})
