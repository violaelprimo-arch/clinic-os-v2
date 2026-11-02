import { chromium } from '@playwright/test';
import path from 'path';

const artifactDir = 'C:/Users/Elmaher/.gemini/antigravity/brain/b464471d-9aec-490d-9a87-73b5907aed7b';

async function main() {
  console.log('Launching browser to verify live booking sync...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to https://zizo.yalla-clinic.com ...');
  await page.goto('https://zizo.yalla-clinic.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Title found:', bodyText.includes('د. أحمد عبد العزيز') ? 'YES' : 'NO');

  // Look for booking buttons
  const bookBtn = page.locator('button:has-text("احجز الآن"), button:has-text("حجز موعد"), a:has-text("احجز الآن")').first();
  if (await bookBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Booking button visible, clicking to open modal...');
    await bookBtn.click();
    await page.waitForTimeout(2000);
  }

  const screenshotPath = path.join(artifactDir, 'live_booking_sync_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
  console.log('Live check finished successfully!');
}

main().catch(err => console.error('Verification error:', err.message));
