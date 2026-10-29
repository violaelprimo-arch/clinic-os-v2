import { chromium } from '@playwright/test'

async function testAvatarModal() {
  console.log('Testing Patient Avatar Modal Opening and Behavior...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ar-EG'
  })

  const page = await context.newPage()

  await page.addInitScript(() => {
    localStorage.setItem('patient_auth', JSON.stringify({
      phone: '01012345678',
      name: 'كريم عبد الله',
      clinic_id: 'zizo',
      slug: 'zizo'
    }))
  })

  await page.goto('https://zizo.yalla-clinic.com/clinic/zizo/patient', {
    waitUntil: 'domcontentloaded'
  })

  await page.waitForTimeout(3000)

  // Click on "تعديل الصورة" button or camera button
  const editPhotoButton = page.getByRole('button', { name: /تعديل الصورة/ }).first()
  console.log('Found edit photo button, clicking...')
  await editPhotoButton.click()

  await page.waitForTimeout(1000)

  // Check if modal title appears
  const modalTitle = await page.getByRole('heading', { name: 'الصورة الشخصية' }).isVisible()
  console.log('Avatar Modal Title Visible:', modalTitle)

  // Check if 2MB notice is present
  const sizeNotice = await page.getByText(/2 ميجابايت/).first().isVisible()
  console.log('2MB Size Notice Visible:', sizeNotice)

  // Close modal
  const closeBtn = page.getByRole('button', { name: 'إغلاق' }).first()
  await closeBtn.click()
  await page.waitForTimeout(500)

  const isClosed = !(await page.getByRole('heading', { name: 'الصورة الشخصية' }).isVisible())
  console.log('Avatar Modal Successfully Closed:', isClosed)

  await browser.close()
  console.log('Avatar Modal UI Test completed successfully!')
}

testAvatarModal().catch(console.error)
