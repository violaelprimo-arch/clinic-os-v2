import { Page, expect } from '@playwright/test'
import {
  SYNTHETIC_CLINIC_ALPHA,
  setupSyntheticHarness,
  SyntheticStore,
} from '../fixtures/synthetic-data'

/**
 * Common Playwright E2E Helpers for Yalla Clinic SaaS
 */

/**
 * Logs in as Platform Owner and navigates to the owner portal
 */
export async function loginAsOwner(page: Page, store?: SyntheticStore) {
  await setupSyntheticHarness(page, { initialRole: 'owner', store })
  await page.goto('/owner')
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Logs in as Clinic Doctor
 */
export async function loginAsDoctor(
  page: Page,
  slug: string = SYNTHETIC_CLINIC_ALPHA.slug,
  email: string = SYNTHETIC_CLINIC_ALPHA.doctorEmail,
  password: string = SYNTHETIC_CLINIC_ALPHA.doctorPassword,
  store?: SyntheticStore
) {
  await setupSyntheticHarness(page, { initialRole: 'doctor', clinicSlug: slug, store })
  await page.goto(`/clinic/${slug}/login`)
  await page.waitForLoadState('domcontentloaded')

  // Check if already authenticated or fill login form
  const emailInput = page.locator('input[type="email"]').first()
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emailInput.fill(email)
    const passInput = page.locator('input[type="password"]').first()
    await passInput.fill(password)
    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()
  }

  // Navigate directly to admin dashboard to ensure state
  await page.goto(`/clinic/${slug}/admin`)
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Logs in as Clinic Receptionist / Assistant
 */
export async function loginAsReceptionist(
  page: Page,
  slug: string = SYNTHETIC_CLINIC_ALPHA.slug,
  email: string = SYNTHETIC_CLINIC_ALPHA.assistantEmail,
  password: string = SYNTHETIC_CLINIC_ALPHA.assistantPassword,
  store?: SyntheticStore
) {
  await setupSyntheticHarness(page, { initialRole: 'assistant', clinicSlug: slug, store })
  await page.goto(`/clinic/${slug}/login`)
  await page.waitForLoadState('domcontentloaded')

  const emailInput = page.locator('input[type="email"]').first()
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emailInput.fill(email)
    const passInput = page.locator('input[type="password"]').first()
    await passInput.fill(password)
    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()
  }

  await page.goto(`/clinic/${slug}/admin/patients`)
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Logs in as Patient to portal
 */
export async function loginAsPatient(
  page: Page,
  slug: string = SYNTHETIC_CLINIC_ALPHA.slug,
  phone: string = '01012345678',
  store?: SyntheticStore
) {
  await setupSyntheticHarness(page, { initialRole: 'patient', clinicSlug: slug, store })
  await page.goto(`/clinic/${slug}/patient`)
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Waits for a toast notification containing specific text
 */
export async function waitForToast(page: Page, text: string, timeout = 7000) {
  const toastLocator = page.locator(`[data-sonner-toast]:has-text("${text}"), div[role="status"]:has-text("${text}"), .toast:has-text("${text}")`)
  await expect(toastLocator.first()).toBeVisible({ timeout })
}

/**
 * Validates that document or container conforms to RTL Arabic layout
 */
export async function assertArabicRtlLayout(page: Page) {
  const htmlDir = await page.locator('html').getAttribute('dir')
  const bodyDir = await page.locator('body').getAttribute('dir')
  const mainDir = await page.locator('main, [dir="rtl"]').first().getAttribute('dir').catch(() => null)
  expect(htmlDir === 'rtl' || bodyDir === 'rtl' || mainDir === 'rtl').toBeTruthy()
}
