import { test, expect } from '@playwright/test';

test('Full Clinic Platform Simulation', async ({ page }) => {
  test.setTimeout(120000); // 2 mins max
  
  await page.goto('/clinic/demo');

  const patients = [
    { name: 'محمد أحمد', phone: '01011111111', age: '30' },
    { name: 'سارة محمود', phone: '01022222222', age: '25' },
    { name: 'علي حسن', phone: '01033333333', age: '45' }
  ];

  for (const p of patients) {
    await page.click('button:has-text("احجز موعدك الآن")');
    await page.waitForTimeout(1000);

    // Step 1
    await page.fill('input[placeholder="01012345678"]', p.phone);
    await page.fill('input[placeholder="مثال: محمد أحمد"]', p.name);
    await page.fill('input[placeholder="25"]', p.age);
    await page.locator('button', { hasText: 'التالي' }).first().click();

    // Step 2
    await page.waitForTimeout(500); 
    await page.locator('.space-y-3 > div').first().click(); // Click first service
    await page.locator('button', { hasText: 'التالي' }).first().click();

    // Step 3
    await page.waitForTimeout(500);
    await page.locator('button', { hasText: 'تأكيد الحجز النهائي' }).first().click();

    // Wait for success and close modal
    await page.waitForTimeout(2000);
    await page.locator('button', { hasText: 'إغلاق' }).first().click();
    await page.waitForTimeout(500);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  // Dashboard login
  await page.goto('/clinic/demo/login');
  await page.waitForTimeout(2000);

  // We are just showing the user the page
  console.log("Done booking 3 patients, navigating to dashboard!");
});
