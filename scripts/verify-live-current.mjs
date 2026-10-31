import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const artifactDir = 'C:\\Users\\El maher\\.gemini\\antigravity\\brain\\b464471d-9aec-490d-9a87-73b5907aed7b'

async function verifyLive() {
  console.log('=== VERIFYING LIVE PRODUCTION: https://yalla-clinic.com/ ===')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  })

  // 1. Load Homepage
  console.log('Navigating to https://yalla-clinic.com ...')
  const res = await page.goto('https://yalla-clinic.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
  console.log(`Homepage HTTP Status: ${res.status()}`)
  await page.waitForTimeout(2500)

  // 2. Scroll to Features section
  const featuresSection = page.locator('#features')
  await featuresSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)

  // Check feature cards
  const cards = page.locator('#features .grid > div')
  const cardCount = await cards.count()
  console.log(`Features Cards Count on 'All': ${cardCount}`)

  // Take screenshot of #features
  await page.screenshot({
    path: path.join(artifactDir, 'live_verify_features_all.png'),
    clip: await featuresSection.boundingBox() || undefined
  })

  // Check tabs
  const tabs = page.locator('#features button')
  const tabCount = await tabs.count()
  console.log(`Audience Tabs Count: ${tabCount}`)

  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i)
    const text = await tab.innerText()
    await tab.click()
    await page.waitForTimeout(500)
    const visibleCards = await cards.count()
    console.log(`Tab [${text.replace(/\n/g, ' ')}] -> Visible Cards: ${visibleCards}`)
  }

  // Click back to All
  await tabs.first().click()
  await page.waitForTimeout(400)

  // 3. Check Footer Portals (بوابات النظام)
  console.log('\n--- Checking Footer Portals (بوابات النظام) ---')
  const footerPortals = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('footer a'))
    return links.map(a => ({
      text: a.innerText.trim(),
      href: a.getAttribute('href'),
      fullHref: a.href
    }))
  })

  const targetPortals = [
    'تسجيل دخول العيادة',
    'شاشة غرفة الانتظار (TV)',
    'بوابة المريض الذكية',
    'الاقتراحات والشكاوى'
  ]

  const matched = footerPortals.filter(p => targetPortals.some(t => p.text.includes(t)))
  console.log('Found Portals in Footer:', JSON.stringify(matched, null, 2))

  // Scroll to footer and take screenshot
  const footer = page.locator('footer')
  await footer.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: path.join(artifactDir, 'live_verify_footer.png'),
    clip: await footer.boundingBox() || undefined
  })

  // 4. Test each portal endpoint
  for (const portal of matched) {
    if (portal.href.startsWith('#')) {
      console.log(`Portal [${portal.text}] is anchor: ${portal.href} - Valid internal jump`)
    } else {
      const portalUrl = portal.fullHref
      console.log(`Testing portal endpoint: [${portal.text}] -> ${portalUrl}`)
      const portalPage = await browser.newPage()
      try {
        const portalRes = await portalPage.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
        console.log(`  -> Status: ${portalRes.status()} - Title: ${await portalPage.title()}`)
      } catch (err) {
        console.error(`  -> Failed loading ${portalUrl}:`, err.message)
      } finally {
        await portalPage.close()
      }
    }
  }

  await browser.close()
  console.log('=== VERIFICATION COMPLETED ===')
}

verifyLive().catch(err => {
  console.error('Fatal in verifyLive:', err)
  process.exit(1)
})
