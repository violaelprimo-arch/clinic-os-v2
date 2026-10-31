import { chromium } from '@playwright/test'
import path from 'path'

const artifactDir = 'C:\\Users\\El maher\\.gemini\\antigravity\\brain\\b464471d-9aec-490d-9a87-73b5907aed7b'

async function capture() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })

  try {
    // 1. Desktop Screenshot (1280 x 900)
    console.log('Capturing Desktop Screenshot...')
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    })
    const desktopPage = await desktopContext.newPage()
    await desktopPage.goto('https://yalla-clinic.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await desktopPage.waitForTimeout(3000)
    const desktopPath = path.join(artifactDir, 'landing_desktop_preview.png')
    await desktopPage.screenshot({ path: desktopPath, fullPage: false })
    console.log('Saved Desktop Screenshot to:', desktopPath)
    await desktopContext.close()

    // 2. Mobile Screenshot (390 x 844)
    console.log('Capturing Mobile Screenshot...')
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const mobilePage = await mobileContext.newPage()
    await mobilePage.goto('https://yalla-clinic.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await mobilePage.waitForTimeout(3000)
    const mobilePath = path.join(artifactDir, 'landing_mobile_preview.png')
    await mobilePage.screenshot({ path: mobilePath, fullPage: false })
    console.log('Saved Mobile Screenshot to:', mobilePath)
    await mobileContext.close()

    console.log('Screenshots captured successfully!')
  } catch (err) {
    console.error('Capture error:', err)
  } finally {
    await browser.close()
  }
}

capture()
