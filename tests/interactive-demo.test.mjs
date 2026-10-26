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

test('3. Verify Homepage integrates InteractiveProductDemo and replaces static screenshots', () => {
  const landingContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/landing/LandingPageContent.tsx'),
    'utf8',
  )

  assert.ok(
    landingContent.includes("import { InteractiveProductDemo } from '@/components/landing/InteractiveProductDemo'"),
    'LandingPageContent must import InteractiveProductDemo',
  )
  assert.ok(
    landingContent.includes('<InteractiveProductDemo'),
    'LandingPageContent must render <InteractiveProductDemo',
  )
  assert.ok(
    !landingContent.includes('شوف التفاصيل اللي بتفرق'),
    'Old static screenshot title must be replaced from the main showcase section',
  )
})

test('4. Verify LandingPageConfig schema supports customizable demo section title & subtitle', () => {
  const configContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/landing-config.ts'),
    'utf8',
  )

  assert.ok(configContent.includes('demoSectionTitle: short.default('), 'Schema must support demoSectionTitle')
  assert.ok(configContent.includes('demoSectionSubtitle: text.default('), 'Schema must support demoSectionSubtitle')
  assert.ok(configContent.includes('جرّب يلا كلينيك بنفسك'), 'Default Arabic title must be present')
  assert.ok(configContent.includes('Try Yalla Clinic Yourself'), 'Default English title must be present')
})

test('5. Verify LandingPageManager allows customizing demo section title and description', () => {
  const lpmContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/owner/LandingPageManager.tsx'),
    'utf8',
  )

  assert.ok(lpmContent.includes('demoSectionTitle'), 'LandingPageManager must allow setting demoSectionTitle')
  assert.ok(lpmContent.includes('demoSectionSubtitle'), 'LandingPageManager must allow setting demoSectionSubtitle')
  assert.ok(lpmContent.includes('إعدادات الديمو التفاعلي'), 'Interactive demo settings card must be present')
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
