import { chromium } from '@playwright/test'

const VIEWPORTS = [
  { width: 320, height: 600, name: 'mobile-small' },
  { width: 360, height: 740, name: 'mobile-android' },
  { width: 390, height: 844, name: 'mobile-iphone14' },
  { width: 430, height: 932, name: 'mobile-iphone-pro-max' },
  { width: 768, height: 1024, name: 'tablet-ipad' },
  { width: 1024, height: 768, name: 'desktop-small' },
  { width: 1440, height: 900, name: 'desktop-standard' },
  { width: 1920, height: 1080, name: 'desktop-wide' }
]

async function runViewportAudit() {
  console.log('Starting Patient Dashboard Viewport & Responsiveness Test...')
  const browser = await chromium.launch({ headless: true })
  const results = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'ar-EG'
    })

    const page = await context.newPage()

    // Pre-populate patient_auth in localStorage before navigation
    await page.addInitScript(() => {
      localStorage.setItem('patient_auth', JSON.stringify({
        phone: '01012345678',
        name: 'كريم عبد الله',
        clinic_id: 'zizo',
        slug: 'zizo',
        age: '32'
      }))
    })

    try {
      const response = await page.goto('https://zizo.yalla-clinic.com/clinic/zizo/patient', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      })

      const status = response?.status() || 0
      // Wait for React hydration
      await page.waitForTimeout(3000)

      const patientNameVisible = await page.getByText('كريم عبد الله').first().isVisible().catch(() => false)
      const tabAppointmentsVisible = await page.getByRole('button', { name: /المواعيد/ }).first().isVisible().catch(() => false)
      const isRtl = await page.evaluate(() => {
        const root = document.querySelector('[dir="rtl"]')
        return !!root || document.documentElement.dir === 'rtl' || document.body.dir === 'rtl'
      })

      // Check main container width
      const containerWidth = await page.evaluate(() => {
        const main = document.querySelector('main')
        return main ? main.getBoundingClientRect().width : 0
      })

      // Check whether sidebar is present on desktop vs mobile pills
      const isDesktop = vp.width >= 1024
      const sidebarPresent = await page.evaluate(() => {
        const aside = document.querySelector('aside')
        return aside ? window.getComputedStyle(aside).display !== 'none' : false
      })

      results.push({
        viewport: `${vp.width}x${vp.height} (${vp.name})`,
        status,
        patientNameVisible,
        tabAppointmentsVisible,
        isRtl,
        containerWidth: Math.round(containerWidth),
        sidebarPresent
      })

      console.log(`[PASS] Viewport ${vp.width}px: Status ${status}, Name: ${patientNameVisible}, Container: ${Math.round(containerWidth)}px, Sidebar: ${sidebarPresent}`)
    } catch (err) {
      console.error(`[FAIL] Viewport ${vp.width}px:`, err.message)
      results.push({
        viewport: `${vp.width}x${vp.height} (${vp.name})`,
        error: err.message
      })
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log('\nAudit Results Summary:')
  console.table(results)
}

runViewportAudit().catch(console.error)
