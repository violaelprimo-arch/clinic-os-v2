import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('1. Verify demo files and components exist', () => {
  const files = [
    'src/components/landing/InteractiveProductDemo.tsx',
    'src/components/landing/demo/types.ts',
    'src/components/landing/demo/useDemoClinic.ts',
    'src/components/landing/demo/DemoBrowserFrame.tsx',
    'src/components/landing/demo/DemoPlatformTabs.tsx',
    'src/components/landing/demo/DemoDoctorDashboard.tsx',
    'src/components/landing/demo/DemoPatientRecords.tsx',
    'src/components/landing/demo/DemoPrescriptionView.tsx',
    'src/components/landing/demo/DemoReportsView.tsx',
    'src/components/landing/demo/DemoPatientPortal.tsx',
    'src/components/landing/demo/DemoGuidedTour.tsx',
    'src/components/landing/demo/DemoFullScreenModal.tsx',
  ]

  for (const file of files) {
    const fullPath = path.resolve(process.cwd(), file)
    assert.ok(fs.existsSync(fullPath), `File ${file} must exist`)
    const stat = fs.statSync(fullPath)
    assert.ok(stat.size > 200, `File ${file} should have substantial content`)
  }
})

test('2. Verify strict isolation from production database (zero firestore imports in demo)', () => {
  const demoFiles = [
    'src/components/landing/InteractiveProductDemo.tsx',
    'src/components/landing/demo/types.ts',
    'src/components/landing/demo/useDemoClinic.ts',
    'src/components/landing/demo/DemoBrowserFrame.tsx',
    'src/components/landing/demo/DemoPlatformTabs.tsx',
    'src/components/landing/demo/DemoDoctorDashboard.tsx',
    'src/components/landing/demo/DemoPatientRecords.tsx',
    'src/components/landing/demo/DemoPrescriptionView.tsx',
    'src/components/landing/demo/DemoReportsView.tsx',
    'src/components/landing/demo/DemoPatientPortal.tsx',
    'src/components/landing/demo/DemoGuidedTour.tsx',
    'src/components/landing/demo/DemoFullScreenModal.tsx',
  ]

  for (const file of demoFiles) {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
    assert.ok(!content.includes("from 'firebase/firestore'"), `${file} must not import firestore`)
    assert.ok(!content.includes("from '@/lib/firebase'"), `${file} must not import firebase db`)
    assert.ok(!content.includes('/api/clinic/book'), `${file} must not call real booking endpoint`)
    assert.ok(!content.includes('/api/send-otp'), `${file} must not call real OTP endpoint`)
  }
})

test('3. Verify Homepage restores dynamic screenshots showcase and removes embedded demo', () => {
  const landingContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/LandingPageContent.tsx'),
    'utf8',
  )

  assert.ok(
    landingContent.includes("import { ShowcaseLightbox } from '@/components/landing/ShowcaseLightbox'"),
    'LandingPageContent must import ShowcaseLightbox',
  )
  assert.ok(
    !landingContent.includes('<InteractiveProductDemo'),
    'LandingPageContent must not render <InteractiveProductDemo',
  )
  assert.ok(
    landingContent.includes('شوف التفاصيل اللي بتفرق'),
    'Restored screenshots gallery title must be present in the main showcase section',
  )
  assert.ok(
    landingContent.includes('visibleScreenshots'),
    'Showcase section must dynamically filter visible screenshots',
  )
})

test('4. Verify LandingPageConfig schema supports dynamic screenshots with isVisible and altText', () => {
  const configContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/landing-config.ts'),
    'utf8',
  )

  assert.ok(configContent.includes('isVisible: z.boolean().default(true)'), 'Schema must support isVisible')
  assert.ok(configContent.includes('altText: z.string()'), 'Schema must support altText')
  assert.ok(configContent.includes('ScreenshotItem'), 'Must export ScreenshotItem type')
})

test('5. Verify LandingPageManager provides complete showcase management interface', () => {
  const lpmContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/owner/LandingPageManager.tsx'),
    'utf8',
  )

  assert.ok(lpmContent.includes('صور استعراض المنصة'), 'LandingPageManager must have Platform Showcase section')
  assert.ok(lpmContent.includes('handleAddScreenshot'), 'Must support adding screenshots')
  assert.ok(lpmContent.includes('handleEditScreenshot'), 'Must support editing screenshots')
  assert.ok(lpmContent.includes('handleDeleteScreenshot'), 'Must support deleting screenshots')
  assert.ok(lpmContent.includes('handleToggleVisibility'), 'Must support toggling screenshot visibility')
  assert.ok(lpmContent.includes('handleMoveScreenshot'), 'Must support reordering screenshots')
})

test('6. Verify in-memory state engine simulates full connected clinic lifecycle', () => {
  const stateContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/demo/useDemoClinic.ts'),
    'utf8',
  )

  // Must have core functions
  assert.ok(stateContent.includes('bookAppointment'), 'Must include bookAppointment')
  assert.ok(stateContent.includes('startExamination'), 'Must include startExamination')
  assert.ok(stateContent.includes('completeExamination'), 'Must include completeExamination')
  assert.ok(stateContent.includes('skipAppointment'), 'Must include skipAppointment')
  assert.ok(stateContent.includes('reinstateAppointment'), 'Must include reinstateAppointment')
  assert.ok(stateContent.includes('savePrescription'), 'Must include savePrescription')
  assert.ok(stateContent.includes('resetDemo'), 'Must include resetDemo')

  // Initial state checks
  assert.ok(stateContent.includes('INITIAL_APPOINTMENTS'), 'Must include INITIAL_APPOINTMENTS')
  assert.ok(stateContent.includes('INITIAL_PATIENTS'), 'Must include INITIAL_PATIENTS')
  assert.ok(stateContent.includes('INITIAL_PRESCRIPTIONS'), 'Must include INITIAL_PRESCRIPTIONS')
})

test('7. Verify Guided Tour contains all required tour steps and accessibility features', () => {
  const tourContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/demo/DemoGuidedTour.tsx'),
    'utf8',
  )

  assert.ok(tourContent.includes('TOUR_STEPS'), 'Tour must define TOUR_STEPS')
  assert.ok(tourContent.includes('kpi-summary'), 'Step 1 summary must exist')
  assert.ok(tourContent.includes('active-exam'), 'Step 2 exam room must exist')
  assert.ok(tourContent.includes('patient-records'), 'Step 3 patient records must exist')
  assert.ok(tourContent.includes('smart-rx'), 'Step 4 smart rx must exist')
  assert.ok(tourContent.includes('finance-reports'), 'Step 5 reports must exist')
  assert.ok(tourContent.includes('patient-booking'), 'Step 6 patient booking must exist')

  // Keyboard navigation & accessibility
  assert.ok(tourContent.includes('Escape'), 'Must support Escape key to close')
  assert.ok(tourContent.includes('ArrowRight') && tourContent.includes('ArrowLeft'), 'Must support arrow key navigation')
  assert.ok(tourContent.includes('role="dialog"'), 'Must have role=dialog')
})

test('8. Verify A4 Prescription reuse and demo PDF/print export capabilities', () => {
  const rxContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/demo/DemoPrescriptionView.tsx'),
    'utf8',
  )

  assert.ok(rxContent.includes('A4Prescription'), 'Must reuse existing A4Prescription component')
  assert.ok(rxContent.includes('generateA4PrescriptionHtml'), 'Must use print service html generator')
  assert.ok(rxContent.includes('handleDownloadPdf'), 'Must support demo PDF/document download')
  assert.ok(rxContent.includes('handlePrint'), 'Must support iframe print')
})

test('9. Verify Browser Frame mockup and Fullscreen expanded mode', () => {
  const frameContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/demo/DemoBrowserFrame.tsx'),
    'utf8',
  )
  const fullScreenContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/demo/DemoFullScreenModal.tsx'),
    'utf8',
  )

  assert.ok(frameContent.includes('yallaclinic.com/demo/workspace'), 'Must show demo address bar')
  assert.ok(frameContent.includes('bg-rose-500/80') && frameContent.includes('bg-amber-500/80'), 'Must show traffic light dots')
  assert.ok(frameContent.includes('onToggleFullScreen'), 'Must support fullscreen toggle')
  assert.ok(fullScreenContent.includes('role="dialog"'), 'Fullscreen modal must be accessible dialog')
})

test('10. Verify bottom CTA connects to existing trial request modal', () => {
  const mainDemoContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/InteractiveProductDemo.tsx'),
    'utf8',
  )

  assert.ok(mainDemoContent.includes('جاهز لتجربة المنصة على عيادتك؟'), 'Must include bottom CTA heading')
  assert.ok(mainDemoContent.includes('onOpenTrial'), 'Must connect to existing trial modal handler')
  assert.ok(mainDemoContent.includes('trialWhatsappHref'), 'Must connect to trial WhatsApp href')
})
