import 'server-only'
import {
  readDocument,
  writeDocument,
  queryDocumentsByField,
  createDocument,
  readVersionedDocument,
  patchDocumentAtVersion,
  queryDueWhatsAppJobs
} from '@/lib/server/firebase-rest'
import {
  formatToE164,
  sendWhatsAppTemplateMessage
} from './ycloud-service'
import { getWpSenderConfig, sendWpSenderMessage } from './wp-sender'
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
  provider?: 'wpsender'
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
  wpUsageMonth?: string
  wpMonthlyUsage?: number
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
  reminderAnchorTime?: string
  hasFixedTime?: boolean
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
    | 'mock_sent'
  transport?: 'wpsender_live' | 'wpsender_mock'
  wpSenderMessageId?: string
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
    { id: 'rem-2', value: 2, unit: 'hour' }
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
  const estimatedUtc = new Date(testDate.getTime() - getCairoUtcOffsetMinutes(testDate) * 60000)
  return new Date(testDate.getTime() - getCairoUtcOffsetMinutes(estimatedUtc) * 60000)
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
  const period = (isPm || (!isAm && h >= 12)) ? 'مساءً' : 'صباحاً'
  h = h % 12 || 12
  return `${h}:${m} ${period}`.trim()
}

/**
 * Retrieve or initialize WhatsApp configuration for a clinic
 */
export async function getClinicWhatsAppConfig(clinicId: string): Promise<ClinicWhatsAppConfig | null> {
  if (!clinicId) return null

  try {
    const configData: any = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
    const wp = getWpSenderConfig(clinicId)
    const clinicDoc = (!configData?.status || wp) ? await readDocument(`clinics/${clinicId}`) : null
    if (configData || (wp && clinicDoc)) {
      const stored = configData || {}
      return {
        clinicId,
        provider: wp ? 'wpsender' : undefined,
        clinicSlug: String(stored.clinicSlug || clinicDoc?.slug || ''),
        status: wp ? (wp.mode === 'off' ? 'not_linked' : 'connected') : (stored.status as any) || (clinicDoc?.whatsappPhoneNumber ? 'connected' : 'not_linked'),
        wabaId: stored.wabaId ? String(stored.wabaId) : null,
        phoneNumberId: stored.phoneNumberId ? String(stored.phoneNumberId) : null,
        phoneNumber: wp ? wp.senderNumber || null : String(stored.phoneNumber || clinicDoc?.whatsappPhoneNumber || '') || null,
        businessName: String(stored.businessName || clinicDoc?.name || '') || null,
        linkedAt: stored.linkedAt ? String(stored.linkedAt) : null,
        lastSyncAt: stored.lastSyncAt ? String(stored.lastSyncAt) : null,
        lastError: stored.lastError ? String(stored.lastError) : null,
        stats: {
          sentCount: Number(stored.stats?.sentCount || 0),
          deliveredCount: Number(stored.stats?.deliveredCount || 0),
          readCount: Number(stored.stats?.readCount || 0),
          failedCount: Number(stored.stats?.failedCount || 0),
          totalCostEstimate: Number(stored.stats?.totalCostEstimate || 0)
        },
        monthlyUsage: wp
          ? (stored.wpUsageMonth === cairoUsageMonth() ? Number(stored.wpMonthlyUsage || 0) : 0)
          : Number(stored.monthlyUsage || 0),
        settings: {
          ...DEFAULT_WHATSAPP_SETTINGS,
          ...(stored.settings || {})
        },
        templateStatus: stored.templateStatus || {
          booking_confirmation: 'APPROVED',
          appointment_reminder: 'APPROVED',
          appointment_rescheduled: 'APPROVED',
          appointment_cancelled: 'APPROVED'
        }
      }
    }

    // Fallback: check clinic root document for existing credentials
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
  whatsappReminderTime?: string | null
  whatsappHasFixedTime?: boolean
}): Promise<{ confirmationScheduled: boolean; remindersCount: number }> {
  const { id: appointmentId, clinicId, patientName, patientPhone, date, time } = appointment

  if (!clinicId || !patientPhone) {
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  if (appointment.whatsappConsent === false) {
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  const config = await getClinicWhatsAppConfig(clinicId)
  if (!config || config.status !== 'connected' || !config.phoneNumber) {
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  const wp = config.provider === 'wpsender' ? getWpSenderConfig(clinicId) : null
  if (wp && appointment.whatsappConsent !== true) {
    return { confirmationScheduled: false, remindersCount: 0 }
  }
  const transport = wp ? (wp.mode === 'mock' ? 'wpsender_mock' : 'wpsender_live') : undefined

  if (wp?.mode !== 'mock' && config.monthlyUsage >= config.settings.monthlyLimit) {
    console.warn(`[WhatsApp Scheduler] Monthly limit reached for clinic ${clinicId}. Skipping messages.`)
    return { confirmationScheduled: false, remindersCount: 0 }
  }

  const slug = appointment.clinicSlug || config.clinicSlug || 'clinic'
  const clinicName = appointment.clinicName || config.businessName || 'العيادة'
  const doctorName = appointment.doctorName || ''
  const cleanPhone = formatToE164(patientPhone)
  const now = new Date().toISOString()
  const reminderTime = wp ? appointment.whatsappReminderTime : time
  const apptUtc = getCairoAppointmentUtcDate(date, reminderTime || undefined)

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
      ...(transport ? { transport, hasFixedTime: appointment.whatsappHasFixedTime } : {}),
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
      await createDocument('whatsapp_jobs', confirmationJob as any, confirmationJobId)
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
  if (config.settings.sendReminders && Array.isArray(config.settings.reminders) && (!wp || reminderTime)) {
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
        ...(transport ? { transport, reminderAnchorTime: reminderTime || undefined, hasFixedTime: appointment.whatsappHasFixedTime } : {}),
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
        await createDocument('whatsapp_jobs', reminderJob as any, reminderJobId)
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
    const version = String(appt.updatedAt || Date.now())
    await cancelPendingAppointmentJobs(appointmentId, 'APPOINTMENT_RESCHEDULED', version)
    const config = await getClinicWhatsAppConfig(clinicId)
    const wp = config?.provider === 'wpsender' ? getWpSenderConfig(clinicId) : null
    const transport = wp ? (wp.mode === 'mock' ? 'wpsender_mock' : 'wpsender_live') : undefined
    if (!config || config.status !== 'connected' || !config.phoneNumber
      || appt.whatsappConsent === false || (wp && appt.whatsappConsent !== true)) return

    // 2. Send rescheduled notification if enabled
    const now = new Date().toISOString()
    const slug = config.clinicSlug || 'clinic'
    const clinicName = config.businessName || 'العيادة'
    const patientName = String(appt.patientName || appt.name || 'المريض')
    const patientPhone = formatToE164(String(appt.patientPhone || appt.phone || ''))

    if (config.settings.sendRescheduledNotification && patientPhone) {
      const reschedJobId = `wa_${appointmentId}_resched_${version}`
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
        ...(transport ? { transport } : {}),
        scheduledAt: now,
        appointmentDate: newDate,
        appointmentTime: newTime || '10:00 AM',
        status: 'pending',
        idempotencyKey: `resched_${appointmentId}_${newDate}_${newTime || ''}`,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }

      await createDocument('whatsapp_jobs', reschedJob as any, reschedJobId).catch(error => {
        if (error.message !== 'RATE_LIMITED') throw error
      })
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
        const reminderJobId = `wa_${appointmentId}_rem_${offsetMinutes}m_${version}`

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
          ...(transport ? { transport } : {}),
          scheduledAt: reminderScheduledAt,
          appointmentDate: newDate,
          appointmentTime: newTime || '10:00 AM',
          status: 'pending',
          idempotencyKey: `reminder_${appointmentId}_${offsetMinutes}m`,
          attempts: 0,
          createdAt: now,
          updatedAt: now
        }

        await createDocument('whatsapp_jobs', reminderJob as any, reminderJobId).catch(error => {
          if (error.message !== 'RATE_LIMITED') throw error
        })
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
    const wp = config?.provider === 'wpsender' ? getWpSenderConfig(clinicId) : null
    const transport = wp ? (wp.mode === 'mock' ? 'wpsender_mock' : 'wpsender_live') : undefined

    // 1. Cancel all pending reminder jobs
    await cancelPendingAppointmentJobs(appointmentId, 'APPOINTMENT_CANCELLED')

    if (!config || config.status !== 'connected' || !config.phoneNumber
      || appt.whatsappConsent === false || (wp && appt.whatsappConsent !== true)) return

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
        ...(transport ? { transport } : {}),
        scheduledAt: now,
        appointmentDate: String(appt.date || ''),
        appointmentTime: String(appt.time || ''),
        status: 'pending',
        idempotencyKey: `cancel_${appointmentId}`,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }

      await createDocument('whatsapp_jobs', cancelJob as any, cancelJobId).catch(error => {
        if (error.message !== 'RATE_LIMITED') throw error
      })
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
  reason = 'CANCELLED',
  keepVersion?: string
): Promise<number> {
  try {
    const jobs = await queryDocumentsByField('whatsapp_jobs', 'appointmentId', appointmentId, 100)
    let cancelled = 0
    for (const job of jobs) {
      if (job.status !== 'pending' || (keepVersion && String(job.id).endsWith(`_${keepVersion}`))) continue
      const path = `whatsapp_jobs/${job.id}`
      const current = await readVersionedDocument(path)
      if (current?.data.status !== 'pending') continue
      const changed = await patchDocumentAtVersion(path, current.updateTime, {
        status: 'cancelled',
        lastError: reason,
        updatedAt: new Date().toISOString()
      })
      if (changed) cancelled++
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

export function buildWpSenderMessage(job: WhatsAppJob): string {
  const date = formatArabicDate(job.appointmentDate)
  const time = formatArabicTime(job.appointmentTime)
  const when = job.hasFixedTime ? `${date}، الساعة ${time}` : date
  switch (job.jobType) {
    case 'booking_confirmation':
      return `تم تأكيد موعدك يوم ${when}.`
    case 'appointment_reminder':
      return `تذكير بموعدك يوم ${when}.`
    case 'appointment_rescheduled':
      return `تم تعديل موعدك إلى يوم ${when}.`
    case 'appointment_cancelled':
      return `تم إلغاء موعدك يوم ${date}.`
  }
}

export async function executeWhatsAppJob(jobId: string): Promise<boolean> {
  const path = `whatsapp_jobs/${jobId}`
  let claimed = false
  try {
    const version = await readVersionedDocument(path)
    if (!version || version.data.status !== 'pending') return false

    const job = version.data as unknown as WhatsAppJob
    if (Date.parse(job.scheduledAt) > Date.now()) return false
    const config = await getClinicWhatsAppConfig(job.clinicId)
    const wp = config?.provider === 'wpsender' ? getWpSenderConfig(job.clinicId) : null
    const expectedTransport = wp?.mode === 'mock' ? 'wpsender_mock' : wp ? 'wpsender_live' : undefined
    const appointment = await readDocument(`appointments/${job.appointmentId}`)
    const appointmentClinic = appointment?.clinic_id || appointment?.clinicId
    const cancellation = job.jobType === 'appointment_cancelled'
    const cancelled = appointment?.status === 'cancelled'
    const currentTime = String(appointment?.time || '10:00 AM')

    let skipReason = ''
    if (!appointment || appointmentClinic !== job.clinicId || cancelled !== cancellation) {
      skipReason = 'APPOINTMENT_NO_LONGER_ELIGIBLE'
    } else if (job.transport !== expectedTransport || appointment.whatsappConsent === false
      || (wp && appointment.whatsappConsent !== true)) {
      skipReason = 'TRANSPORT_OR_CONSENT_CHANGED'
    } else if (formatToE164(String(appointment.patientPhone || appointment.phone || '')) !== job.patientPhone
      || (!cancellation && (appointment.date !== job.appointmentDate || currentTime !== job.appointmentTime))) {
      skipReason = 'APPOINTMENT_CHANGED'
    } else if (job.jobType === 'appointment_reminder' &&
      (getCairoAppointmentUtcDate(job.appointmentDate, job.reminderAnchorTime || job.appointmentTime).getTime() <= Date.now()
        || ['completed', 'skipped', 'no_show', 'in_progress'].includes(String(appointment.status)))) {
      skipReason = 'APPOINTMENT_ALREADY_PASSED'
    }

    const now = new Date().toISOString()
    if (skipReason || !config || config.status !== 'connected' || !config.phoneNumber
      || (wp?.mode !== 'mock' && config.monthlyUsage >= config.settings.monthlyLimit)) {
      await patchDocumentAtVersion(path, version.updateTime, {
        status: skipReason ? 'cancelled' : 'failed',
        lastError: skipReason || 'CLINIC_WHATSAPP_UNAVAILABLE',
        updatedAt: now
      })
      return false
    }

    claimed = await patchDocumentAtVersion(path, version.updateTime, {
      status: 'processing',
      lastAttemptAt: now,
      attempts: (job.attempts || 0) + 1,
      updatedAt: now
    })
    if (!claimed) return false

    if (wp) {
      if (wp.mode === 'live' && !await reserveWpSenderUsage(job.clinicId, config.settings.monthlyLimit, now)) {
        throw new Error('WPSENDER_MONTHLY_LIMIT')
      }
      const result = await sendWpSenderMessage(wp, job.patientPhone, buildWpSenderMessage(job))
      await writeDocument(path, {
        status: result.status,
        wpSenderMessageId: result.id,
        updatedAt: new Date().toISOString()
      }, true)
      return true
    } else {
      const { templateName, variables } = buildTemplateParameters(job)
      const result = await sendWhatsAppTemplateMessage({
        from: config.phoneNumber,
        to: job.patientPhone,
        templateName,
        bodyVariables: variables
      })
      await writeDocument(path, {
        status: result.status === 'mock_sent' ? 'sent' : result.status || 'accepted',
        ycloudMessageId: result.id,
        ycloudWamid: result.wamid || null,
        sentAt: now,
        updatedAt: now
      }, true)

      await writeDocument(`clinic_whatsapp_configs/${job.clinicId}`, {
        'stats.sentCount': (config.stats?.sentCount || 0) + 1,
        'stats.totalCostEstimate': (config.stats?.totalCostEstimate || 0) + Number(result.price || 0.038),
        monthlyUsage: (config.monthlyUsage || 0) + 1,
        lastSyncAt: now
      }, true).catch(() => {})
      return result.status !== 'failed'
    }

  } catch (err) {
    if (claimed) {
      await writeDocument(path, {
        status: 'failed',
        lastError: err instanceof Error && /^WPSENDER_[A-Z0-9_]+$/.test(err.message) ? err.message : 'SEND_FAILED',
        updatedAt: new Date().toISOString()
      }, true).catch(() => {})
    }
    return false
  }
}

export function cairoUsageMonth(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(date)
}

async function reserveWpSenderUsage(clinicId: string, limit: number, now: string): Promise<boolean> {
  const month = cairoUsageMonth(new Date(now))
  const path = `clinic_whatsapp_configs/${clinicId}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readVersionedDocument(path)
    if (!current) {
      try {
        await createDocument('clinic_whatsapp_configs', { wpMonthlyUsage: 1, wpUsageMonth: month, lastSyncAt: now }, clinicId)
        return true
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'RATE_LIMITED') throw error
        continue
      }
    }
    const usage = current.data.wpUsageMonth === month ? Number(current.data.wpMonthlyUsage || 0) : 0
    if (usage >= limit) return false
    if (await patchDocumentAtVersion(path, current.updateTime, { wpMonthlyUsage: usage + 1, wpUsageMonth: month, lastSyncAt: now })) return true
  }
  throw new Error('WPSENDER_USAGE_RESERVATION_FAILED')
}

export async function drainPendingWhatsAppJobs(limit = 15): Promise<{
  processed: number
  successCount: number
  failedCount: number
}> {
  const jobs = await queryDueWhatsAppJobs(new Date().toISOString(), limit)
  let successCount = 0
  for (const job of jobs) {
    if (await executeWhatsAppJob(String(job.id))) successCount++
  }
  return { processed: jobs.length, successCount, failedCount: jobs.length - successCount }
}
