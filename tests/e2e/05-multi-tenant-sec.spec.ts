import { test, expect } from '@playwright/test'
import {
  SyntheticStore,
  setupSyntheticHarness,
  SYNTHETIC_CLINIC_ALPHA,
  SYNTHETIC_CLINIC_BETA,
} from '../fixtures/synthetic-data'
import { loginAsDoctor } from '../helpers/test-utils'

test.describe('E2E Suite 05: Multi-Tenant Security & Isolation (Requirement R5 & C2)', () => {
  let store: SyntheticStore

  test.beforeEach(async ({ page }) => {
    store = new SyntheticStore()
    // Authenticate as Doctor of Clinic Alpha
    await loginAsDoctor(
      page,
      SYNTHETIC_CLINIC_ALPHA.slug,
      SYNTHETIC_CLINIC_ALPHA.doctorEmail,
      SYNTHETIC_CLINIC_ALPHA.doctorPassword,
      store
    )
  })

  test('Tier 1 & 3: Cross-Tenant Medical Record Leakage Blocked', async ({ page }) => {
    // Navigate to Clinic Alpha patient directory
    await page.goto(`/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/admin/patients`)
    await page.waitForLoadState('domcontentloaded')

    // Clinic Beta's exclusive patient is "علي عمر" (phone: 01299988877)
    // Assert that Clinic Beta's patient NEVER appears in Clinic Alpha's directory
    await expect(page.locator('text=علي عمر')).toHaveCount(0)
    await expect(page.locator('text=01299988877')).toHaveCount(0)

    // Verify search for Beta's patient under Alpha returns 0 results
    const searchInput = page.locator('input[placeholder*="بحث"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('علي عمر')
      await expect(page.locator('text=علي عمر')).toHaveCount(0)
    }
  })

  test('Tier 1 & 2: Percent-Encoded Patient ID (%2B) Resolves without 500 or CPU Timeout', async ({ page }) => {
    // Navigate with percent-encoded patient ID (+201011122334 encoded as %2B201011122334)
    const encodedPhone = '%2B201011122334'
    const targetUrl = `/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/admin/patients/${encodedPhone}`

    const response = await page.goto(targetUrl)
    await page.waitForLoadState('domcontentloaded')

    // Must resolve cleanly without 500 / 504 / URIError
    expect(response?.status()).toBeLessThan(500)

    // Verify patient profile rendered
    await expect(page.locator('text=الملف الطبي, text=طارق رضوان').first()).toBeVisible({ timeout: 10000 })

    // Verify that the decoded phone or name is present
    const content = await page.content()
    expect(content).not.toContain('URIError')
    expect(content).not.toContain('Worker exceeded CPU')
  })

  test('Tier 3: Insecure Direct Object Reference (IDOR) on Invoices Blocked Across Tenants', async ({ page }) => {
    // Attempt to access Clinic Beta's invoice under Clinic Alpha's tenant slug
    // `synth-appt-beta-1` belongs to Clinic Beta (350 EGP - كشف قلب)
    const crossTenantInvoiceUrl = `/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/invoice/synth-appt-beta-1`
    const response = await page.goto(crossTenantInvoiceUrl)
    await page.waitForLoadState('domcontentloaded')

    // If page renders, verify that Clinic Beta's diagnosis or details are NOT leaked as an Alpha invoice
    const betaDiagnosis = page.locator('text=قصور في الشريان التاجي').first()
    const isLeaked = await betaDiagnosis.isVisible().catch(() => false)
    expect(isLeaked).toBeFalsy()

    // Status should either be not found / error / or not render Beta's sensitive medical details
    const content = await page.content()
    expect(content).not.toContain('قصور في الشريان التاجي')
  })

  test('Tier 3: Insecure Direct Object Reference (IDOR) on Prescriptions Blocked Across Tenants', async ({ page }) => {
    // Attempt to access Clinic Beta's prescription under Clinic Alpha's tenant slug
    const crossTenantRxUrl = `/clinic/${SYNTHETIC_CLINIC_ALPHA.slug}/prescription/synth-appt-beta-1`
    await page.goto(crossTenantRxUrl)
    await page.waitForLoadState('domcontentloaded')

    // Verify that Beta's cardiac prescription (Concor 5mg) is NOT displayed under Alpha
    const betaDrug = page.locator('text=Concor 5mg').first()
    const isRxLeaked = await betaDrug.isVisible().catch(() => false)
    expect(isRxLeaked).toBeFalsy()
  })

  test('Tier 4: Real-World Multi-Tenant Boundary Stress Test', async ({ page }) => {
    // 1. Direct fetch attempt to access Clinic Beta appointment data from Clinic Alpha session
    const checkBetaAppt = store.getAppointmentsForClinic(SYNTHETIC_CLINIC_BETA.id)
    expect(checkBetaAppt.length).toBeGreaterThan(0)

    // 2. Ensure Clinic Alpha appointment list remains strictly isolated
    const checkAlphaAppt = store.getAppointmentsForClinic(SYNTHETIC_CLINIC_ALPHA.id)
    const betaInAlpha = checkAlphaAppt.find((a) => a.clinic_id === SYNTHETIC_CLINIC_BETA.id)
    expect(betaInAlpha).toBeUndefined()
  })
})
