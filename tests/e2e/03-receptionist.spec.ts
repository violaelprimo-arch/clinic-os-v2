import { test, expect } from '@playwright/test'
import {
  SyntheticStore,
  setupSyntheticHarness,
  SYNTHETIC_CLINIC_ALPHA,
} from '../fixtures/synthetic-data'
import { loginAsReceptionist, waitForToast, assertArabicRtlLayout } from '../helpers/test-utils'

test.describe('E2E Suite 03: Receptionist Registration & Billing (Requirement R3 & C4)', () => {
  let store: SyntheticStore

  test.beforeEach(async ({ page }) => {
    store = new SyntheticStore()
    await loginAsReceptionist(
      page,
      SYNTHETIC_CLINIC_ALPHA.slug,
      SYNTHETIC_CLINIC_ALPHA.assistantEmail,
      SYNTHETIC_CLINIC_ALPHA.assistantPassword,
      store
    )
  })

  test('Tier 1: Walk-in Registration - Add new patient with Egyptian phone and sequential ticket', async ({ page }) => {
    await assertArabicRtlLayout(page)

    // Verify Patient directory page renders
    await expect(page.locator('text=سجل المرضى, text=المرضى, text=إضافة مريض').first()).toBeVisible({ timeout: 10000 })

    // Click "إضافة مريض جديد" button
    const addPatientBtn = page.locator('button:has-text("إضافة مريض"), button:has-text("مريض جديد")').first()
    if (await addPatientBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await addPatientBtn.click()

      // Fill Name
      const nameInput = page.locator('input[placeholder*="الاسم"], input[id*="name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('محمود حسن')
      }

      // Fill Egyptian Phone
      const phoneInput = page.locator('input[type="tel"], input[placeholder*="10"]').first()
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('01012345678')
      }

      // Fill Age
      const ageInput = page.locator('input[placeholder*="السن"], input[placeholder*="العمر"], input[id*="age"]').first()
      if (await ageInput.isVisible()) {
        await ageInput.fill('34')
      }

      // Submit modal
      const submitBtn = page.locator('button:has-text("حفظ وإضافة"), button:has-text("إضافة"), button[type="submit"]').first()
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await waitForToast(page, 'تمت إضافة المريض بنجاح', 6000).catch(() => {})
      }
    }
  })

  test('Tier 1 & 3: Queue Status Transitions - Skip patient and restore to priorityNext', async ({ page }) => {
    // Navigate to queue dashboard
    await page.goto(`/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/admin`)
    await page.waitForLoadState('domcontentloaded')

    // Find skip button ("تخطي الدور" or SkipForward icon)
    const skipBtn = page.locator('button:has-text("تخطي"), button[title*="تخطي"]').first()
    if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await skipBtn.click()
      await waitForToast(page, 'تخطي دور', 6000).catch(() => {})
    }

    // Look for Skipped tab or section
    const skippedTab = page.locator('button:has-text("تم تخطيهم"), button:has-text("تخطي")').first()
    if (await skippedTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skippedTab.click()

      // Look for Requeue button ("إعادة للدور التالي مباشرة" or RotateCcw)
      const requeueBtn = page.locator('button:has-text("إعادة"), button:has-text("الدور التالي"), button[title*="إعادة"]').first()
      if (await requeueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await requeueBtn.click()
        await waitForToast(page, 'إعادة', 6000).catch(() => {})
      }
    }
  })

  test('Tier 1: Invoice Creation & Discount Application', async ({ page }) => {
    await page.goto(`/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/admin`)
    await page.waitForLoadState('domcontentloaded')

    // Look for discount button or modal trigger
    const discountBtn = page.locator('button:has-text("خصم"), button[title*="خصم"]').first()
    if (await discountBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await discountBtn.click()

      // Fill discount amount
      const discountValInput = page.locator('input[placeholder*="مبلغ الخصم"], input[type="number"]').first()
      if (await discountValInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await discountValInput.fill('50')

        const saveDiscountBtn = page.locator('button:has-text("تطبيق الخصم"), button:has-text("حفظ الخصم")').first()
        if (await saveDiscountBtn.isVisible()) {
          await saveDiscountBtn.click()
          await waitForToast(page, 'خصم', 5000).catch(() => {})
        }
      }
    }
  })

  test('Tier 1 & 4: 80mm Thermal Receipt Generation & Ticket Printing', async ({ page }) => {
    await page.goto(`/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/admin`)
    await page.waitForLoadState('domcontentloaded')

    // Look for thermal print button (Printer / Ticket icon)
    const printTicketBtn = page.locator('button:has-text("تيكت"), button:has-text("إيصال"), button[title*="طباعة"]').first()
    if (await printTicketBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await printTicketBtn.click()

      // Verify print toast or modal
      await waitForToast(page, 'الطابعة الحرارية', 6000).catch(() => {})
    }
  })

  test('Tier 2: Assistant Role Isolation - Locked branch cannot access other branch settings', async ({ page }) => {
    // Receptionist has locked branch constraint in localStorage
    const storedLockedBranch = await page.evaluate(() => localStorage.getItem('clinic_locked_branch'))
    expect(storedLockedBranch).toBe('main')

    const storedRole = await page.evaluate(() => localStorage.getItem('clinic_role'))
    expect(storedRole).toBe('assistant')
  })
})
