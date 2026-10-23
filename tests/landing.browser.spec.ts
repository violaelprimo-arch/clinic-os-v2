import { test, expect, type Page } from '@playwright/test'
import { DEFAULT_LANDING_CONFIG } from '../src/lib/landing-config'
async function fixture(page: Page, owner = false) {
  let config = structuredClone(DEFAULT_LANDING_CONFIG),
    saveFailure = false,
    submissionFailure = false
  const requests: { path: string; body: Record<string, unknown> }[] = [],
    errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'platform-owner',
      user_id: 'platform-owner',
      aud: 'build-test',
      iss: 'https://securetoken.google.com/build-test',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'yallacodex@gmail.com',
      firebase: { sign_in_provider: 'custom' },
    }),
  ).toString('base64url')
  const token =
    Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
      'base64url',
    ) +
    '.' +
    payload +
    '.fixture'
  await page.context().route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.href === 'https://images.example.test/clinic.svg') {
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="72"><rect width="100" height="72" fill="#0d9488"/></svg>',
      })
      return
    }
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      await route.fulfill({
        json: url.pathname.includes('signInWithPassword')
          ? {
              idToken: token,
              refreshToken: 'fixture-refresh',
              expiresIn: '3600',
              localId: 'platform-owner',
            }
          : {
              users: [
                {
                  localId: 'platform-owner',
                  email: 'yallacodex@gmail.com',
                  providerUserInfo: [],
                },
              ],
            },
      })
      return
    }
    if (url.origin !== 'http://127.0.0.1:3100') {
      await route.abort()
      return
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }
    let body = {}
    try {
      body = request.postDataJSON() || {}
    } catch {}
    requests.push({ path: url.pathname, body })
    if (url.pathname === '/api/landing') {
      await route.fulfill({ json: { config } })
      return
    }
    if (url.pathname === '/api/auth/owner-login') {
      await route.fulfill({
        status: owner ? 200 : 403,
        json: owner
          ? { success: true, owner: { uid: 'platform-owner', email: 'yallacodex@gmail.com', role: 'owner' } }
          : { error: 'حساب غير مصرح له.', code: 'OWNER_ACCESS_DENIED' },
      })
      return
    }
    if (url.pathname === '/api/auth/owner-session') {
      await route.fulfill({
        status: owner ? 200 : 401,
        json: owner
          ? {
              owner: { email: 'yallacodex@gmail.com' },
              firebaseToken: 'fixture-token',
            }
          : { error: 'سجّل الدخول أولًا.' },
      })
      return
    }
    if (url.pathname === '/api/owner/landing') {
      if (request.method() === 'PUT') {
        if (saveFailure) {
          await route.fulfill({
            status: 503,
            json: { error: 'تعذر الحفظ', code: 'SERVICE_UNAVAILABLE' },
          })
          return
        }
        config = request.postDataJSON()
        await route.fulfill({ json: { success: true } })
        return
      }
      await route.fulfill({ json: { config } })
      return
    }
    if (url.pathname === '/api/owner/landing/feedback') {
      await route.fulfill({ json: { feedback: [] } })
      return
    }
    if (url.pathname === '/api/owner/landing/trials') {
      await route.fulfill({ json: { requests: [] } })
      return
    }
    if (url.pathname.startsWith('/api/landing/')) {
      await route.fulfill({
        status: submissionFailure ? 503 : 201,
        json: submissionFailure
          ? { error: 'تعذر الاتصال بالخدمة' }
          : { success: true, pending: true },
      })
      return
    }
    await route.fulfill({ json: {} })
  })
  return {
    requests,
    errors,
    get config() {
      return config
    },
    failSave() {
      saveFailure = true
    },
    failSubmission() {
      submissionFailure = true
    },
  }
}
async function logIntoOwner(page: Page) {
  await expect(page.getByRole('heading', { name: 'دخول مالك المنصة' })).toBeVisible()
  await page.locator('[name="password"]').fill('fixture-owner-password')
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible()
}
test('public page supports Arabic, English, themes and mobile layout', async ({
  page,
}) => {
  const data = await fixture(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'عيادتك منظمة.',
  )
  await page.screenshot({
    path: 'test-results/landing-desktop-ar.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Toggle Theme', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Toggle Theme', exact: true }).click()
  await page
    .getByRole('button', { name: 'Toggle Language', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'An organized clinic.',
  )
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/landing-mobile.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Toggle Language', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(data.errors).toEqual([])
})
test('feedback goes to moderation and does not appear immediately', async ({
  page,
}) => {
  const data = await fixture(page)
  await page.goto('/')
  const form = page
    .locator('form')
    .filter({ has: page.locator('[name="authorName"]') })
  await form.locator('[name="authorName"]').fill('طبيب اختبار')
  await form.locator('[name="clinicName"]').fill('عيادة اختبار')
  await form.locator('[name="comment"]').fill('تجربة مفيدة للاختبار فقط')
  await form.getByRole('button', { name: 'إرسال الرأي للمراجعة' }).click()
  await expect(form.getByRole('status')).toContainText('وصل للمراجعة')
  expect(
    data.requests.filter((item) => item.path === '/api/landing/feedback'),
  ).toHaveLength(1)
  await expect(page.locator('blockquote')).toHaveCount(0)
})
test('trial modal validates and saves contact information', async ({
  page,
}) => {
  const data = await fixture(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ تجربة مجانية' }).first().click()
  const dialog = page.getByRole('dialog')
  for (const [name, value] of Object.entries({
    doctorName: 'طبيب اختبار',
    clinicName: 'عيادة اختبار',
    specialty: 'أسنان',
    phone: '01551007018',
    email: 'test@example.test',
  }))
    await dialog.locator(`[name="${name}"]`).fill(value)
  await dialog.getByRole('button', { name: 'إرسال طلب التجربة' }).click()
  await expect(dialog.getByRole('status')).toContainText('تم تسجيل طلبك')
  await expect(
    dialog.getByRole('link', { name: 'متابعة الطلب على واتساب' }),
  ).toHaveAttribute('href', /wa\.me\/201551007018/)
  expect(
    data.requests.filter((item) => item.path === '/api/landing/trials'),
  ).toHaveLength(1)
})
test('failed submission is visible and never reports a saved trial', async ({
  page,
}) => {
  const data = await fixture(page)
  data.failSubmission()
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ تجربة مجانية' }).first().click()
  const dialog = page.getByRole('dialog')
  for (const [name, value] of Object.entries({
    doctorName: 'طبيب اختبار',
    clinicName: 'عيادة اختبار',
    specialty: 'أسنان',
    phone: '01551007018',
    email: 'test@example.test',
  }))
    await dialog.locator(`[name="${name}"]`).fill(value)
  await dialog.getByRole('button', { name: 'إرسال طلب التجربة' }).click()
  await expect(dialog.getByRole('alert')).toContainText('تعذر الاتصال')
  await expect(dialog.getByRole('status')).toHaveCount(0)
})
test('owner dashboard stays behind the login gate', async ({ page }) => {
  const data = await fixture(page)
  await page.goto('/owner')
  await expect(
    page.getByRole('heading', { name: 'دخول مالك المنصة' }),
  ).toBeVisible()
  await expect(page.locator('[name="email"]')).toHaveValue(
    'yallacodex@gmail.com',
  )
  await expect(
    page.getByRole('heading', {
      name: 'إدارة الواجهة الرئيسية',
      exact: true,
    }),
  ).toHaveCount(0)
  expect(
    data.requests.some((item) => item.path.startsWith('/api/owner/')),
  ).toBe(false)
})
test('owner edits remain in preview until explicitly published', async ({
  page,
}) => {
  const data = await fixture(page, true)
  await page.goto('/owner')
  await logIntoOwner(page)
  await page
    .getByRole('button', { name: 'الواجهة الرئيسية', exact: true })
    .last()
    .click()
  const editor = page.getByRole('heading', {
    name: 'إدارة الواجهة الرئيسية',
    exact: true,
  })
  await expect(editor).toBeVisible()
  const title = page.getByLabel('العنوان الرئيسي', { exact: true })
  await title.fill('عنوان اختبار غير منشور')
  expect(data.config.heroTitle).toBe(DEFAULT_LANDING_CONFIG.heroTitle)
  const frame = page.frameLocator('iframe[title="بروفة الواجهة الرئيسية"]')
  await expect(frame.getByRole('heading', { level: 1 })).toContainText(
    'عنوان اختبار غير منشور',
  )
  await page.getByRole('button', { name: 'موبايل', exact: true }).click()
  expect(
    await page
      .locator('iframe[title="بروفة الواجهة الرئيسية"]')
      .evaluate((node) => (node as HTMLIFrameElement).style.width),
  ).toBe('390px')
  await page
    .getByRole('button', { name: 'المميزات', exact: true, pressed: true })
    .click()
  await expect(frame.locator('#features')).toHaveCount(0)
  await page.getByRole('button', { name: 'الصور', exact: true }).click()
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
  const imageUrl = 'https://images.example.test/clinic.svg'
  await page
    .getByRole('textbox', { name: 'رابط الصورة' })
    .first()
    .fill(imageUrl)
  await expect(
    page.getByRole('img', { name: 'معاينة الصورة', exact: true }).first(),
  ).toHaveAttribute('src', imageUrl)
  expect(data.config.screenshots[0].imageUrl).toBe(
    DEFAULT_LANDING_CONFIG.screenshots[0].imageUrl,
  )
  await expect(
    frame.getByRole('img', { name: 'عرض توضيحي للوحة يلا كلينك' }),
  ).toHaveAttribute('src', imageUrl)
  await page.getByRole('button', { name: 'حفظ ونشر', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('تم حفظ ونشر')
  expect(data.config.heroTitle).toBe('عنوان اختبار غير منشور')
  expect(data.config.visibility.showFeatures).toBe(false)
  expect(data.config.screenshots[0].imageUrl).toBe(imageUrl)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'عنوان اختبار غير منشور',
  )
  await expect(page.locator('#features')).toHaveCount(0)
  const publishedImage = page.getByRole('img', {
    name: 'عرض توضيحي للوحة يلا كلينك',
    exact: true,
  })
  await expect(publishedImage).toHaveAttribute('src', imageUrl)
  await expect(publishedImage).toHaveJSProperty('naturalWidth', 100)
  expect(data.errors).toEqual([])
})
test('failed CMS save keeps the draft and reports the failure', async ({
  page,
}) => {
  const data = await fixture(page, true)
  data.failSave()
  await page.goto('/owner')
  await logIntoOwner(page)
  await page
    .getByRole('button', { name: 'الواجهة الرئيسية', exact: true })
    .last()
    .click()
  await page
    .getByLabel('العنوان الرئيسي', { exact: true })
    .fill('مسودة لا تضيع')
  await page.getByRole('button', { name: 'حفظ ونشر', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'تعذر الحفظ' }),
  ).toBeVisible()
  await expect(page.getByLabel('العنوان الرئيسي', { exact: true })).toHaveValue(
    'مسودة لا تضيع',
  )
  expect(data.config.heroTitle).toBe(DEFAULT_LANDING_CONFIG.heroTitle)
})
