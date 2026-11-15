import 'server-only'
import {
  readDocument,
  writeDocument,
  queryDocumentsByField,
  deleteDocument
} from '@/lib/server/firebase-rest'
import {
  formatToE164,
  sendWhatsAppTemplateMessage,
  listWabaPhoneNumbers,
  createEmbeddedSignupLink
} from './ycloud-service'
import { scheduleBackgroundTask } from '@/lib/server/background-task'

export interface ClinicWhatsAppReminderRule {
  id: string
  value: number
  unit: 'minute' | 'hour' | 'day'
}

export interface ClinicWhatsAppSettings {
  sendBookingConfirmation: boolean
  sendReminders: boolean
  reminders: ClinicWhatsAppReminderRule[]
  sendRescheduledNotification: boolean
  sendCancellationNotification: boolean
  monthlyLimit: number
}

export interface ClinicWhatsAppConfig {
  clinicId: string
  clinicSlug?: string
  status: 'not_linked' | 'linking' | 'connected' | 'disconnected' | 'error'
  wabaId?: string | null
  phoneNumberId?: string | null
  phoneNumber?: string | null // in E.164 e.g. +201012345678
  businessName?: string | null
  linkedAt?: string | null
  lastSyncAt?: string | null
  lastError?: string | null
  stats: {
    sentCount: number
    deliveredCount: number
    readCount: number
    failedCount: number
    totalCostEstimate: number // in USD
  }
  monthlyUsage: number
  settings: ClinicWhatsAppSettings
  templateStatus?: Record<string, 'APPROVED' | 'PENDING' | 'REJECTED' | 'NOT_CREATED'>
}

export interface WhatsAppJob {
  id: string
  appointmentId: string
  clinicId: string
  clinicSlug: string
  clinicName: string
  doctorName?: string
  patientName: string
  patientPhone: string
  jobType:
    | 'booking_confirmation'
    | 'appointment_reminder'
    | 'appointment_rescheduled'
    | 'appointment_cancelled'
  scheduledAt: string // ISO UTC
  appointmentDate: string // YYYY-MM-DD
  appointmentTime: string // e.g. 10:00 AM
  status:
    | 'pending'
    | 'processing'
    | 'accepted'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'cancelled'
  idempotencyKey: string
  ycloudMessageId?: string | null
  ycloudWamid?: string | null
  attempts: number
  lastAttemptAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
  sentAt?: string | null
  deliveredAt?: string | null
}

export const DEFAULT_WHATSAPP_SETTINGS: ClinicWhatsAppSettings = {
  sendBookingConfirmation: true,
  sendReminders: true,
  reminders: [
    { id: 'rem-1', value: 24, unit: 'hour' },
    { id: 'rem-2', value: 45, unit: 'minute' }
  ],
  sendRescheduledNotification: true,
  sendCancellationNotification: true,
  monthlyLimit: 500
}

/**
 * Get Africa/Cairo UTC offset in minutes for a specific point in time (accounts for DST).
 */
export function getCairoUtcOffsetMinutes(date: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      timeZoneName: 'shortOffset'
    }).formatToParts(date)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+2'
    const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!match) return 120 // Fallback to UTC+2
    const sign = match[1] === '+' ? 1 : -1
    const hours = parseInt(match[2], 10)
    const mins = match[3] ? parseInt(match[3], 10) : 0
    return sign * (hours * 60 + mins)
  } catch {
    return 120
  }
}

/**
 * Parse an appointment date ('YYYY-MM-DD') and time string ('10:00 AM' or '17:30')
 * into a UTC Date object anchored in Africa/Cairo timezone.
 */
export function getCairoAppointmentUtcDate(dateStr: string, timeStr?: string): Date {
  const safeDate = String(dateStr || '').trim() || new Date().toISOString().split('T')[0]
  let [yearStr, monthStr, dayStr] = safeDate.split('-')
  let year = parseInt(yearStr, 10)
  let month = parseInt(monthStr, 10) - 1
  let day = parseInt(dayStr, 10)

  let hours = 10
  let minutes = 0

  if (timeStr && typeof timeStr === 'string') {
    const cleanTime = timeStr.trim().toUpperCase()
    const isPm = cleanTime.includes('PM') || cleanTime.includes('م')
    const isAm = cleanTime.includes('AM') || cleanTime.includes('ص')
    const digitsMatch = cleanTime.match(/(\d{1,2}):(\d{2})/)

    if (digitsMatch) {
      let h = parseInt(digitsMatch[1], 10)
      const m = parseInt(digitsMatch[2], 10)
      if (isPm && h < 12) h += 12
      if (isAm && h === 12) h = 0
      hours = h
      minutes = m
    }
  }

  // Construct target UTC timestamp subtracting Cairo offset
  const testDate = new Date(Date.UTC(year, month, day, hours, minutes, 0))
  const cairoOffsetMinutes = getCairoUtcOffsetMinutes(testDate)
  return new Date(testDate.getTime() - cairoOffsetMinutes * 60 * 1000)
}

/**
 * Format date for Arabic patient communication e.g. "الأحد 15 نوفمبر 2026"
 */
export function formatArabicDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(dateObj)
  } catch {
    return dateStr
  }
}

/**
 * Format time for Arabic patient communication e.g. "05:30 م"
 */
export function formatArabicTime(timeStr?: string): string {
  if (!timeStr) return 'الموعد المحدد'
  let clean = timeStr.trim().toUpperCase()
  const isPm = clean.includes('PM') || clean.includes('م')
  const isAm = clean.includes('AM') || clean.includes('ص')
  const digitsMatch = clean.match(/(\d{1,2}):(\d{2})/)
  if (!digitsMatch) return timeStr

  let h = parseInt(digitsMatch[1], 10)
  const m = digitsMatch[2]
  if (h > 12) h -= 12
  const period = isPm ? 'مساءً' : isAm ? 'صباحاً' : ''
  return `${h}:${m} ${period}`.trim()
}

/**
 * Retrieve or initialize WhatsApp configuration for a clinic
 */
export async function getClinicWhatsAppConfig(clinicId: string): Promise<ClinicWhatsAppConfig | null> {
  if (!clinicId) return null

  try {
    const configData: any = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
    if (configData) {
      return {
        clinicId,
        clinicSlug: configData.clinicSlug ? String(configData.clinicSlug) : undefined,
        status: (configData.status as any) || 'not_linked',
        wabaId: configData.wabaId ? String(configData.wabaId) : null,
        phoneNumberId: configData.phoneNumberId ? String(configData.phoneNumberId) : null,
        phoneNumber: configData.phoneNumber ? String(configData.phoneNumber) : null,
        businessName: configData.businessName ? String(configData.businessName) : null,
        linkedAt: configData.linkedAt ? String(configData.linkedAt) : null,
        lastSyncAt: configData.lastSyncAt ? String(configData.lastSyncAt) : null,
        lastError: configData.lastError ? String(configData.lastError) : null,
        stats: {
          sentCount: Number(configData.stats?.sentCount || 0),
          deliveredCount: Number(configData.stats?.deliveredCount || 0),
          readCount: Number(configData.stats?.readCount || 0),
          failedCount: Number(configData.stats?.failedCount || 0),
          totalCostEstimate: Number(configData.stats?.totalCostEstimate || 0)
        },
        monthlyUsage: Number(configData.monthlyUsage || 0),
        settings: {
          ...DEFAULT_WHATSAPP_SETTINGS,
          ...(configData.settings || {})
        },
        templateStatus: configData.templateStatus || {
          booking_confirmation: 'APPROVED',
          appointment_reminder: 'APPROVED',
          appointment_rescheduled: 'APPROVED',
          appointment_cancelled: 'APPROVED'
        }
      }
    }

    // Fallback: check clinic root document for existing credentials
    const clinicDoc: any = await readDocument(`clinics/${clinicId}`)
    if (clinicDoc) {
      const initialConfig: ClinicWhatsAppConfig = {
        clinicId,
        clinicSlug: clinicDoc.slug ? String(clinicDoc.slug) : '',
        status: clinicDoc.whatsappPhoneNumber ? 'connected' : 'not_linked',
        wabaId: clinicDoc.whatsappWabaId ? String(clinicDoc.whatsappWabaId) : null,
        phoneNumberId: clinicDoc.whatsappPhoneNumberId ? String(clinicDoc.whatsappPhoneNumberId) : null,
        phoneNumber: clinicDoc.whatsappPhoneNumber ? String(clinicDoc.whatsappPhoneNumber) : null,
        businessName: clinicDoc.name ? String(clinicDoc.name) : null,
        linkedAt: clinicDoc.whatsappLinkedAt ? String(clinicDoc.whatsappLinkedAt) : null,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        stats: {
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          totalCostEstimate: 0
        },
        monthlyUsage: 0,
        settings: DEFAULT_WHATSAPP_SETTINGS,
        templateStatus: {
          booking_confirmation: 'APPROVED',
          appointment_reminder: 'APPROVED',
          appointment_rescheduled: 'APPROVED',
          appointment_cancelled: 'APPROVED'
        }
      }
      // Save initial config
      await writeDocument(`clinic_whatsapp_configs/${clinicId}`, initialConfig as any, true).catch(() => {})
      return initialConfig
    }
  } catch (err) {
    console.error(`[WhatsApp Scheduler] Failed to get config for ${clinicId}:`, err)
  }

  return null
}

/**
 * Handle new booking created: schedules confirmation and reminders.
 */
export async function scheduleAppointmentNotifications(appointment: {
  id: string
  clinicId: string
  clinicSlug?: string
  patientName: string
  patientPhone: string
  doctorName?: string
  clinicName?: string
  date: string
  time?: string
  whatsappConsent?: boolean
}): Promise<{ confirmationScheduled: boolean; remindersCount: number }> {
  const { id: appointmentId, clinicId, patientName, patientPhone, date, time } = appointment

  if (!clinicId || !patientPhone) {
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  if (appointment.whatsappConsent === false) {
    console.log(`[WhatsApp Scheduler] Patient ${patientPhone} has opted out of WhatsApp notifications.`)
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  const config = await getClinicWhatsAppConfig(clinicId)
  if (!config || config.status !== 'connected' || !config.phoneNumber) {
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  if (config.monthlyUsage >= (config.settings.monthlyLimit || 500)) {
    console.warn(`[WhatsApp Scheduler] Monthly limit reached for clinic ${clinicId}. Skipping messages.`)
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  const slug = appointment.clinicSlug || config.clinicSlug || 'clinic'
  const clinicName = appointment.clinicName || config.businessName || 'العيادة'
  const doctorName = appointment.doctorName || ''
  const cleanPhone = formatToE164(patientPhone)
  const now = new Date().toISOString()
  const apptUtc = getCairoAppointmentUtcDate(date, time)

  let confirmationScheduled = false
  let remindersCount = 0

  // 1. Booking Confirmation Job
  if (config.settings.sendBookingConfirmation) {
    const confirmationJobId = `wa_${appointmentId}_confirm`
    const confirmationJob: WhatsAppJob = {
      id: confirmationJobId,
      appointmentId,
      clinicId,
      clinicSlug: slug,
      clinicName,
      doctorName,
      patientName,
      patientPhone: cleanPhone,
      jobType: 'booking_confirmation',
      scheduledAt: now, // immediate
      appointmentDate: date,
      appointmentTime: time || '10:00 AM',
      status: 'pending',
      idempotencyKey: `booking_confirm_${appointmentId}`,
      attempts: 0,
      createdAt: now,
      updatedAt: now
    }

    try {
      await writeDocument(`whatsapp_jobs/${confirmationJobId}`, confirmationJob as any, true)
      confirmationScheduled = true

      // Trigger immediate background dispatch
      scheduleBackgroundTask(
        () => executeWhatsAppJob(confirmationJobId),
        `whatsapp-confirm-${appointmentId}`
      )
    } catch (e) {
      console.error(`[WhatsApp Scheduler] Error saving confirmation job:`, e)
    }
  }

  // 2. Appointment Reminders
  if (config.settings.sendReminders && Array.isArray(config.settings.reminders)) {
    for (const rule of config.settings.reminders) {
      if (!rule.value || rule.value <= 0) continue

      let offsetMinutes = rule.value
      if (rule.unit === 'hour') offsetMinutes = rule.value * 60
      if (rule.unit === 'day') offsetMinutes = rule.value * 1440

      const reminderTimeMs = apptUtc.getTime() - offsetMinutes * 60 * 1000
      // Don't schedule reminders in the past
      if (reminderTimeMs <= Date.now()) continue

      const reminderScheduledAt = new Date(reminderTimeMs).toISOString()
      const reminderJobId = `wa_${appointmentId}_rem_${offsetMinutes}m`

      const reminderJob: WhatsAppJob = {
        id: reminderJobId,
        appointmentId,
        clinicId,
        clinicSlug: slug,
        clinicName,
        doctorName,
        patientName,
        patientPhone: cleanPhone,
        jobType: 'appointment_reminder',
        scheduledAt: reminderScheduledAt,
        appointmentDate: date,
        appointmentTime: time || '10:00 AM',
        status: 'pending',
        idempotencyKey: `reminder_${appointmentId}_${offsetMinutes}m`,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }

      try {
        await writeDocument(`whatsapp_jobs/${reminderJobId}`, reminderJob as any, true)
        remindersCount++
      } catch (e) {
        console.error(`[WhatsApp Scheduler] Error saving reminder job:`, e)
      }
    }
  }

  return { confirmationScheduled, remindersCount }
}

/**
 * Handle appointment rescheduled: cancels previous reminders, sends rescheduled notice, generates new reminders.
 */
export async function handleAppointmentRescheduled(
  appointmentId: string,
  newDate: string,
  newTime?: string
): Promise<void> {
  if (!appointmentId) return

  try {
    const appt = await readDocument(`appointments/${appointmentId}`)
    if (!appt) return

    const clinicId = String(appt.clinic_id || appt.clinicId || '')
    const config = await getClinicWhatsAppConfig(clinicId)
    if (!config || config.status !== 'connected' || !config.phoneNumber) return

    // 1. Cancel previous pending reminders for this appointment
    await cancelPendingAppointmentJobs(appointmentId, 'APPOINTMENT_RESCHEDULED')

    // 2. Send rescheduled notification if enabled
    const now = new Date().toISOString()
    const slug = config.clinicSlug || 'clinic'
    const clinicName = config.businessName || 'العيادة'
    const patientName = String(appt.patientName || appt.name || 'المريض')
    const patientPhone = formatToE164(String(appt.patientPhone || appt.phone || ''))

    if (config.settings.sendRescheduledNotification && patientPhone) {
      const reschedJobId = `wa_${appointmentId}_resched_${Date.now()}`
      const reschedJob: WhatsAppJob = {
        id: reschedJobId,
        appointmentId,
        clinicId,
        clinicSlug: slug,
        clinicName,
        doctorName: String(appt.doctorName || ''),
        patientName,
        patientPhone,
        jobType: 'appointment_rescheduled',
        scheduledAt: now,
        appointmentDate: newDate,
        appointmentTime: newTime || '10:00 AM',
        status: 'pending',
        idempotencyKey: `resched_${appointmentId}_${newDate}_${newTime || ''}`,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }

      await writeDocument(`whatsapp_jobs/${reschedJobId}`, reschedJob as any, true)
      scheduleBackgroundTask(
        () => executeWhatsAppJob(reschedJobId),
        `whatsapp-resched-${appointmentId}`
      )
    }

    // 3. Re-schedule new reminders for new date and time
    const apptUtc = getCairoAppointmentUtcDate(newDate, newTime)
    if (config.settings.sendReminders && Array.isArray(config.settings.reminders)) {
      for (const rule of config.settings.reminders) {
        if (!rule.value || rule.value <= 0) continue

        let offsetMinutes = rule.value
        if (rule.unit === 'hour') offsetMinutes = rule.value * 60
        if (rule.unit === 'day') offsetMinutes = rule.value * 1440

        const reminderTimeMs = apptUtc.getTime() - offsetMinutes * 60 * 1000
        if (reminderTimeMs <= Date.now()) continue

        const reminderScheduledAt = new Date(reminderTimeMs).toISOString()
        const reminderJobId = `wa_${appointmentId}_rem_${offsetMinutes}m`

        const reminderJob: WhatsAppJob = {
          id: reminderJobId,
          appointmentId,
          clinicId,
          clinicSlug: slug,
          clinicName,
          doctorName: String(appt.doctorName || ''),
          patientName,
          patientPhone,
          jobType: 'appointment_reminder',
          scheduledAt: reminderScheduledAt,
          appointmentDate: newDate,
          appointmentTime: newTime || '10:00 AM',
          status: 'pending',
          idempotencyKey: `reminder_${appointmentId}_${offsetMinutes}m`,
          attempts: 0,
          createdAt: now,
          updatedAt: now
        }

        await writeDocument(`whatsapp_jobs/${reminderJobId}`, reminderJob as any, true).catch(() => {})
      }
    }
  } catch (err) {
    console.error(`[WhatsApp Scheduler] Reschedule handling failed:`, err)
  }
}

/**
 * Handle appointment cancellation: cancels pending reminders and sends cancellation notice.
 */
export async function handleAppointmentCancelled(appointmentId: string): Promise<void> {
  if (!appointmentId) return

  try {
    const appt = await readDocument(`appointments/${appointmentId}`)
    if (!appt) return

    const clinicId = String(appt.clinic_id || appt.clinicId || '')
    const config = await getClinicWhatsAppConfig(clinicId)

    // 1. Cancel all pending reminder jobs
    await cancelPendingAppointmentJobs(appointmentId, 'APPOINTMENT_CANCELLED')

    if (!config || config.status !== 'connected' || !config.phoneNumber) return

    // 2. Send cancellation notice if enabled
    if (config.settings.sendCancellationNotification) {
      const patientPhone = formatToE164(String(appt.patientPhone || appt.phone || ''))
      if (!patientPhone) return

      const now = new Date().toISOString()
      const slug = config.clinicSlug || 'clinic'
      const clinicName = config.businessName || 'العيادة'
      const patientName = String(appt.patientName || appt.name || 'المريض')

      const cancelJobId = `wa_${appointmentId}_cancel`
      const cancelJob: WhatsAppJob = {
        id: cancelJobId,
        appointmentId,
        clinicId,
        clinicSlug: slug,
        clinicName,
        doctorName: String(appt.doctorName || ''),
        patientName,
        patientPhone,
        jobType: 'appointment_cancelled',
        scheduledAt: now,
        appointmentDate: String(appt.date || ''),
        appointmentTime: String(appt.time || ''),
        status: 'pending',
        idempotencyKey: `cancel_${appointmentId}`,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }

      await writeDocument(`whatsapp_jobs/${cancelJobId}`, cancelJob as any, true)
      scheduleBackgroundTask(
        () => executeWhatsAppJob(cancelJobId),
        `whatsapp-cancel-${appointmentId}`
      )
    }
  } catch (err) {
    console.error(`[WhatsApp Scheduler] Cancel handling failed:`, err)
  }
}

/**
 * Cancel all pending jobs for an appointment.
 */
export async function cancelPendingAppointmentJobs(
  appointmentId: string,
  reason = 'CANCELLED'
): Promise<number> {
  try {
    const jobs = await queryDocumentsByField('whatsapp_jobs', 'appointmentId', appointmentId, 20)
    let cancelled = 0
    for (const job of jobs) {
      if (job.status === 'pending') {
        await writeDocument(
          `whatsapp_jobs/${job.id}`,
          {
            status: 'cancelled',
            lastError: reason,
            updatedAt: new Date().toISOString()
          },
          true
        )
        cancelled++
      }
    }
    return cancelled
  } catch (err) {
    console.warn(`[WhatsApp Scheduler] Error cancelling jobs for ${appointmentId}:`, err)
    return 0
  }
}

/**
 * Build template parameters according to approved UTILITY templates.
 */
export function buildTemplateParameters(job: WhatsAppJob): {
  templateName: string
  variables: string[]
} {
  const patientName = job.patientName || 'عزيزنا المريض'
  const clinicName = job.clinicName || 'العيادة'
  const arabicDate = formatArabicDate(job.appointmentDate)
  const arabicTime = formatArabicTime(job.appointmentTime)
  const trackUrl = `https://yalla-clinic.com/clinic/${job.clinicSlug}/track/${job.appointmentId}`

  switch (job.jobType) {
    case 'booking_confirmation':
      // Template body: أهلًا {{1}}، تم تأكيد حجزك في {{2}} يوم {{3}} الساعة {{4}}. للاستعلام عن موعدك استخدم الرابط: {{5}}
      return {
        templateName: 'booking_confirmation',
        variables: [patientName, clinicName, arabicDate, arabicTime, trackUrl]
      }

    case 'appointment_reminder':
      // Template body: أهلًا {{1}}، نذكرك بموعدك في {{2}} يوم {{3}} الساعة {{4}}. نتمنى لك دوام الصحة.
      return {
        templateName: 'appointment_reminder',
        variables: [patientName, clinicName, arabicDate, arabicTime]
      }

    case 'appointment_rescheduled':
      // Template body: أهلًا {{1}}، تم تعديل موعد حجزك في {{2}} ليصبح يوم {{3}} الساعة {{4}}. نتمنى لك دوام الصحة.
      return {
        templateName: 'appointment_rescheduled',
        variables: [patientName, clinicName, arabicDate, arabicTime]
      }

    case 'appointment_cancelled':
      // Template body: أهلًا {{1}}، تم إلغاء حجزك في {{2}} ليوم {{3}}. نسعد بخدمتك في أي وقت.
      return {
        templateName: 'appointment_cancelled',
        variables: [patientName, clinicName, arabicDate]
      }

    default:
      return {
        templateName: 'booking_confirmation',
        variables: [patientName, clinicName, arabicDate, arabicTime, trackUrl]
      }
  }
}

/**
 * Execute a single WhatsApp job atomically.
 */
export async function executeWhatsAppJob(jobId: string): Promise<boolean> {
  try {
    const jobData = await readDocument(`whatsapp_jobs/${jobId}`)
    if (!jobData || jobData.status !== 'pending') return false

    const job = jobData as unknown as WhatsAppJob
    const config = await getClinicWhatsAppConfig(job.clinicId)
    if (!config || config.status !== 'connected' || !config.phoneNumber) {
      await writeDocument(
        `whatsapp_jobs/${jobId}`,
        {
          status: 'failed',
          lastError: 'CLINIC_WHATSAPP_NOT_CONNECTED',
          updatedAt: new Date().toISOString()
        },
        true
      )
      return false
    }

    // Check if appointment is expired for reminders
    if (job.jobType === 'appointment_reminder') {
      const apptUtc = getCairoAppointmentUtcDate(job.appointmentDate, job.appointmentTime)
      if (apptUtc.getTime() <= Date.now()) {
        await writeDocument(
          `whatsapp_jobs/${jobId}`,
          {
            status: 'cancelled',
            lastError: 'APPOINTMENT_ALREADY_PASSED',
            updatedAt: new Date().toISOString()
          },
          true
        )
        return false
      }
    }

    // Mark processing
    await writeDocument(
      `whatsapp_jobs/${jobId}`,
      {
        status: 'processing',
        lastAttemptAt: new Date().toISOString(),
        attempts: (job.attempts || 0) + 1,
        updatedAt: new Date().toISOString()
      },
      true
    )

    const { templateName, variables } = buildTemplateParameters(job)

    const result = await sendWhatsAppTemplateMessage({
      from: config.phoneNumber,
      to: job.patientPhone,
      templateName,
      bodyVariables: variables
    })

    const now = new Date().toISOString()
    const isMock = result.status === 'mock_sent'
    const finalJobStatus = isMock ? 'sent' : result.status || 'accepted'

    await writeDocument(
      `whatsapp_jobs/${jobId}`,
      {
        status: finalJobStatus,
        ycloudMessageId: result.id,
        ycloudWamid: result.wamid || null,
        sentAt: now,
        updatedAt: now
      },
      true
    )

    // Update clinic usage & cost statistics
    const cost = Number(result.price || 0.038)
    await writeDocument(
      `clinic_whatsapp_configs/${job.clinicId}`,
      {
        'stats.sentCount': (config.stats?.sentCount || 0) + 1,
        'stats.totalCostEstimate': (config.stats?.totalCostEstimate || 0) + cost,
        monthlyUsage: (config.monthlyUsage || 0) + 1,
        lastSyncAt: now
      },
      true
    ).catch(() => {})

    return true
  } catch (err: any) {
    console.error(`[WhatsApp Scheduler] Failed to execute job ${jobId}:`, err)
    const errMessage = err?.message || 'SEND_FAILED'
    await writeDocument(
      `whatsapp_jobs/${jobId}`,
      {
        status: 'failed',
        lastError: errMessage,
        updatedAt: new Date().toISOString()
      },
      true
    ).catch(() => {})
    return false
  }
}

/**
 * Drain and process pending WhatsApp jobs whose scheduled time has arrived.
 * Executed by Cloudflare Worker cron trigger.
 */
export async function drainPendingWhatsAppJobs(limit = 15): Promise<{
  processed: number
  successCount: number
  failedCount: number
}> {
  let processed = 0
  let successCount = 0
  let failedCount = 0

  try {
    const jobs = await queryDocumentsByField('whatsapp_jobs', 'status', 'pending', limit * 2)
    const nowTime = Date.now()

    for (const rawJob of jobs) {
      if (processed >= limit) break

      const scheduledMs = new Date(String(rawJob.scheduledAt || '')).getTime()
      if (scheduledMs <= nowTime) {
        processed++
        const ok = await executeWhatsAppJob(String(rawJob.id || ''))
        if (ok) {
          successCount++
        } else {
          failedCount++
        }
      }
    }
  } catch (err) {
    console.warn('[WhatsApp Scheduler] drainPendingWhatsAppJobs warning:', err)
  }

  return { processed, successCount, failedCount }
}
