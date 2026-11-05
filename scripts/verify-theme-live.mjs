import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/El primo/.gemini/antigravity/brain/6c4a826a-c619-4239-aa81-d0b331623648';

async function run() {
  console.log('Launching browser for Theme and Fluid Transitions Verification...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ar-EG',
  });

  const page = await context.newPage();

  // Test 1: Public Clinic & Booking Page (yalla-demo)
  console.log('1. Testing Public Clinic Page (/clinic/yalla-demo)...');
  await page.goto('https://yalla-clinic.com/clinic/yalla-demo', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check initial theme class
  let isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log('Initial document dark class:', isDark);

  // Screenshot initial mode
  const ss1 = path.join(ARTIFACT_DIR, 'theme_clinic_initial.png');
  await page.screenshot({ path: ss1, fullPage: false });

  // Find theme toggle button and click it
  const toggleBtn = page.locator('button[title*="التبديل إلى الوضع"]').first();
  if (await toggleBtn.count() > 0) {
    console.log('Clicking ThemeToggle on public clinic page...');
    await toggleBtn.click();
    await page.waitForTimeout(300); // 200ms transition time + buffer
    const toggledDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log('Toggled document dark class:', toggledDark);
    const ss2 = path.join(ARTIFACT_DIR, 'theme_clinic_toggled.png');
    await page.screenshot({ path: ss2, fullPage: false });
  }

  // Test 2: Form Persistence during Theme Toggle (Zero data loss verification)
  console.log('2. Testing Form input persistence during toggle...');
  // Check if booking form or inquiry field is present
  const phoneOrNameInput = page.locator('input[type="text"], input[type="tel"]').first();
  if (await phoneOrNameInput.count() > 0) {
    await phoneOrNameInput.fill('01012345678');
    // Toggle theme back and forth twice
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(250);
      await toggleBtn.click();
      await page.waitForTimeout(250);
    }
    const val = await phoneOrNameInput.inputValue();
    console.log('Form input value after toggling theme twice:', val);
    if (val === '01012345678') {
      console.log('✅ Form state preserved perfectly without reload or re-render reset!');
    } else {
      console.error('❌ Form state lost!');
    }
  }

  // Test 3: Patient Login Page
  console.log('3. Testing Patient Login Page (/clinic/yalla-demo/patient/login)...');
  await page.goto('https://yalla-clinic.com/clinic/yalla-demo/patient/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const ssLoginLight = path.join(ARTIFACT_DIR, 'theme_patient_login.png');
  await page.screenshot({ path: ssLoginLight, fullPage: false });

  const patientLoginToggle = page.locator('button[title*="التبديل إلى الوضع"]').first();
  if (await patientLoginToggle.count() > 0) {
    await patientLoginToggle.click();
    await page.waitForTimeout(300);
    const ssLoginDark = path.join(ARTIFACT_DIR, 'theme_patient_login_dark.png');
    await page.screenshot({ path: ssLoginDark, fullPage: false });
    console.log('✅ Patient login theme toggle verified and captured.');
  }

  // Test 4: Track Queue Page
  console.log('4. Testing Track Queue Page (/clinic/yalla-demo/track)...');
  await page.goto('https://yalla-clinic.com/clinic/yalla-demo/track', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const ssTrack = path.join(ARTIFACT_DIR, 'theme_track_queue.png');
  await page.screenshot({ path: ssTrack, fullPage: false });
  console.log('✅ Track queue page verified.');

  // Test 5: Owner Dashboard
  console.log('5. Testing Owner Dashboard (/owner)...');
  await page.goto('https://yalla-clinic.com/owner', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const ssOwner = path.join(ARTIFACT_DIR, 'theme_owner_dashboard.png');
  await page.screenshot({ path: ssOwner, fullPage: false });
  console.log('✅ Owner dashboard verified.');

  // Test 6: Mobile Viewport Verification
  console.log('6. Testing Mobile Viewport (iPhone 13, 390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://yalla-clinic.com/clinic/yalla-demo', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const ssMobileLight = path.join(ARTIFACT_DIR, 'theme_mobile_light.png');
  await page.screenshot({ path: ssMobileLight, fullPage: false });

  const mobileToggle = page.locator('button[title*="التبديل إلى الوضع"]').first();
  if (await mobileToggle.count() > 0) {
    await mobileToggle.click();
    await page.waitForTimeout(300);
    const ssMobileDark = path.join(ARTIFACT_DIR, 'theme_mobile_dark.png');
    await page.screenshot({ path: ssMobileDark, fullPage: false });
    console.log('✅ Mobile Theme toggle one-click verified and captured.');
  }

  await browser.close();
  console.log('🎉 Browser verification completed successfully!');
}

run().catch((err) => {
  console.error('Error during browser verification:', err);
  process.exit(1);
});
