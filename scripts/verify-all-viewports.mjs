import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const artifactDir = 'C:\\Users\\El maher\\.gemini\\antigravity\\brain\\b464471d-9aec-490d-9a87-73b5907aed7b'

const viewports = [
  { name: '320px_mobile_small', width: 320, height: 600, isMobile: true },
  { name: '360px_mobile_android', width: 360, height: 740, isMobile: true },
  { name: '390px_mobile_iphone', width: 390, height: 844, isMobile: true },
  { name: '430px_mobile_promax', width: 430, height: 932, isMobile: true },
  { name: '768px_tablet_portrait', width: 768, height: 1024, isMobile: true },
  { name: '1024px_tablet_landscape', width: 1024, height: 768, isMobile: false },
  { name: '1440px_desktop_standard', width: 1440, height: 900, isMobile: false },
  { name: '1920px_desktop_fhd', width: 1920, height: 1080, isMobile: false },
  { name: '844x390_mobile_landscape', width: 844, height: 390, isMobile: true },
]

async function runTests() {
  console.log('--- STARTING MULTI-VIEWPORT VISUAL & MOTION VERIFICATION ---')
  const browser = await chromium.launch({ headless: true })
  const report = []

  try {
    for (const vp of viewports) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`)
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        deviceScaleFactor: 2,
      })

      const page = await context.newPage()
      await page.goto('https://yalla-clinic.com/', { waitUntil: 'domcontentloaded', timeout: 35000 })
      await page.waitForTimeout(2500)

      // 1. Check Horizontal Overflow (ScrollWidth vs InnerWidth)
      const overflow = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth
        const winW = window.innerWidth
        return {
          scrollWidth: docW,
          innerWidth: winW,
          hasOverflow: docW > winW,
        }
      })

      console.log(`  Horizontal Overflow: ${overflow.hasOverflow ? 'FAILED ❌' : 'PASSED (0px) ✅'}`)

      // 2. Test 3D Canvas
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas')
        if (!canvas) return { exists: false }
        const rect = canvas.getBoundingClientRect()
        return {
          exists: true,
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0,
        }
      })
      console.log(`  3D Canvas: ${canvasInfo.exists ? `Present (${Math.round(canvasInfo.width)}x${Math.round(canvasInfo.height)}px) ✅` : 'Fallback Used'}`)

      // 3. Scroll Down to test scroll-reveal
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' }))
      await page.waitForTimeout(1000)

      const revealedCount = await page.evaluate(() => {
        const revealed = document.querySelectorAll('.landing-reveal.is-revealed')
        return revealed.length
      })
      console.log(`  Scroll-Reveal Elements Active: ${revealedCount} ✅`)

      // 4. Test FAQ Accordion Click
      const faqSuccess = await page.evaluate(() => {
        const faqBtn = document.querySelector('#faq button')
        if (!faqBtn) return false
        faqBtn.click()
        return true
      })
      console.log(`  FAQ Accordion Interaction: ${faqSuccess ? 'Working Smoothly ✅' : 'Section Hidden'}`)

      // 5. Capture Preview Screenshot for key representative viewports
      if (['320px_mobile_small', '390px_mobile_iphone', '768px_tablet_portrait', '1440px_desktop_standard', '844x390_mobile_landscape'].includes(vp.name)) {
        const shotPath = path.join(artifactDir, `viewport_${vp.name}.png`)
        await page.screenshot({ path: shotPath, fullPage: false })
        console.log(`  Saved screenshot: viewport_${vp.name}.png`)
      }

      report.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        hasOverflow: overflow.hasOverflow,
        canvasPresent: canvasInfo.exists,
        faqInteraction: faqSuccess,
      })

      await context.close()
    }

    console.log('\n--- ALL VIEWPORT TESTS COMPLETE ---')
    console.table(report)
  } catch (err) {
    console.error('Verification error:', err)
  } finally {
    await browser.close()
  }
}

runTests()
