import { chromium } from '@playwright/test';

async function measure() {
  console.log('--- Benchmarking Theme Toggle Performance ---');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://yalla-clinic.com/clinic/yalla-demo', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  const toggleBtn = page.locator('button[title*="التبديل إلى الوضع"]').first();
  if (await toggleBtn.count() === 0) {
    console.error('ThemeToggle button not found!');
    await browser.close();
    return;
  }

  // Measure 10 theme toggle cycles
  const results = [];
  for (let i = 0; i < 10; i++) {
    const elapsed = await page.evaluate(async () => {
      const btn = document.querySelector('button[title*="التبديل إلى الوضع"]');
      const start = performance.now();
      btn.click();
      // Wait for next animation frame and layout settlement
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      }));
      return performance.now() - start;
    });
    results.push(elapsed);
    await page.waitForTimeout(100);
  }

  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const max = Math.max(...results);
  const min = Math.min(...results);

  console.log(`Results across 10 toggles:`);
  console.log(`Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Avg: ${avg.toFixed(2)}ms`);

  await browser.close();
  return { avg, min, max, results };
}

measure().catch(console.error);
