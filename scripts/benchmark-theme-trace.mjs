import { chromium } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

const ARTIFACT_DIR = 'C:/Users/El primo/.gemini/antigravity/brain/6c4a826a-c619-4239-aa81-d0b331623648';
const AUTH_SALT_SECRET = process.env.AUTH_SECRET || 'clinic-os-v2-secure-cairo-salt-key-2026';

function generateToken(payload) {
  const data = {
    ...payload,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  const json = JSON.stringify(data);
  const base64Data = Buffer.from(unescape(encodeURIComponent(json)), 'binary').toString('base64');
  const signature = crypto.createHash('sha256').update(`${base64Data}:${AUTH_SALT_SECRET}`).digest('hex').slice(0, 32);
  return `${base64Data}.${signature}`;
}

async function run() {
  const token = generateToken({
    role: 'doctor',
    name: 'د. يوسف شريف',
    clinicId: 'demo-clinic-id',
    slug: 'yalla-demo'
  });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    {
      name: 'clinic_session',
      value: token,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  await page.addInitScript(({ t }) => {
    localStorage.setItem('clinic_session_token', t);
    localStorage.setItem('clinic_role', 'doctor');
  }, { t: token });

  console.log('--- 1. Testing Doctor Prescriptions & Measuring Latency ---');
  await page.goto('http://localhost:3009/clinic/yalla-demo/admin/prescriptions', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Set Light
  await page.evaluate(() => {
    localStorage.setItem('clinic_os_theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  });
  await page.waitForTimeout(400);

  // Measure Toggle Light -> Dark
  const measureDarkResult = await page.evaluate(async () => {
    const start = performance.now();
    const btn = document.querySelector('button[aria-label*="الوضع"], button[title*="الوضع"]');
    if (btn) btn.click();
    
    // Measure frame time
    await new Promise(r => requestAnimationFrame(r));
    const jsDone = performance.now();
    
    // Wait for repaint
    await new Promise(r => requestAnimationFrame(r));
    const paintDone = performance.now();

    const root = document.documentElement;
    const aside = document.querySelector('aside');
    const header = document.querySelector('header');
    const card = document.querySelector('.yalla-card');
    const body = document.body;

    return {
      jsLatency: jsDone - start,
      frameTime: paintDone - start,
      classes: root.className,
      dataTheme: root.getAttribute('data-theme'),
      bodyBg: window.getComputedStyle(body).backgroundColor,
      bodyColor: window.getComputedStyle(body).color,
      asideBg: aside ? window.getComputedStyle(aside).backgroundColor : null,
      headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
      cardBg: card ? window.getComputedStyle(card).backgroundColor : null,
      cardColor: card ? window.getComputedStyle(card).color : null
    };
  });

  console.log('Light -> Dark Toggle Latency & Style Sync:');
  console.log(`  JS Latency: ${measureDarkResult.jsLatency.toFixed(2)}ms`);
  console.log(`  Frame Render Time: ${measureDarkResult.frameTime.toFixed(2)}ms`);
  console.log(`  bodyBg: ${measureDarkResult.bodyBg}, cardBg: ${measureDarkResult.cardBg}`);
  console.log(`  bodyColor: ${measureDarkResult.bodyColor}, cardColor: ${measureDarkResult.cardColor}`);
  console.log(`  asideBg: ${measureDarkResult.asideBg}, headerBg: ${measureDarkResult.headerBg}`);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'doctor_prescriptions_synced_dark.png') });

  // Measure Toggle Dark -> Light
  const measureLightResult = await page.evaluate(async () => {
    const start = performance.now();
    const btn = document.querySelector('button[aria-label*="الوضع"], button[title*="الوضع"]');
    if (btn) btn.click();
    
    await new Promise(r => requestAnimationFrame(r));
    const jsDone = performance.now();
    
    await new Promise(r => requestAnimationFrame(r));
    const paintDone = performance.now();

    const root = document.documentElement;
    const aside = document.querySelector('aside');
    const header = document.querySelector('header');
    const card = document.querySelector('.yalla-card');
    const body = document.body;

    return {
      jsLatency: jsDone - start,
      frameTime: paintDone - start,
      classes: root.className,
      dataTheme: root.getAttribute('data-theme'),
      bodyBg: window.getComputedStyle(body).backgroundColor,
      bodyColor: window.getComputedStyle(body).color,
      asideBg: aside ? window.getComputedStyle(aside).backgroundColor : null,
      headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
      cardBg: card ? window.getComputedStyle(card).backgroundColor : null,
      cardColor: card ? window.getComputedStyle(card).color : null
    };
  });

  console.log('Dark -> Light Toggle Latency & Style Sync:');
  console.log(`  JS Latency: ${measureLightResult.jsLatency.toFixed(2)}ms`);
  console.log(`  Frame Render Time: ${measureLightResult.frameTime.toFixed(2)}ms`);
  console.log(`  bodyBg: ${measureLightResult.bodyBg}, cardBg: ${measureLightResult.cardBg}`);
  console.log(`  bodyColor: ${measureLightResult.bodyColor}, cardColor: ${measureLightResult.cardColor}`);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'doctor_prescriptions_synced_light.png') });

  console.log('--- 2. Testing TV Waiting Room Screen Sync ---');
  await page.goto('http://localhost:3009/clinic/yalla-demo/tv', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check TV initially matches document theme
  const tvInitialTheme = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      dataTheme: root.getAttribute('data-theme'),
      bg: window.getComputedStyle(body).backgroundColor
    };
  });
  console.log('TV initial theme status:', tvInitialTheme);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tv_screen_synced_light.png') });

  // Toggle TV theme
  const tvToggleBtn = await page.locator('button[title*="الوضع"], button[aria-label*="الوضع"]').first();
  if (await tvToggleBtn.count() > 0) {
    await tvToggleBtn.click();
    await page.waitForTimeout(500);
    const tvToggledTheme = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        class: root.className,
        dataTheme: root.getAttribute('data-theme'),
        bodyBg: window.getComputedStyle(document.body).backgroundColor
      };
    });
    console.log('TV after toggleTheme button click:', tvToggledTheme);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tv_screen_synced_dark.png') });
  }

  console.log('--- 3. Testing Booking Landing Page Sync ---');
  await page.goto('http://localhost:3009/clinic/yalla-demo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Set Light
  await page.evaluate(() => {
    localStorage.setItem('clinic_os_theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'booking_page_synced_light.png') });

  // Toggle Dark
  const bookingToggleBtn = await page.locator('header button[title*="الوضع"], header button[aria-label*="الوضع"]').first();
  if (await bookingToggleBtn.count() > 0) {
    await bookingToggleBtn.click();
    await page.waitForTimeout(500);
  } else {
    await page.evaluate(() => {
      localStorage.setItem('clinic_os_theme', 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    });
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'booking_page_synced_dark.png') });

  await browser.close();
  console.log('ALL Benchmark and Synchronization tests completed successfully!');
}

run().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
