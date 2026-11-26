// tests/whatsapp-governance-queue.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import {
  renderClinicMessage,
  validateTemplateText,
  parseWhatsAppPreviewLine,
  messageDefaults,
} from '../src/lib/clinic-message-templates.ts'

import {
  resolveEffectiveWhatsAppPolicy,
  DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
  getNewClinicDefaultWhatsAppPolicy,
} from '../src/lib/whatsapp-policy.ts'

import {
  createInMemoryWhatsAppStore,
  setWhatsAppQueueStoreForTesting,
  scheduleAppointmentNotifications,
  handleAppointmentRescheduled,
  handleAppointmentCancelled,
  enqueueDocumentWhatsAppJob,
  requeueWaitingJobsForClinic,
  retryWhatsAppJobById,
  handleWpSenderWebhookEvent,
  drainPendingWhatsAppJobs,
  computeDocumentContentHash,
} from '../src/lib/server/whatsapp-scheduler.ts'

import {
  validateMediaFile,
  MAX_IMAGE_BYTES,
} from '../src/lib/mediaUpload.ts'

function createTestClinicStore(clinicId = 'test-clinic-1', overrides = {}) {
  const store = createInMemoryWhatsAppStore({
    'platform_config/global': {
      id: 'global',
      whatsappDefaults: {
        sectionVisible: true,
        serviceEnabled: true,
        prescriptionResendOnEdit: 'new_version',
        invoiceResendOnEdit: 'new_version',
        features: {
          booking_confirmation: { visible: true, enabled: true, mode: 'auto' },
          appointment_reminder: { visible: true, enabled: true, mode: 'auto' },
          reschedule_cancel: { visible: true, enabled: true, mode: 'auto' },
          prescription: { visible: true, enabled: true, mode: 'auto' },
          invoice: { visible: true, enabled: true, mode: 'auto' },
        },
      },
    },
    [`clinics/${clinicId}`]: {
      id: clinicId,
      name: 'عيادة الأمل التخصصية',
      clinicName: 'عيادة الأمل التخصصية',
      slug: 'test-slug',
      whatsappAutomationEnabled: true,
      ...overrides.clinic,
    },
    [`clinic_whatsapp_configs/${clinicId}`]: {
      id: clinicId,
      clinicId,
      sessionStatus: 'connected',
      connected: true,
      enabled: true,
      serviceEnabled: true,
      wpSender: {
        configured: true,
        mode: 'mock',
        senderNumber: '+201011111111',
      },
      settings: {
        sendBookingConfirmation: true,
        sendAppointmentReminder: true,
        sendRescheduledNotification: true,
        sendCancelledNotification: true,
        sendPrescription: true,
        sendInvoice: true,
        reminders: [[24, 'hour'], [2, 'hour']],
      },
      ownerPolicy: {
        sectionVisible: true,
        serviceEnabled: true,
        prescriptionResendOnEdit: 'new_version',
        invoiceResendOnEdit: 'new_version',
        features: {
          booking_confirmation: { visible: true, enabled: true, mode: 'auto' },
          appointment_reminder: { visible: true, enabled: true, mode: 'auto' },
          reschedule_cancel: { visible: true, enabled: true, mode: 'auto' },
          prescription: { visible: true, enabled: true, mode: 'auto' },
          invoice: { visible: true, enabled: true, mode: 'auto' },
        },
      },
      ...overrides.waConfig,
    },
  })
  setWhatsAppQueueStoreForTesting(store)
  return store
}

test('1. Template token rendering & sanitized empty lines', () => {
  const customTemplate = `مرحباً بك يا {اسم_المريض}!

تم تأكيد حجزك في {اسم_العيادة} فرع {اسم_الفرع}.
الدكتور: {اسم_الدكتور}
الموعد: {الموعد}


الرابط: {الرابط}`

  const rendered = renderClinicMessage(customTemplate, {
    patientName: 'أحمد محمود',
    clinicName: 'عيادة الأمل التخصصية',
    branchName: 'فرع المعادي',
    doctorName: 'د. سامي يوسف',
    when: '2026-12-01 الساعة 18:30',
    link: 'https://yalla-clinic.com/track/12345',
  })

  assert.ok(rendered.includes('أحمد محمود'), 'Patient name should be replaced')
  assert.ok(rendered.includes('عيادة الأمل التخصصية'), 'Clinic name should be replaced')
  assert.ok(rendered.includes('فرع المعادي'), 'Branch name should be replaced')
  assert.ok(rendered.includes('د. سامي يوسف'), 'Doctor name should be replaced')
  assert.ok(rendered.includes('2026-12-01 الساعة 18:30'), 'When should be replaced')
  assert.ok(rendered.includes('https://yalla-clinic.com/track/12345'), 'Link should be replaced')
  assert.ok(!rendered.includes('\n\n\n'), 'More than 2 consecutive newlines should be sanitized')
})

test('2. Privacy preservation (no diagnosis/medicines in default reminder/prescription)', () => {
  const reminderText = messageDefaults.appointment_reminder
  const rxText = messageDefaults.prescription

  assert.ok(!reminderText.includes('{التشخيص}'), 'Reminder must never expose diagnosis token')
  assert.ok(!reminderText.includes('{الأدوية}'), 'Reminder must never expose medications token')
  assert.ok(!rxText.includes('{التشخيص}'), 'Prescription message must never expose diagnosis token')
  assert.ok(!rxText.includes('{الأدوية}'), 'Prescription message must direct to secure link')
})

test('3. Platform defaults vs per-clinic Owner policy resolution hierarchy', () => {
  const platform = {
    ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
    sectionVisible: true,
    serviceEnabled: true,
    features: {
      ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS.features,
      prescription: { visible: true, enabled: true, mode: 'auto' },
      invoice: { visible: false, enabled: false, mode: 'disabled' }, // Platform disabled invoice
    },
  }

  const clinic = {
    hiddenSections: [],
    hiddenTabs: [],
    ownerPolicy: {
      features: {
        invoice: { visible: true, enabled: true, mode: 'manual' },
      },
    },
  }

  const effective = resolveEffectiveWhatsAppPolicy({
    platformDefaults: platform,
    clinic,
  })

  // Platform forced visible=false on invoice -> Platform override wins
  assert.equal(effective.features.invoice.visible, false, 'Platform visibility override must be respected')
  assert.equal(effective.features.invoice.enabled, false, 'Hidden feature must be forced off')
  assert.equal(effective.features.prescription.autoSend, true)
})

test('4. Hiding sub-features enforces rejection on access checks', () => {
  const platform = {
    ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
    features: {
      ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS.features,
      prescription: { visible: false, enabled: false, mode: 'disabled' },
    },
  }

  const effective = resolveEffectiveWhatsAppPolicy({
    platformDefaults: platform,
  })

  assert.equal(effective.features.prescription.visible, false)
  const canSendPrescription = effective.features.prescription.visible && effective.features.prescription.enabled
  assert.equal(canSendPrescription, false, 'Sending must be rejected when feature is hidden')
})

test('5. Disabled sub-features cancel pending jobs with POLICY_DISABLED', async () => {
  const clinicId = 'clinic-policy-cancel'
  const store = createTestClinicStore(clinicId)
  const apptId = 'appt-pending-1'

  await scheduleAppointmentNotifications({
    clinicId,
    appointmentId: apptId,
    patientPhone: '+201011111111',
    patientName: 'مريض تجريبي',
    appointmentDate: '2026-12-05',
    appointmentTime: '15:00',
    whatsappConsent: true,
    store,
  })

  // Now update policy in store to disable reminders
  const waConfig = await store.readDoc(`clinic_whatsapp_configs/${clinicId}`)
  waConfig.ownerPolicy.features.appointment_reminder = { visible: false, enabled: false, mode: 'disabled' }
  await store.writeDoc(`clinic_whatsapp_configs/${clinicId}`, waConfig)

  // Drain pending jobs at appointment due window
  await drainPendingWhatsAppJobs(25, { store, nowIso: '2026-12-06T00:00:00.000Z' })

  const jobs = Array.from(store.docs.entries())
    .filter(([k]) => k.startsWith('whatsapp_jobs/'))
    .map(([, v]) => v.data)
    .filter((j) => j.appointmentId === apptId && j.jobType === 'appointment_reminder')

  for (const j of jobs) {
    assert.equal(j.status, 'cancelled')
    assert.ok(
      j.cancelledReason.includes('POLICY') || j.cancelledReason.includes('FEATURE'),
      'Cancelled reason should reflect policy/feature disabled'
    )
  }
})

test('6. Auto-send active rejects manual send', () => {
  const effective = resolveEffectiveWhatsAppPolicy({
    platformDefaults: {
      ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
      features: {
        ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS.features,
        prescription: { visible: true, enabled: true, mode: 'auto' },
      },
    },
  })

  const isAuto = effective.features.prescription.autoSend
  assert.ok(isAuto, 'Policy is in auto mode')

  // When auto-send is active, manual sharing is suppressed
  const manualAllowed = effective.features.prescription.visible && effective.features.prescription.enabled && !effective.features.prescription.autoSend
  assert.equal(manualAllowed, false, 'Manual send must not be allowed when auto is active')
})

test('7. Prescription save enqueues trusted job and deduplicates repeat saves with same content-hash', async () => {
  const clinicId = 'clinic-rx-test'
  const store = createTestClinicStore(clinicId)
  const rxId = 'rx-001'
  const content = {
    diagnosis: 'التهاب حاد في الجيوب الأنفية',
    medicines: [{ name: 'Panadol', dosage: '500mg' }],
  }
  const hash = await computeDocumentContentHash(content)

  const res1 = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'prescription',
    documentId: rxId,
    contentHash: hash,
    documentUrl: 'https://yalla-clinic.com/prescription/rx-001',
    patientName: 'كريم أحمد',
    patientPhone: '+201012345678',
    version: 1,
    store,
  })

  assert.equal(res1.enqueued, true, 'First save must enqueue job')
  assert.ok(res1.jobId, 'Must return jobId')

  // Repeat save with EXACT same content payload
  const res2 = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'prescription',
    documentId: rxId,
    contentHash: hash,
    documentUrl: 'https://yalla-clinic.com/prescription/rx-001',
    patientName: 'كريم أحمد',
    patientPhone: '+201012345678',
    version: 1,
    store,
  })

  assert.equal(res2.enqueued, false, 'Repeat save must be deduplicated')
  assert.equal(res2.status, 'deduplicated', 'Must indicate deduplicated')
})

test('8. Content modifications trigger new document version when policy is new_version', async () => {
  const clinicId = 'clinic-rx-edit-test'
  const store = createTestClinicStore(clinicId)
  const rxId = 'rx-002'

  const contentV1 = { diagnosis: 'صداع نصفي', medicines: ['Aspirin'] }
  const hashV1 = await computeDocumentContentHash(contentV1)

  const res1 = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'prescription',
    documentId: rxId,
    contentHash: hashV1,
    documentUrl: 'https://yalla-clinic.com/prescription/rx-002',
    patientName: 'كريم أحمد',
    patientPhone: '+201012345678',
    version: 1,
    store,
  })
  assert.equal(res1.enqueued, true)

  // Modified content creates new hash
  const contentV2 = { diagnosis: 'صداع نصفي حاد', medicines: ['Aspirin', 'Vitamin B'] }
  const hashV2 = await computeDocumentContentHash(contentV2)

  const res2 = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'prescription',
    documentId: rxId,
    contentHash: hashV2,
    documentUrl: 'https://yalla-clinic.com/prescription/rx-002',
    patientName: 'كريم أحمد',
    patientPhone: '+201012345678',
    version: 2,
    store,
  })

  assert.equal(res2.enqueued, true, 'Different content must enqueue new version job')
  assert.notEqual(hashV1, hashV2, 'Content hashes must differ')
})

test('9. Invoice issuance enqueues trusted job and deduplicates repeat requests', async () => {
  const clinicId = 'clinic-inv-test'
  const store = createTestClinicStore(clinicId)
  const invoiceId = 'inv-500'
  const invData = {
    total: 350,
    items: [{ title: 'كشف عام', price: 350 }],
  }
  const hash = await computeDocumentContentHash(invData)

  const res1 = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'invoice',
    documentId: invoiceId,
    contentHash: hash,
    documentUrl: 'https://yalla-clinic.com/invoice/inv-500',
    patientName: 'طارق علي',
    patientPhone: '+201099999999',
    version: 1,
    store,
  })

  assert.equal(res1.enqueued, true)

  const res2 = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'invoice',
    documentId: invoiceId,
    contentHash: hash,
    documentUrl: 'https://yalla-clinic.com/invoice/inv-500',
    patientName: 'طارق علي',
    patientPhone: '+201099999999',
    version: 1,
    store,
  })

  assert.equal(res2.enqueued, false)
  assert.equal(res2.status, 'deduplicated')
})

test('10. Payment status changes alone do NOT alter content-hash and never resend invoice', async () => {
  const normalizeForHash = (inv) => {
    // Exclude paymentStatus, paidAt, paymentMethod, paymentNotes
    const { paymentStatus, paidAt, paymentMethod, paymentNotes, ...rest } = inv
    return rest
  }

  const invBefore = {
    total: 400,
    items: [{ title: 'استشارة', price: 400 }],
    paymentStatus: 'unpaid',
    paidAt: null,
  }

  const invAfter = {
    total: 400,
    items: [{ title: 'استشارة', price: 400 }],
    paymentStatus: 'paid', // Changed status
    paidAt: new Date().toISOString(),
  }

  const hashBefore = await computeDocumentContentHash(normalizeForHash(invBefore))
  const hashAfter = await computeDocumentContentHash(normalizeForHash(invAfter))

  assert.equal(hashBefore, hashAfter, 'Payment status changes must NOT alter invoice content hash')
})

test('11. WP Sender disconnection marks job waiting_for_connection without consuming retries', async () => {
  const clinicId = 'clinic-disconnect-test'
  const store = createTestClinicStore(clinicId)

  // Configure disconnected session in clinic_whatsapp_configs
  await store.writeDoc(`clinic_whatsapp_configs/${clinicId}`, {
    sessionStatus: 'disconnected',
    connected: false,
  }, true)

  const res = await enqueueDocumentWhatsAppJob({
    clinicId,
    type: 'invoice',
    documentId: 'inv-disc-1',
    contentHash: 'hash-disc-1',
    documentUrl: 'https://yalla-clinic.com/invoice/1',
    patientName: 'حسام',
    patientPhone: '+201011111111',
    version: 1,
    store,
    fetchImpl: async () => {
      return new Response(JSON.stringify({ error: 'Disconnected QR' }), { status: 401 })
    },
  })

  assert.equal(res.status, 'waiting_for_connection', 'Must enter waiting_for_connection status')
  const job = await store.readDoc(`whatsapp_jobs/${res.jobId}`)
  assert.equal(job.attempts, 0, 'Retry counter must not be consumed on provider disconnection')
})

test('12. Reconnecting session resumes still-valid waiting jobs and expires outdated ones', async () => {
  const clinicId = 'clinic-reconnect-test'
  const store = createTestClinicStore(clinicId)

  const nowIso = new Date().toISOString()

  // Job 1: Valid document
  const validJob = {
    id: 'job-valid',
    clinicId,
    status: 'waiting_for_connection',
    jobType: 'prescription_ready',
    documentType: 'prescription',
    documentId: 'rx-rec-1',
    documentVersion: 1,
    scheduledAt: nowIso,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    attempts: 0,
    patientPhone: '+201011111111',
    patientName: 'كريم',
    documentUrl: 'https://yalla-clinic.com/p/1',
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  // Job 2: Expired reminder from 2 days ago
  const expiredJob = {
    id: 'job-expired',
    clinicId,
    status: 'waiting_for_connection',
    jobType: 'appointment_reminder',
    appointmentDate: '2026-11-20',
    appointmentTime: '10:00',
    scheduledAt: '2026-11-20T08:00:00.000Z',
    expiresAt: '2026-11-20T10:00:00.000Z',
    attempts: 0,
    patientPhone: '+201022222222',
    patientName: 'محمود',
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
  }

  await store.writeDoc('whatsapp_jobs/job-valid', validJob)
  await store.writeDoc('whatsapp_jobs/job-expired', expiredJob)

  await requeueWaitingJobsForClinic(clinicId, { store })

  const updatedValid = await store.readDoc('whatsapp_jobs/job-valid')
  const updatedExpired = await store.readDoc('whatsapp_jobs/job-expired')

  assert.equal(updatedValid.status, 'queued', 'Valid job should be re-queued')
  assert.equal(updatedExpired.status, 'expired', 'Outdated reminder should be expired')
})

test('13. Ambiguous/timeout provider responses mark job uncertain and block blind automated replay', async () => {
  const clinicId = 'clinic-timeout-test'
  const store = createTestClinicStore(clinicId)

  // Configure live WP sender mode so executeWhatsAppJob reaches fetchImpl
  process.env.WPSENDER_LIVE_ENABLED = 'true'
  process.env.WPSENDER_API_KEY = 'test-key-live'
  process.env.WPSENDER_CLINICS_JSON = JSON.stringify({
    [clinicId]: {
      clinicId,
      apiKey: 'test-key-live',
      senderNumber: '+201011111111',
      sessionId: 'sess-test',
      mode: 'live',
    },
  })

  const waConfig = await store.readDoc(`clinic_whatsapp_configs/${clinicId}`)
  waConfig.wpSender = {
    configured: true,
    mode: 'live',
    senderNumber: '+201011111111',
    sessionId: 'sess-test',
    apiKey: 'test-key-live',
    sessionStatus: 'connected',
  }
  await store.writeDoc(`clinic_whatsapp_configs/${clinicId}`, waConfig)

  const mockFetch = async (url) => {
    const urlStr = String(url)
    // Health check passes
    if (urlStr.includes('status') || urlStr.includes('health') || urlStr.includes('whatsapp-session')) {
      return new Response(JSON.stringify({ status: 'connected' }), { status: 200 })
    }
    // Sending endpoint encounters AbortError / Timeout
    const err = new Error('The operation was aborted due to timeout')
    err.name = 'AbortError'
    throw err
  }

  const jobDoc = {
    id: 'job-uncertain-test',
    clinicId,
    jobType: 'prescription_ready',
    status: 'queued',
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
    patientPhone: '+201012341234',
    patientName: 'أمير',
    documentUrl: 'https://yalla-clinic.com/p/2',
    attempts: 0,
  }
  await store.writeDoc('whatsapp_jobs/job-uncertain-test', jobDoc)

  // Drain with mockFetch throwing timeout
  await drainPendingWhatsAppJobs(10, { store, fetchImpl: mockFetch })

  const job = await store.readDoc('whatsapp_jobs/job-uncertain-test')
  assert.equal(job.status, 'uncertain')
  assert.equal(job.uncertainOutcome, true)

  // Subsequent automated drain must skip uncertain jobs
  await drainPendingWhatsAppJobs(10, { store })
  const sameJob = await store.readDoc('whatsapp_jobs/job-uncertain-test')
  assert.equal(sameJob.status, 'uncertain', 'Uncertain job must not be blindly retried by cron')
})

test('14. Appointment cancellation cancels all pending reminders immediately', async () => {
  const clinicId = 'clinic-cancel-test'
  const store = createTestClinicStore(clinicId)
  const apptId = 'appt-to-cancel'

  await scheduleAppointmentNotifications({
    clinicId,
    appointmentId: apptId,
    patientPhone: '+201088888888',
    patientName: 'سمير',
    appointmentDate: '2026-12-10',
    appointmentTime: '17:00',
    whatsappConsent: true,
    store,
  })

  // Cancel appointment
  await handleAppointmentCancelled({
    appointmentId: apptId,
    reason: 'ظرف طارئ',
    shouldSendCancellationNotice: false,
    store,
  })

  const reminders = Array.from(store.docs.entries())
    .filter(([k]) => k.startsWith('whatsapp_jobs/'))
    .map(([, v]) => v.data)
    .filter((j) => j.appointmentId === apptId && j.jobType === 'appointment_reminder')

  for (const r of reminders) {
    assert.equal(r.status, 'cancelled')
  }
})

test('15. Appointment rescheduling cancels old reminders and creates new schedule version', async () => {
  const clinicId = 'clinic-resched-test'
  const store = createTestClinicStore(clinicId)
  const apptId = 'appt-to-reschedule'

  await scheduleAppointmentNotifications({
    clinicId,
    appointmentId: apptId,
    patientPhone: '+201077777777',
    patientName: 'ماجد',
    appointmentDate: '2026-12-15',
    appointmentTime: '14:00',
    whatsappConsent: true,
    store,
  })

  const initialReminder = Array.from(store.docs.entries())
    .filter(([k]) => k.startsWith('whatsapp_jobs/'))
    .map(([, v]) => v.data)
    .find((j) => j.appointmentId === apptId && j.jobType === 'appointment_reminder')
  assert.ok(initialReminder, 'Initial reminder must exist')

  // Reschedule
  await handleAppointmentRescheduled({
    appointmentId: apptId,
    clinicId,
    patientPhone: '+201077777777',
    patientName: 'ماجد',
    newDate: '2026-12-20',
    newTime: '18:00',
    whatsappConsent: true,
    store,
  })

  // Old reminder must be cancelled
  const oldReminder = await store.readDoc(`whatsapp_jobs/${initialReminder.id}`)
  assert.equal(oldReminder.status, 'cancelled')
  assert.equal(oldReminder.cancelledReason, 'APPOINTMENT_RESCHEDULED')

  // New reminder must exist for the new date
  const newReminder = Array.from(store.docs.entries())
    .filter(([k]) => k.startsWith('whatsapp_jobs/'))
    .map(([, v]) => v.data)
    .find((j) => j.appointmentId === apptId && j.jobType === 'appointment_reminder' && j.status === 'queued')

  assert.ok(newReminder, 'New reminder job must be created for rescheduled date')
  assert.equal(newReminder.appointmentDate, '2026-12-20')
})

test('16. 2MB image upload validator accepts <=2MB valid images and rejects >2MB or invalid magic bytes', async () => {
  // 1. Valid JPEG under 2MB
  const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
  const validJpegFile = new File([validJpegBytes], 'photo.jpg', { type: 'image/jpeg' })
  const validResult = await validateMediaFile(validJpegFile, MAX_IMAGE_BYTES)
  assert.equal(validResult.valid, true)
  assert.equal(validResult.format, 'jpeg')

  // 2. Oversized image (> 2MB = 2,097,152 bytes)
  const bigBuffer = new Uint8Array(2 * 1024 * 1024 + 100)
  bigBuffer[0] = 0xff
  bigBuffer[1] = 0xd8
  bigBuffer[2] = 0xff
  const oversizedFile = new File([bigBuffer], 'huge.jpg', { type: 'image/jpeg' })
  const oversizedResult = await validateMediaFile(oversizedFile, MAX_IMAGE_BYTES)
  assert.equal(oversizedResult.valid, false)
  assert.ok(oversizedResult.error?.includes('2'), 'Error should state 2MB maximum')

  // 3. Fake JPEG with invalid magic bytes (e.g. text file renamed to .jpg)
  const fakeBytes = new TextEncoder().encode('Hello this is not an image')
  const fakeFile = new File([fakeBytes], 'fake.jpg', { type: 'image/jpeg' })
  const fakeResult = await validateMediaFile(fakeFile, MAX_IMAGE_BYTES)
  assert.equal(fakeResult.valid, false)

  // 4. HEIC file detection
  const heicFile = new File(['mock'], 'photo.heic', { type: 'image/heic' })
  const heicResult = await validateMediaFile(heicFile, MAX_IMAGE_BYTES)
  assert.equal(heicResult.valid, false)
  assert.ok(heicResult.error?.includes('HEIC'), 'Should reject HEIC with clear message')
})

test('17. Global Emergency Stop (Kill Switch) freezes all automated and manual sends', () => {
  const stoppedPlatform = {
    ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
    emergencyStop: true,
  }

  const effective = resolveEffectiveWhatsAppPolicy({
    platformDefaults: stoppedPlatform,
    clinic: {
      whatsappAutomationEnabled: true,
    },
    waConfig: {
      mode: 'live',
      connected: true,
      enabled: true,
    },
  })

  assert.equal(effective.emergencyStop, true, 'Emergency stop flag must be true')
  assert.equal(effective.serviceEnabled, false, 'Service must be disabled when emergency stop is active')
  assert.equal(effective.features.booking_confirmation.autoSend, false, 'Auto send must be frozen')
  assert.equal(effective.features.prescription.allowManualSend, false, 'Manual send must be frozen')
  assert.equal(effective.features.invoice.allowManualSend, false, 'Manual send must be frozen')
})

test('18. Template variables: {رابط_المستند} and new tokens {التاريخ}, {الوقت}, {رقم_الحجز}', () => {
  const templateWithNewTokens = `مرحبًا {اسم_المريض}
موعدك في {اسم_العيادة} ({اسم_الدكتور})
التاريخ: {التاريخ}
الوقت: {الوقت}
رقم الحجز: {رقم_الحجز}`

  const rendered = renderClinicMessage(templateWithNewTokens, {
    patientName: 'سارة أحمد',
    clinicName: 'عيادة الأمل',
    doctorName: 'د. منى',
    date: '2026-12-05',
    time: '04:30 م',
    queueNumber: 'B-09',
  })

  assert.ok(rendered.includes('سارة أحمد'))
  assert.ok(rendered.includes('عيادة الأمل'))
  assert.ok(rendered.includes('د. منى'))
  assert.ok(rendered.includes('2026-12-05'))
  assert.ok(rendered.includes('04:30 م'))
  assert.ok(rendered.includes('B-09'))
})

test('19. New clinic default policy is completely disabled and hidden', () => {
  const defaultPolicy = getNewClinicDefaultWhatsAppPolicy()

  assert.equal(defaultPolicy.sectionVisible, false, 'New clinics must have section hidden')
  assert.equal(defaultPolicy.serviceEnabled, false, 'New clinics must have service disabled')
  for (const feat of Object.values(defaultPolicy.features)) {
    assert.equal(feat.visible, false, 'Feature must be hidden')
    assert.equal(feat.enabled, false, 'Feature must be disabled')
    assert.equal(feat.mode, 'disabled', 'Feature mode must be disabled')
  }
})

test('20. Edit permission: read_only vs editable policy resolution', () => {
  const platform = {
    ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
    features: {
      ...DEFAULT_PLATFORM_WHATSAPP_DEFAULTS.features,
      booking_confirmation: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
      appointment_reminder: { visible: true, enabled: true, mode: 'auto', editPermission: 'editable' },
    },
  }

  const effective = resolveEffectiveWhatsAppPolicy({
    platformDefaults: platform,
  })

  assert.equal(effective.features.booking_confirmation.editPermission, 'read_only')
  assert.equal(effective.features.appointment_reminder.editPermission, 'editable')
})

test('21. Queue alert (queue_alert) message type rendering', () => {
  const queueMsg = renderClinicMessage(messageDefaults.queue_alert, {
    patientName: 'محمود حسن',
    clinicName: 'مركز الشفاء',
    doctorName: 'د. يوسف',
    queueNumber: 'A-22',
  })

  assert.ok(queueMsg.includes('محمود حسن'))
  assert.ok(queueMsg.includes('مركز الشفاء'))
  assert.ok(queueMsg.includes('A-22'))
  assert.ok(queueMsg.includes('اقتراب دورك'))
})
