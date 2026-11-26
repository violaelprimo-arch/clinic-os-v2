if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: whatsapp-scheduler cannot be imported in client-side bundles')
}

import {
  readDocument,
  writeDocument,
  readVersionedDocument,
  patchDocumentAtVersion,
  queryDueWhatsAppJobs,
  createDocument,
  queryDocumentsByField,
  queryDocumentsByFields,
  deleteDocument,
  getFirestoreEmulatorOrigin,
  getFirebaseServerCredentials,
  googleAccessToken,
  recordFirestoreRead,
} from './firebase-rest'
import { formatToE164, sendWhatsAppTemplateMessage } from './ycloud-service'
import {
  messageDefaults,
  renderClinicMessage,
  inspectTemplateContextReadiness,
  type WhatsAppTemplateKey,
  type WhatsAppTemplateAuditEntry,
  type WhatsAppMessageRenderContext,
} from '@/lib/clinic-message-templates'
import {
  getWpSenderConfig,
  sendWpSenderMessage,
  checkWpSenderSessionHealth,
  type WpSenderResult,
} from './wp-sender'
import {
  resolveEffectiveWhatsAppPolicy,
  normalizePlatformWhatsAppDefaults,
  type OwnerWhatsAppPolicyInput,
  type PlatformWhatsAppDefaults,
  type WhatsAppSubFeatureKey,
} from '@/lib/whatsapp-policy'

export type ClinicWhatsAppReminderRule = [number, 'hour' | 'day']

export interface ClinicWhatsAppSettings {
  sendBookingConfirmation: boolean
  sendAppointmentReminder: boolean
  sendReminders?: boolean
  sendRescheduledNotification: boolean
  sendCancelledNotification: boolean
  sendCancellationNotification?: boolean
  sendPrescription?: boolean
  sendInvoice?: boolean
  monthlyLimit?: number
  reminders: ClinicWhatsAppReminderRule[]
}

export interface ClinicWhatsAppConfig {
  clinicId: string
  clinicSlug: string
  wabaId?: string
  phoneNumberId?: string
  displayPhoneNumber?: string
  verifiedName?: string
  connected: boolean
  enabled: boolean
  mode?: 'off' | 'mock' | 'live'
  senderNumber?: string
  sessionId?: string
  sessionStatus?: 'connected' | 'disconnected' | 'unknown'
  disconnectedAt?: string
  lastConnectedAt?: string
  settings: ClinicWhatsAppSettings
  templates?: Partial<Record<WhatsAppTemplateKey, string>>
  templateAudit?: Partial<Record<WhatsAppTemplateKey, WhatsAppTemplateAuditEntry>>
  ownerPolicy?: OwnerWhatsAppPolicyInput
  linkedAt?: string
  updatedAt?: string
  updatedBy?: string
}

export type WhatsAppJobType =
  | 'booking_confirmation'
  | 'appointment_reminder'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'prescription_ready'
  | 'invoice_ready'

export type WhatsAppJobStatus =
  | 'queued'
  | 'pending'
  | 'waiting_for_connection'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'uncertain'

export interface WhatsAppJob {
  id?: string
  clinicId: string
  clinicSlug?: string
  appointmentId: string
  patientName: string
  patientPhone: string
  jobType: WhatsAppJobType
  scheduledAt: string
  originalScheduledAt?: string
  expiresAt?: string
  status: WhatsAppJobStatus
  provider?: 'wp_sender' | 'ycloud'
  providerStatus?: 'sent' | 'delivered' | 'failed'
  providerMessageId?: string
  senderNumber?: string
  sessionId?: string
  clinicName: string
  doctorName?: string
  branchName?: string
  appointmentDate: string
  appointmentTime: string
  hasFixedTime?: boolean
  documentId?: string
  documentRootKey?: string
  documentType?: 'prescription' | 'invoice'
  documentVersion?: number
  contentHash?: string
  documentUrl?: string
  scheduleVersion?: number
  idempotencyKey?: string
  attempts: number
  maxAttempts?: number
  lastError?: string
  errorClass?: string
  uncertainOutcome?: boolean
  lockedAt?: string | null
  lockExpiresAt?: string | null
  lockOwner?: string | null
  cancelledReason?: string
  sentAt?: string
  deliveredAt?: string
  createdAt: string
  updatedAt: string
}

export interface WhatsAppQueueStore {
  readDoc: (path: string) => Promise<any | null>
  writeDoc: (path: string, data: Record<string, any>, merge?: boolean) => Promise<void>
  createUniqueDoc: (collection: string, data: Record<string, any>, docId: string) => Promise<boolean>
  readVersionedDoc: (path: string) => Promise<{ data: any; updateTime: string } | null>
  patchDocAtVersion: (path: string, updateTime: string, data: Record<string, any>) => Promise<boolean>
  queryByField: (collection: string, field: string, value: any, limit?: number) => Promise<any[]>
  queryByFields: (collection: string, filters: Record<string, string> | Array<{ field: string; value: any }>, limit?: number) => Promise<any[]>
  queryDueJobs: (nowIso: string, statuses: WhatsAppJobStatus[], limit: number) => Promise<any[]>
  deleteDoc: (path: string) => Promise<void>
}

const LOCK_LEASE_MS = 180_000
const DEFAULT_MAX_RETRY_ATTEMPTS = 4
const FIELD_TYPE_MAP: Record<string, 'string' | 'number' | 'boolean'> = {}

function restValue(v: unknown): any {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  return { stringValue: String(v) }
}

function fromRestField(v: any): any {
  if (!v || typeof v !== 'object') return v
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return Boolean(v.booleanValue)
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromRestField)
  if ('mapValue' in v) {
    const out: Record<string, any> = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = fromRestField(val)
    return out
  }
  return undefined
}

async function queryFirestoreJobsByStatusAndDue(status: WhatsAppJobStatus, nowIso: string, limit: number): Promise<any[]> {
  if (status === 'pending') {
    return queryDueWhatsAppJobs(nowIso, limit).catch(() => [])
  }
  const emu = getFirestoreEmulatorOrigin()
  const { project: projectId } = getFirebaseServerCredentials()
  const baseUrl = emu
    ? `${emu}/v1/projects/${projectId}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  const token = emu ? '' : await googleAccessToken('firestore')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${baseUrl}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'whatsapp_jobs' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: restValue(status) } },
              { fieldFilter: { field: { fieldPath: 'scheduledAt' }, op: 'LESS_THAN_OR_EQUAL', value: restValue(nowIso) } },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'scheduledAt' }, direction: 'ASCENDING' }],
        limit,
      },
    }),
  })
  if (!res.ok) return []
  const rows = (await res.json()) as any[]
  const docs = rows
    .filter((r) => r?.document?.fields)
    .map((r) => {
      const nameParts = String(r.document.name || '').split('/')
      const out: Record<string, any> = { id: nameParts[nameParts.length - 1] }
      for (const [k, v] of Object.entries(r.document.fields)) out[k] = fromRestField(v)
      return out
    })
  recordFirestoreRead('whatsapp_jobs:due', Math.max(1, docs.length), 'whatsapp_jobs')
  return docs
}

export const defaultFirestoreWhatsAppStore: WhatsAppQueueStore = {
  readDoc: (path) => readDocument(path),
  writeDoc: (path, data, merge = false) => writeDocument(path, data, merge),
  createUniqueDoc: async (collection, data, docId) => {
    try {
      await createDocument(collection, data, docId)
      return true
    } catch {
      return false
    }
  },
  readVersionedDoc: (path) => readVersionedDocument(path),
  patchDocAtVersion: async (path, updateTime, data) => {
    try {
      await patchDocumentAtVersion(path, updateTime, data)
      return true
    } catch {
      return false
    }
  },
  queryByField: (collection, field, value, limit = 100) => queryDocumentsByField(collection, field, value, limit),
  queryByFields: (collection, filters, limit = 100) => {
    const map = Array.isArray(filters) ? Object.fromEntries(filters.map((f) => [f.field, String(f.value)])) : filters
    return queryDocumentsByFields(collection, map, limit)
  },
  queryDueJobs: async (nowIso, statuses, limit) => {
    const batches = await Promise.all(
      statuses.map((st) => queryFirestoreJobsByStatusAndDue(st, nowIso, limit).catch(() => [])),
    )
    const dedup = new Map<string, any>()
    for (const batch of batches) {
      for (const doc of batch) {
        if (doc?.id && !dedup.has(doc.id)) dedup.set(doc.id, doc)
      }
    }
    return Array.from(dedup.values())
      .sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')))
      .slice(0, limit)
  },
  deleteDoc: (path) => deleteDocument(path),
}

export function createInMemoryWhatsAppStore(initialDocs: Record<string, any> = {}): WhatsAppQueueStore & { docs: Map<string, { data: any; version: number }> } {
  const docs = new Map<string, { data: any; version: number }>()
  for (const [k, v] of Object.entries(initialDocs)) {
    docs.set(k, { data: structuredClone(v), version: 1 })
  }
  const listCol = (col: string) => {
    const out: any[] = []
    for (const [path, rec] of docs.entries()) {
      if (path.startsWith(`${col}/`)) {
        out.push({ id: path.slice(col.length + 1), ...structuredClone(rec.data) })
      }
    }
    return out
  }
  return {
    docs,
    readDoc: async (path) => {
      const rec = docs.get(path)
      return rec ? { id: path.split('/').pop(), ...structuredClone(rec.data) } : null
    },
    writeDoc: async (path, data, merge = false) => {
      const prev = docs.get(path)
      const next = merge && prev ? { ...structuredClone(prev.data), ...structuredClone(data) } : structuredClone(data)
      docs.set(path, { data: next, version: (prev?.version || 0) + 1 })
    },
    createUniqueDoc: async (col, data, docId) => {
      const key = `${col}/${docId}`
      if (docs.has(key)) return false
      docs.set(key, { data: structuredClone(data), version: 1 })
      return true
    },
    readVersionedDoc: async (path) => {
      const rec = docs.get(path)
      if (!rec) return null
      return { data: { id: path.split('/').pop(), ...structuredClone(rec.data) }, updateTime: String(rec.version) }
    },
    patchDocAtVersion: async (path, updateTime, data) => {
      const rec = docs.get(path)
      if (!rec || String(rec.version) !== String(updateTime)) return false
      docs.set(path, { data: { ...structuredClone(rec.data), ...structuredClone(data) }, version: rec.version + 1 })
      return true
    },
    queryByField: async (col, field, value, limit = 100) => {
      return listCol(col)
        .filter((d) => d[field] === value)
        .slice(0, limit)
    },
    queryByFields: async (col, filters, limit = 100) => {
      const entries = Array.isArray(filters) ? filters.map((f) => [f.field, f.value]) : Object.entries(filters)
      return listCol(col)
        .filter((d) => entries.every(([k, v]) => d[k] === v))
        .slice(0, limit)
    },
    queryDueJobs: async (nowIso, statuses, limit) => {
      const set = new Set<string>(statuses)
      return listCol('whatsapp_jobs')
        .filter((d) => set.has(d.status) && String(d.scheduledAt || '') <= nowIso)
        .sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')))
        .slice(0, limit)
    },
    deleteDoc: async (path) => {
      docs.delete(path)
    },
  }
}

let activeStore: WhatsAppQueueStore = defaultFirestoreWhatsAppStore

export function setWhatsAppQueueStoreForTesting(store: WhatsAppQueueStore | null) {
  activeStore = store || defaultFirestoreWhatsAppStore
}

export const DEFAULT_WHATSAPP_SETTINGS: any = {
  sendBookingConfirmation: true,
  sendReminders: true,
  sendAppointmentReminder: true,
  sendRescheduledNotification: true,
  sendCancelledNotification: true,
  sendCancellationNotification: true,
  sendPrescription: true,
  sendInvoice: true,
  monthlyLimit: 500,
  reminders: [
    { id: 'rem-1', value: 24, unit: 'hour' as const },
    { id: 'rem-2', value: 2, unit: 'hour' as const },
  ],
}

export function cairoUsageMonth(isoOrDate: string | Date = new Date()): string {
  const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(dt)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}`
}

export async function reserveWpSenderUsage(
  clinicId: string,
  limit = 500,
  now = new Date().toISOString(),
  mock = false,
): Promise<boolean> {
  if (mock) return true
  const path = `clinics/${clinicId}/wp_sender_usage/${cairoUsageMonth(now)}`
  for (let i = 0; i < 4; i++) {
    const ver = await activeStore.readVersionedDoc(path)
    if (!ver) {
      if (limit <= 0) return false
      const created = await activeStore.createUniqueDoc(
        `clinics/${clinicId}/wp_sender_usage`,
        { count: 1, limit, updatedAt: now },
        cairoUsageMonth(now),
      )
      if (created) return true
      continue
    }
    const count = Number(ver.data.count || 0)
    if (count >= limit) return false
    const ok = await activeStore.patchDocAtVersion(path, ver.updateTime, { count: count + 1, updatedAt: now })
    if (ok) return true
  }
  return false
}

export function formatArabicDate(dateStr: string): string {
  if (!dateStr) return 'قريبًا'
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    if (!year || !month || !day) return dateStr
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'Africa/Cairo',
    }).format(dt)
  } catch {
    return dateStr
  }
}

export function formatArabicTime(time24: string): string {
  if (!time24) return 'حسب الموعد'
  const cleanTime = String(time24).trim().toUpperCase()
  const isPm = cleanTime.includes('PM') || cleanTime.includes('م')
  const isAm = cleanTime.includes('AM') || cleanTime.includes('ص')
  const digitsMatch = cleanTime.match(/(\d{1,2}):(\d{2})/)
  if (!digitsMatch) return time24
  let hh = parseInt(digitsMatch[1], 10)
  const mm = parseInt(digitsMatch[2], 10)
  if (isPm && hh < 12) hh += 12
  if (isAm && hh === 12) hh = 0
  const period = hh >= 12 ? 'مساءً' : 'صباحاً'
  const h12 = hh % 12 || 12
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

export function buildTemplateParameters(job: any): { templateName: string; variables: string[] } {
  const dateStr = formatArabicDate(job.appointmentDate)
  const timeStr = formatArabicTime(job.appointmentTime)
  const patient = String(job.patientName || 'المريض')
  const clinic = String(job.clinicName || 'العيادة')
  const track = `https://yalla-clinic.com/clinic/${job.clinicSlug || 'clinic'}/track/${job.appointmentId}`

  if (job.jobType === 'booking_confirmation') {
    return {
      templateName: 'booking_confirmation',
      variables: [patient, clinic, dateStr, timeStr, track],
    }
  }
  return {
    templateName: 'appointment_reminder',
    variables: [patient, clinic, dateStr, timeStr],
  }
}

export function getCairoUtcOffsetMinutes(atDate: Date = new Date()): number {
  return getCairoOffsetMinutes(atDate)
}

export function getCairoAppointmentUtcDate(dateStr: string, timeStr?: string): Date {
  const safeDate = String(dateStr || '').trim() || new Date().toISOString().split('T')[0]
  const [yearStr, monthStr, dayStr] = safeDate.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const day = parseInt(dayStr, 10)

  let hours = 10
  let minutes = 0

  if (timeStr && typeof timeStr === 'string') {
    const cleanTime = timeStr.trim().toUpperCase()
    const isPm = cleanTime.includes('PM') || cleanTime.includes('م')
    const isAm = cleanTime.includes('AM') || cleanTime.includes('ص')
    const digitsMatch = cleanTime.match(/(\d{1,2}):(\d{2})/)

    if (digitsMatch) {
      let h = parseInt(digitsMatch[1], 10)
      minutes = parseInt(digitsMatch[2], 10)
      if (isPm && h < 12) h += 12
      if (isAm && h === 12) h = 0
      hours = h
    }
  }

  const dummyUtc = new Date(Date.UTC(year, month, day, hours, minutes, 0))
  const offsetMins = getCairoUtcOffsetMinutes(dummyUtc)
  return new Date(dummyUtc.getTime() - offsetMins * 60 * 1000)
}

function getCairoOffsetMinutes(atDate: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      timeZoneName: 'shortOffset',
    }).formatToParts(atDate)
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+2'
    const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!m) return 120
    const sign = m[1] === '-' ? -1 : 1
    return sign * (Number(m[2]) * 60 + Number(m[3] || 0))
  } catch {
    return 120
  }
}

export function parseAppointmentCairoTime(dateStr: string, time24: string): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  const [hh, mm] = (time24 || '10:00').split(':').map(Number)
  const safeH = Number.isFinite(hh) ? hh : 10
  const safeM = Number.isFinite(mm) ? mm : 0
  const approxUtc = Date.UTC(y, m - 1, d, safeH, safeM, 0)
  const offsetMins = getCairoOffsetMinutes(new Date(approxUtc))
  return approxUtc - offsetMins * 60_000
}

export function jobTypeToSubFeature(jobType: WhatsAppJobType): WhatsAppSubFeatureKey {
  switch (jobType) {
    case 'booking_confirmation':
      return 'booking_confirmation'
    case 'appointment_reminder':
      return 'appointment_reminder'
    case 'appointment_rescheduled':
    case 'appointment_cancelled':
      return 'reschedule_cancel'
    case 'prescription_ready':
      return 'prescription'
    case 'invoice_ready':
      return 'invoice'
  }
}

export function jobTypeToTemplateKey(jobType: WhatsAppJobType): WhatsAppTemplateKey {
  switch (jobType) {
    case 'prescription_ready':
      return 'prescription'
    case 'invoice_ready':
      return 'invoice'
    default:
      return jobType
  }
}

/**
 * Check patient WhatsApp opt-in consent granularly across categories:
 * - booking (confirmation / reschedule / cancel)
 * - reminders
 * - documents (prescriptions / invoices)
 */
export function hasWhatsAppConsent(record: any, jobType: WhatsAppJobType): boolean {
  if (!record || typeof record !== 'object') return false
  if (record.whatsappConsent === false) return false
  const prefs = record.whatsappConsentPreferences || record.consentPreferences
  if (prefs && typeof prefs === 'object') {
    if (jobType === 'appointment_reminder' && prefs.reminders === false) return false
    if (
      (jobType === 'booking_confirmation' || jobType === 'appointment_rescheduled' || jobType === 'appointment_cancelled') &&
      prefs.booking === false
    ) {
      return false
    }
    if ((jobType === 'prescription_ready' || jobType === 'invoice_ready') && prefs.documents === false) {
      return false
    }
  }
  return record.whatsappConsent === true || Boolean(prefs && typeof prefs === 'object')
}

export async function getPlatformWhatsAppDefaults(store: WhatsAppQueueStore = activeStore): Promise<PlatformWhatsAppDefaults> {
  const doc = await store.readDoc('platform_config/global').catch(() => null)
  return normalizePlatformWhatsAppDefaults(doc?.whatsappDefaults)
}

export async function getClinicWhatsAppConfig(
  clinicId: string,
  store: WhatsAppQueueStore = activeStore,
): Promise<ClinicWhatsAppConfig | null> {
  if (!clinicId) return null
  const doc = await store.readDoc(`clinic_whatsapp_configs/${clinicId}`).catch(() => null)
  const wp = getWpSenderConfig(clinicId)
  if (!doc && (!wp || wp.mode === 'off')) return null
  const s = (doc?.settings || {}) as Partial<ClinicWhatsAppSettings>
  return {
    clinicId,
    clinicSlug: String(doc?.clinicSlug || ''),
    wabaId: doc?.wabaId,
    phoneNumberId: doc?.phoneNumberId,
    displayPhoneNumber: doc?.displayPhoneNumber,
    verifiedName: doc?.verifiedName,
    connected: Boolean(doc?.connected),
    enabled: doc?.enabled !== undefined ? Boolean(doc.enabled) : (wp ? wp.mode !== 'off' : true),
    mode: wp?.mode || 'off',
    senderNumber: wp?.senderNumber || doc?.senderNumber,
    sessionId: wp?.sessionId || doc?.sessionId,
    sessionStatus: doc?.sessionStatus || (wp?.mode === 'mock' ? 'connected' : 'unknown'),
    disconnectedAt: doc?.disconnectedAt,
    lastConnectedAt: doc?.lastConnectedAt,
    settings: {
      sendBookingConfirmation: Boolean(s.sendBookingConfirmation ?? DEFAULT_WHATSAPP_SETTINGS.sendBookingConfirmation),
      sendAppointmentReminder: Boolean(s.sendAppointmentReminder ?? DEFAULT_WHATSAPP_SETTINGS.sendAppointmentReminder),
      sendRescheduledNotification: Boolean(s.sendRescheduledNotification ?? DEFAULT_WHATSAPP_SETTINGS.sendRescheduledNotification),
      sendCancelledNotification: Boolean(s.sendCancelledNotification ?? DEFAULT_WHATSAPP_SETTINGS.sendCancelledNotification),
      sendPrescription: Boolean(s.sendPrescription ?? DEFAULT_WHATSAPP_SETTINGS.sendPrescription),
      sendInvoice: Boolean(s.sendInvoice ?? DEFAULT_WHATSAPP_SETTINGS.sendInvoice),
      monthlyLimit: Number(s.monthlyLimit ?? DEFAULT_WHATSAPP_SETTINGS.monthlyLimit),
      reminders:
        Array.isArray(s.reminders) && s.reminders.length > 0
          ? (s.reminders.filter((r) => Array.isArray(r) && r.length === 2) as ClinicWhatsAppReminderRule[])
          : DEFAULT_WHATSAPP_SETTINGS.reminders,
    },
    templates: doc?.templates && typeof doc.templates === 'object' ? doc.templates : undefined,
    templateAudit: doc?.templateAudit && typeof doc.templateAudit === 'object' ? doc.templateAudit : undefined,
    ownerPolicy: doc?.ownerPolicy && typeof doc.ownerPolicy === 'object' ? doc.ownerPolicy : undefined,
    linkedAt: doc?.linkedAt,
    updatedAt: doc?.updatedAt,
    updatedBy: doc?.updatedBy,
  }
}

export async function cancelPendingAppointmentJobs(
  appointmentId: string,
  reason = 'SUPERSEDED',
  newScheduleVersion?: number,
  options?: { jobTypes?: WhatsAppJobType[]; store?: WhatsAppQueueStore },
): Promise<number> {
  if (!appointmentId) return 0
  const store = options?.store || activeStore
  try {
    const existingJobs = await store.queryByField('whatsapp_jobs', 'appointmentId', appointmentId, 100)
    const nowIso = new Date().toISOString()
    const targetStatuses = new Set(['pending', 'queued', 'waiting_for_connection'])
    const allowedTypes = options?.jobTypes ? new Set(options.jobTypes) : null
    let cancelledCount = 0

    for (const job of existingJobs) {
      if (!targetStatuses.has(job.status)) continue
      if (allowedTypes && !allowedTypes.has(job.jobType)) continue
      if (newScheduleVersion !== undefined && Number(job.scheduleVersion || 0) >= newScheduleVersion) continue
      await store.writeDoc(
        `whatsapp_jobs/${job.id}`,
        {
          status: 'cancelled',
          cancelledReason: reason,
          updatedAt: nowIso,
        },
        true,
      )
      cancelledCount++
    }
    return cancelledCount
  } catch (err) {
    console.error(`[WhatsApp Scheduler] Failed cancelling jobs for ${appointmentId}:`, err)
    return 0
  }
}

export async function computeDocumentContentHash(payload: Record<string, any>): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort())
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20)
}

function buildRenderContextFromJob(job: WhatsAppJob, extraCtx?: Partial<WhatsAppMessageRenderContext>): WhatsAppMessageRenderContext {
  const date = formatArabicDate(job.appointmentDate)
  const time = formatArabicTime(job.appointmentTime)
  const when = job.hasFixedTime ? `${date}، الساعة ${time}` : date
  return {
    patientName: extraCtx?.patientName ?? job.patientName,
    clinicName: extraCtx?.clinicName ?? job.clinicName,
    when: extraCtx?.when ?? when,
    doctorName: extraCtx?.doctorName ?? job.doctorName,
    branchName: extraCtx?.branchName ?? job.branchName,
    link: extraCtx?.link ?? job.documentUrl,
  }
}

export function buildWpSenderMessage(
  job: WhatsAppJob,
  templates?: Partial<Record<WhatsAppTemplateKey, string>>,
  extraCtx?: Partial<WhatsAppMessageRenderContext>,
): string {
  const date = formatArabicDate(job.appointmentDate)
  const time = formatArabicTime(job.appointmentTime)
  const when = job.hasFixedTime ? `${date}، الساعة ${time}` : date
  const ctx = buildRenderContextFromJob(job, extraCtx)
  const tKey = jobTypeToTemplateKey(job.jobType)
  if (templates) {
    const rawTemplate = templates[tKey] || messageDefaults[tKey]
    const rendered = renderClinicMessage(rawTemplate, ctx)
    if ((job.jobType === 'prescription_ready' || job.jobType === 'invoice_ready') && ctx.link && !rendered.includes(ctx.link)) {
      return `${rendered}\n${ctx.link}`
    }
    return rendered
  }
  switch (job.jobType) {
    case 'booking_confirmation':
      return `أهلًا ${job.patientName}، تم تأكيد حجزك في ${job.clinicName} ليوم ${when}.`
    case 'appointment_reminder':
      return job.hasFixedTime
        ? `تذكير بموعدك القادم يوم ${date} الساعة ${time}`
        : `تذكير بموعدك القادم يوم ${date}`
    case 'appointment_rescheduled':
      return `أهلًا ${job.patientName}، تم تعديل موعدك في ${job.clinicName} إلى ${when}.`
    case 'appointment_cancelled':
      return `أهلًا ${job.patientName}، تم إلغاء موعدك في ${job.clinicName} (${when}).`
    case 'prescription_ready':
      return renderClinicMessage(messageDefaults.prescription, ctx)
    case 'invoice_ready':
      return renderClinicMessage(messageDefaults.invoice, ctx)
  }
}

function sanitizeIdPart(v: string): string {
  return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

async function resolveClinicAndPolicy(
  clinicId: string,
  clinicInput?: any,
  waConfigInput?: ClinicWhatsAppConfig | null,
  store: WhatsAppQueueStore = activeStore,
) {
  const [clinicDoc, waConfig, platformDefaults] = await Promise.all([
    clinicInput ? Promise.resolve(clinicInput) : store.readDoc(`clinics/${clinicId}`).catch(() => null),
    waConfigInput !== undefined ? Promise.resolve(waConfigInput) : getClinicWhatsAppConfig(clinicId, store),
    getPlatformWhatsAppDefaults(store),
  ])
  const policy = resolveEffectiveWhatsAppPolicy({
    platformDefaults,
    clinic: clinicDoc,
    waConfig,
  })
  return { clinicDoc, waConfig, platformDefaults, policy }
}

function computeNextBackoffIso(attempts: number, baseMs = 60_000): string {
  const delay = Math.min(30 * 60_000, baseMs * Math.pow(3, Math.max(0, attempts - 1)))
  return new Date(Date.now() + delay).toISOString()
}

export interface DispatchJobOutcome {
  outcome: 'sent' | 'waiting_for_connection' | 'uncertain' | 'requeued' | 'failed' | 'cancelled' | 'expired' | 'skipped' | 'conflict'
  status?: WhatsAppJobStatus
  messageId?: string
  reason?: string
}

/**
 * Execute a queued or waiting WhatsApp job with atomic locking, policy & consent verification,
 * expiry protection, WP Sender strict clinic isolation, and non-duplicating error handling.
 */
export async function executeWhatsAppJob(
  jobId: string,
  configOverride?: ClinicWhatsAppConfig | null,
  options?: {
    store?: WhatsAppQueueStore
    fetchImpl?: typeof fetch
    clinicDoc?: any
    lockOwner?: string
    allowExpiredBypass?: boolean
  },
): Promise<DispatchJobOutcome> {
  const store = options?.store || activeStore
  const jobPath = `whatsapp_jobs/${jobId}`
  const versioned = await store.readVersionedDoc(jobPath)
  if (!versioned) return { outcome: 'skipped', reason: 'JOB_NOT_FOUND' }

  const job = versioned.data as WhatsAppJob
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  // Terminal or locked states protection (NEVER resend sent / delivered / cancelled / expired / uncertain automatically)
  if (job.status === 'sent' || job.status === 'delivered' || job.status === 'cancelled' || job.status === 'expired') {
    return { outcome: 'skipped', status: job.status, reason: `ALREADY_${job.status.toUpperCase()}` }
  }
  if (job.uncertainOutcome === true || job.status === 'uncertain') {
    return { outcome: 'skipped', status: 'uncertain', reason: 'UNCERTAIN_NEEDS_MANUAL_REVIEW' }
  }
  if (job.status === 'processing' && job.lockExpiresAt && job.lockExpiresAt > nowIso) {
    return { outcome: 'conflict', status: 'processing', reason: 'LOCKED_BY_ANOTHER_WORKER' }
  }
  if (!['pending', 'queued', 'waiting_for_connection', 'processing'].includes(job.status)) {
    return { outcome: 'skipped', status: job.status, reason: 'NOT_RUNNABLE' }
  }

  // Acquire atomic distributed lock via optimistic version precondition
  const lockOwner = options?.lockOwner || `worker_${nowMs}_${Math.random().toString(36).slice(2, 7)}`
  const locked = await store.patchDocAtVersion(jobPath, versioned.updateTime, {
    status: 'processing',
    lockedAt: nowIso,
    lockExpiresAt: new Date(nowMs + LOCK_LEASE_MS).toISOString(),
    lockOwner,
    updatedAt: nowIso,
  })
  if (!locked) {
    return { outcome: 'conflict', reason: 'CONCURRENT_CLAIM_LOST' }
  }

  const releaseLockFields = {
    lockedAt: null,
    lockExpiresAt: null,
    lockOwner: null,
    updatedAt: new Date().toISOString(),
  }

  try {
    // 1. Check Expiry before doing anything external
    if (!options?.allowExpiredBypass && job.expiresAt && job.expiresAt < nowIso) {
      await store.writeDoc(jobPath, { status: 'expired', cancelledReason: 'WINDOW_EXPIRED', ...releaseLockFields }, true)
      return { outcome: 'expired', status: 'expired', reason: 'WINDOW_EXPIRED' }
    }

    // 2. Re-check appointment / document state when linked
    let apptDoc: any = null
    if (job.appointmentId) {
      apptDoc = await store.readDoc(`appointments/${job.appointmentId}`).catch(() => null)
      if (apptDoc) {
        if (job.jobType === 'appointment_reminder' && ['cancelled', 'completed', 'no_show', 'rejected'].includes(apptDoc.status)) {
          await store.writeDoc(jobPath, { status: 'cancelled', cancelledReason: `APPOINTMENT_${String(apptDoc.status).toUpperCase()}`, ...releaseLockFields }, true)
          return { outcome: 'cancelled', status: 'cancelled', reason: 'APPOINTMENT_NO_LONGER_ACTIVE' }
        }
        if (job.scheduleVersion && apptDoc.scheduleVersion && Number(apptDoc.scheduleVersion) > Number(job.scheduleVersion)) {
          await store.writeDoc(jobPath, { status: 'cancelled', cancelledReason: 'SUPERSEDED_SCHEDULE', ...releaseLockFields }, true)
          return { outcome: 'cancelled', status: 'cancelled', reason: 'SUPERSEDED_SCHEDULE' }
        }
        if (!hasWhatsAppConsent(apptDoc, job.jobType)) {
          await store.writeDoc(jobPath, { status: 'cancelled', cancelledReason: 'CONSENT_REVOKED', ...releaseLockFields }, true)
          return { outcome: 'cancelled', status: 'cancelled', reason: 'CONSENT_REVOKED' }
        }
      }
    }

    if (job.documentId && (job.jobType === 'prescription_ready' || job.jobType === 'invoice_ready')) {
      const col = job.jobType === 'prescription_ready' ? 'prescriptions' : 'invoices'
      const docRecord = await store.readDoc(`${col}/${job.documentId}`).catch(() => null)
      if (docRecord && (docRecord.status === 'cancelled' || docRecord.status === 'void' || docRecord.isDeleted === true)) {
        await store.writeDoc(jobPath, { status: 'cancelled', cancelledReason: 'DOCUMENT_CANCELLED', ...releaseLockFields }, true)
        return { outcome: 'cancelled', status: 'cancelled', reason: 'DOCUMENT_CANCELLED' }
      }
      if (job.documentRootKey) {
        const siblings = await store.queryByField('whatsapp_jobs', 'documentRootKey', job.documentRootKey, 20).catch(() => [])
        const newerExists = siblings.some(
          (s) =>
            s.id !== jobId &&
            s.status !== 'cancelled' &&
            Number(s.documentVersion || 0) > Number(job.documentVersion || 0),
        )
        if (newerExists) {
          await store.writeDoc(jobPath, { status: 'cancelled', cancelledReason: 'SUPERSEDED_BY_NEWER_VERSION', ...releaseLockFields }, true)
          return { outcome: 'cancelled', status: 'cancelled', reason: 'SUPERSEDED_BY_NEWER_VERSION' }
        }
      }
    }

    // 3. Verify live Owner Policy & Clinic Config
    const { config: configResolved, policy } = await (async () => {
      const res = await resolveClinicAndPolicy(job.clinicId, options?.clinicDoc, configOverride, store)
      return { config: res.waConfig, policy: res.policy }
    })()

    const subFeature = jobTypeToSubFeature(job.jobType)
    const featPolicy = policy.features[subFeature]
    if (!policy.sectionVisible || !policy.serviceEnabled || !featPolicy.visible || !featPolicy.enabled || !featPolicy.autoSend) {
      await store.writeDoc(
        jobPath,
        {
          status: 'cancelled',
          cancelledReason: !policy.serviceEnabled ? 'SERVICE_DISABLED_BY_OWNER' : 'FEATURE_DISABLED_BY_POLICY',
          ...releaseLockFields,
        },
        true,
      )
      return { outcome: 'cancelled', status: 'cancelled', reason: 'POLICY_DISABLED' }
    }

    // 4. Determine provider & validate template context readiness
    const wpConfig = getWpSenderConfig(job.clinicId)
    const useWpSender = wpConfig?.mode === 'live' || wpConfig?.mode === 'mock'

    const renderedCtx = buildRenderContextFromJob(job)
    const tplKey = jobTypeToTemplateKey(job.jobType)
    const activeTpl = (configResolved?.templates?.[tplKey] || messageDefaults[tplKey]) as string
    const readiness = inspectTemplateContextReadiness(activeTpl, renderedCtx, tplKey)
    if (!readiness.ready && (readiness.missingVariables.includes('{الرابط}') || readiness.missingVariables.includes('{اسم_المريض}'))) {
      await store.writeDoc(
        jobPath,
        {
          status: 'failed',
          errorClass: 'permanent',
          lastError: `MISSING_TEMPLATE_DATA:${readiness.missingVariables.join(',')}`,
          ...releaseLockFields,
        },
        true,
      )
      return { outcome: 'failed', status: 'failed', reason: 'DATA_INCOMPLETE' }
    }

    if (useWpSender) {
      const limit = Number(configResolved?.settings?.monthlyLimit ?? DEFAULT_WHATSAPP_SETTINGS.monthlyLimit ?? 500)
      const hasQuota = await reserveWpSenderUsage(job.clinicId, limit, nowIso, wpConfig?.mode === 'mock')
      if (!hasQuota) {
        await store.writeDoc(
          jobPath,
          {
            status: 'failed',
            provider: 'wp_sender',
            errorClass: 'permanent',
            lastError: 'MONTHLY_QUOTA_EXCEEDED',
            ...releaseLockFields,
          },
          true,
        )
        return { outcome: 'failed', status: 'failed', reason: 'MONTHLY_QUOTA_EXCEEDED' }
      }

      const message = buildWpSenderMessage(job, configResolved?.templates, renderedCtx)
      const wpRes: WpSenderResult = await sendWpSenderMessage({
        clinicId: job.clinicId,
        phone: job.patientPhone,
        message,
        idempotencyKey: job.idempotencyKey || jobId,
        fetchImpl: options?.fetchImpl,
        persistedSessionStatus: configResolved?.sessionStatus,
      })

      if (wpRes.ok) {
        await store.writeDoc(
          jobPath,
          {
            status: 'sent',
            provider: 'wp_sender',
            providerStatus: 'sent',
            providerMessageId: wpRes.messageId || `wp_${Date.now()}`,
            senderNumber: wpRes.senderNumber || wpConfig?.senderNumber,
            sessionId: wpRes.sessionId || wpConfig?.sessionId,
            sentAt: nowIso,
            attempts: (job.attempts || 0) + 1,
            lastError: null,
            errorClass: null,
            ...releaseLockFields,
          },
          true,
        )
        if (configResolved?.sessionStatus === 'disconnected') {
          await store.writeDoc(
            `clinic_whatsapp_configs/${job.clinicId}`,
            { sessionStatus: 'connected', lastConnectedAt: nowIso, updatedAt: nowIso },
            true,
          ).catch(() => null)
        }
        return { outcome: 'sent', status: 'sent', messageId: wpRes.messageId }
      }

      // Disconnected / waiting for clinic WA session reconnection -> preserve job, do NOT lose or burn retries!
      if (wpRes.errorClass === 'disconnected' || wpRes.errorClass === 'live_disabled' || wpRes.errorClass === 'not_configured') {
        const retryAt = new Date(Date.now() + 5 * 60_000).toISOString()
        await store.writeDoc(
          jobPath,
          {
            status: 'waiting_for_connection',
            provider: 'wp_sender',
            scheduledAt: retryAt,
            errorClass: wpRes.errorClass,
            lastError: wpRes.error || 'WAITING_FOR_CONNECTION',
            ...releaseLockFields,
          },
          true,
        )
        if (wpRes.errorClass === 'disconnected') {
          await store.writeDoc(
            `clinic_whatsapp_configs/${job.clinicId}`,
            { sessionStatus: 'disconnected', disconnectedAt: nowIso, updatedAt: nowIso },
            true,
          ).catch(() => null)
        }
        return { outcome: 'waiting_for_connection', status: 'waiting_for_connection', reason: wpRes.error }
      }

      // Uncertain timeout / ambiguous acceptance -> DO NOT auto-retry blindly (prevents duplicates!)
      if (wpRes.errorClass === 'uncertain') {
        await store.writeDoc(
          jobPath,
          {
            status: 'uncertain',
            provider: 'wp_sender',
            uncertainOutcome: true,
            errorClass: 'uncertain',
            lastError: wpRes.error || 'UNCERTAIN_PROVIDER_RESPONSE',
            attempts: (job.attempts || 0) + 1,
            ...releaseLockFields,
          },
          true,
        )
        return { outcome: 'uncertain', status: 'uncertain', reason: wpRes.error }
      }

      // Transient pre-send error -> exponential backoff retry up to maxAttempts
      const nextAttempts = (job.attempts || 0) + 1
      const maxAttempts = job.maxAttempts || DEFAULT_MAX_RETRY_ATTEMPTS
      if (wpRes.errorClass === 'transient' && nextAttempts < maxAttempts) {
        await store.writeDoc(
          jobPath,
          {
            status: 'queued',
            provider: 'wp_sender',
            scheduledAt: computeNextBackoffIso(nextAttempts),
            attempts: nextAttempts,
            errorClass: 'transient',
            lastError: wpRes.error || 'TRANSIENT_ERROR',
            ...releaseLockFields,
          },
          true,
        )
        return { outcome: 'requeued', status: 'queued', reason: wpRes.error }
      }

      await store.writeDoc(
        jobPath,
        {
          status: 'failed',
          provider: 'wp_sender',
          providerStatus: 'failed',
          attempts: nextAttempts,
          errorClass: wpRes.errorClass || 'permanent',
          lastError: wpRes.error || 'SEND_FAILED',
          ...releaseLockFields,
        },
        true,
      )
      return { outcome: 'failed', status: 'failed', reason: wpRes.error }
    }

    // Legacy YCloud / unconfigured WP Sender fallback
    if (configResolved?.phoneNumberId && configResolved?.connected) {
      const recipientPhone = formatToE164(job.patientPhone)
      if (!recipientPhone) {
        await store.writeDoc(jobPath, { status: 'failed', errorClass: 'permanent', lastError: 'INVALID_PHONE_NUMBER', ...releaseLockFields }, true)
        return { outcome: 'failed', status: 'failed', reason: 'INVALID_PHONE_NUMBER' }
      }
      const dateArabic = formatArabicDate(job.appointmentDate)
      const timeArabic = formatArabicTime(job.appointmentTime)
      try {
        const fromNumber = configResolved?.displayPhoneNumber || configResolved?.senderNumber || '+201000000000'
        const res = await sendWhatsAppTemplateMessage({
          from: fromNumber,
          to: recipientPhone,
          templateName: tplKey,
          bodyVariables: [
            job.patientName || 'المريض',
            job.clinicName || 'العيادة',
            dateArabic,
            timeArabic,
          ],
        })
        await store.writeDoc(
          jobPath,
          {
            status: 'sent',
            provider: 'ycloud',
            providerStatus: 'sent',
            providerMessageId: res.id || `yc_${Date.now()}`,
            sentAt: nowIso,
            attempts: (job.attempts || 0) + 1,
            ...releaseLockFields,
          },
          true,
        )
        return { outcome: 'sent', status: 'sent', messageId: res.id }
      } catch (err: any) {
        await store.writeDoc(
          jobPath,
          {
            status: 'failed',
            provider: 'ycloud',
            attempts: (job.attempts || 0) + 1,
            lastError: err?.message || 'YCLOUD_SEND_FAILED',
            ...releaseLockFields,
          },
          true,
        )
        return { outcome: 'failed', status: 'failed', reason: err?.message }
      }
    }

    // Clinic has no connected WA session -> queue cleanly as waiting_for_connection
    await store.writeDoc(
      jobPath,
      {
        status: 'waiting_for_connection',
        scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        lastError: 'NO_ACTIVE_WHATSAPP_SESSION',
        ...releaseLockFields,
      },
      true,
    )
    return { outcome: 'waiting_for_connection', status: 'waiting_for_connection', reason: 'NO_ACTIVE_WHATSAPP_SESSION' }
  } catch (err: any) {
    console.error(`[WhatsApp Scheduler] Execution failed for ${jobId}:`, err)
    await store.writeDoc(
      jobPath,
      {
        status: 'queued',
        scheduledAt: computeNextBackoffIso((job.attempts || 0) + 1),
        attempts: (job.attempts || 0) + 1,
        lastError: err instanceof Error ? err.message : 'EXECUTION_ERROR',
        ...releaseLockFields,
      },
      true,
    ).catch(() => null)
    return { outcome: 'requeued', status: 'queued', reason: 'EXECUTION_ERROR' }
  }
}

export interface ScheduleNotificationsParams {
  clinicId: string
  clinicSlug?: string
  clinicName?: string
  doctorName?: string
  branchName?: string
  appointmentId?: string
  id?: string
  patientName: string
  patientPhone: string
  appointmentDate?: string
  date?: string
  appointmentTime?: string
  time?: string
  whatsappConsent: boolean
  whatsappReminderTime?: string | null
  whatsappHasFixedTime?: boolean
  whatsappConsentPreferences?: { booking?: boolean; reminders?: boolean; documents?: boolean }
  hasFixedTime?: boolean
  clinicDoc?: any
  store?: WhatsAppQueueStore
  fetchImpl?: typeof fetch
}

export async function scheduleAppointmentNotifications(params: ScheduleNotificationsParams) {
  const store = params.store || activeStore
  const clinicId = params.clinicId
  const clinicSlug = params.clinicSlug
  const appointmentId = params.appointmentId || params.id || ''
  const appointmentDate = params.appointmentDate || params.date || ''
  const appointmentTime = String(params.whatsappReminderTime || params.appointmentTime || params.time || '')
  const hasFixedTime = Boolean(params.hasFixedTime ?? params.whatsappHasFixedTime)
  const {
    patientName,
    patientPhone,
    whatsappConsent,
    whatsappConsentPreferences,
  } = params

  if (!clinicId || !appointmentId || !patientPhone) return { scheduled: 0, skipped: 'MISSING_FIELDS' }
  const consentCtx = { whatsappConsent, whatsappConsentPreferences }

  try {
    const { clinicDoc, waConfig, policy } = await resolveClinicAndPolicy(clinicId, params.clinicDoc, undefined, store)
    const clinicName = params.clinicName || String(clinicDoc?.clinicName || clinicDoc?.name || 'العيادة')
    const doctorName = params.doctorName || String(clinicDoc?.doctorName || '')
    const branchName = params.branchName || ''
    if (!policy.sectionVisible || !policy.serviceEnabled) {
      return { scheduled: 0, skipped: 'WHATSAPP_POLICY_DISABLED' }
    }

    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()
    const apptTimestamp = parseAppointmentCairoTime(appointmentDate, appointmentTime)
    const apptExpiresAt = apptTimestamp ? new Date(apptTimestamp + 4 * 3_600_000).toISOString() : undefined
    let createdCount = 0

    // 1. Booking Confirmation (immediate + idempotent lock)
    const confPolicy = policy.features.booking_confirmation
    if (confPolicy.autoSend && hasWhatsAppConsent(consentCtx, 'booking_confirmation')) {
      const jobId = `conf_${sanitizeIdPart(appointmentId)}`
      const acquired = await store.createUniqueDoc(
        'whatsapp_dedup',
        { jobId, createdAt: nowIso },
        `conf_${sanitizeIdPart(clinicId)}_${sanitizeIdPart(appointmentId)}`,
      )
      if (acquired) {
        const confirmJob: WhatsAppJob = {
          id: jobId,
          clinicId,
          clinicSlug,
          appointmentId,
          patientName,
          patientPhone,
          jobType: 'booking_confirmation',
          scheduledAt: nowIso,
          originalScheduledAt: nowIso,
          expiresAt: apptExpiresAt,
          status: 'queued',
          clinicName,
          doctorName,
          branchName,
          appointmentDate,
          appointmentTime,
          hasFixedTime,
          scheduleVersion: 1,
          idempotencyKey: jobId,
          attempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
        await store.writeDoc(`whatsapp_jobs/${jobId}`, confirmJob)
        createdCount++
        await executeWhatsAppJob(jobId, waConfig, { store, fetchImpl: params.fetchImpl, clinicDoc: params.clinicDoc })
      }
    }

    // 2. Reminders
    const remPolicy = policy.features.appointment_reminder
    if (remPolicy.autoSend && hasWhatsAppConsent(consentCtx, 'appointment_reminder') && apptTimestamp) {
      const rules = waConfig?.settings.reminders || DEFAULT_WHATSAPP_SETTINGS.reminders
      for (const [amount, unit] of rules) {
        const offsetMs = unit === 'day' ? amount * 24 * 3_600_000 : amount * 3_600_000
        const targetMs = apptTimestamp - offsetMs
        if (targetMs <= nowMs + 60_000) continue
        const targetIso = new Date(targetMs).toISOString()
        const remId = `rem_${sanitizeIdPart(appointmentId)}_${amount}${unit}_v1`
        const acquired = await store.createUniqueDoc('whatsapp_dedup', { jobId: remId, createdAt: nowIso }, remId)
        if (!acquired) continue

        await store.writeDoc(`whatsapp_jobs/${remId}`, {
          id: remId,
          clinicId,
          clinicSlug,
          appointmentId,
          patientName,
          patientPhone,
          jobType: 'appointment_reminder',
          scheduledAt: targetIso,
          originalScheduledAt: targetIso,
          expiresAt: new Date(apptTimestamp).toISOString(),
          status: 'queued',
          clinicName,
          doctorName,
          branchName,
          appointmentDate,
          appointmentTime,
          hasFixedTime,
          scheduleVersion: 1,
          idempotencyKey: remId,
          attempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        } satisfies WhatsAppJob)
        createdCount++
      }
    }

    return { scheduled: createdCount }
  } catch (err) {
    console.error('[WhatsApp Scheduler] Failed to schedule appointment notifications:', err)
    return { scheduled: 0, error: err instanceof Error ? err.message : 'UNKNOWN' }
  }
}

export interface AppointmentRescheduledParams {
  clinicId?: string
  clinicSlug?: string
  clinicName?: string
  doctorName?: string
  branchName?: string
  appointmentId: string
  patientName?: string
  patientPhone?: string
  newDate: string
  newTime?: string
  whatsappConsent?: boolean
  whatsappConsentPreferences?: { booking?: boolean; reminders?: boolean; documents?: boolean }
  scheduleVersion?: number
  hasFixedTime?: boolean
  clinicDoc?: any
  store?: WhatsAppQueueStore
  fetchImpl?: typeof fetch
}

export async function handleAppointmentRescheduled(
  paramsOrId: AppointmentRescheduledParams | string,
  legacyNewDate?: string,
  legacyNewTime?: string,
  legacyVersion?: number,
) {
  const rawParams: AppointmentRescheduledParams =
    typeof paramsOrId === 'string'
      ? {
          appointmentId: paramsOrId,
          newDate: legacyNewDate || '',
          newTime: legacyNewTime || '',
          scheduleVersion: legacyVersion,
        }
      : paramsOrId

  const store = rawParams.store || activeStore
  const appointmentId = rawParams.appointmentId
  if (!appointmentId) return { rescheduled: 0, error: 'MISSING_APPOINTMENT_ID' }

  const apptDoc = (!rawParams.clinicId || !rawParams.patientPhone)
    ? await store.readDoc(`appointments/${appointmentId}`).catch(() => null)
    : null
  const clinicId = rawParams.clinicId || String(apptDoc?.clinic_id || apptDoc?.clinicId || '')
  if (!clinicId) return { rescheduled: 0, error: 'MISSING_CLINIC_ID' }

  const version = rawParams.scheduleVersion || Math.floor(Date.now() / 1000)

  try {
    await cancelPendingAppointmentJobs(appointmentId, 'APPOINTMENT_RESCHEDULED', version, { store })
    const { clinicDoc, waConfig, policy } = await resolveClinicAndPolicy(clinicId, rawParams.clinicDoc, undefined, store)
    if (!policy.sectionVisible || !policy.serviceEnabled) return { rescheduled: 0, skipped: 'POLICY_DISABLED' }

    const clinicSlug = rawParams.clinicSlug || String(clinicDoc?.slug || '')
    const clinicName = rawParams.clinicName || String(clinicDoc?.clinicName || clinicDoc?.name || 'العيادة')
    const doctorName = rawParams.doctorName || String(clinicDoc?.doctorName || '')
    const branchName = rawParams.branchName || String(apptDoc?.branchName || '')
    const patientName = rawParams.patientName || String(apptDoc?.patientName || 'المريض')
    const patientPhone = rawParams.patientPhone || String(apptDoc?.phone || '')
    const newDate = rawParams.newDate || String(apptDoc?.date || '')
    const newTime = rawParams.newTime ?? String(apptDoc?.whatsappReminderTime || apptDoc?.time || '')
    const hasFixedTime = Boolean(rawParams.hasFixedTime ?? apptDoc?.whatsappHasFixedTime ?? rawParams.newTime)
    const consentCtx = {
      whatsappConsent: rawParams.whatsappConsent ?? Boolean(apptDoc?.whatsappConsent),
      whatsappConsentPreferences: rawParams.whatsappConsentPreferences || apptDoc?.whatsappConsentPreferences,
    }

    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()
    const apptTimestamp = parseAppointmentCairoTime(newDate, newTime)
    let count = 0

    const rschPolicy = policy.features.reschedule_cancel
    if (rschPolicy.autoSend && hasWhatsAppConsent(consentCtx, 'appointment_rescheduled') && patientPhone) {
      const rschId = `rsch_${sanitizeIdPart(appointmentId)}_v${version}`
      await store.writeDoc(`whatsapp_jobs/${rschId}`, {
        id: rschId,
        clinicId,
        clinicSlug,
        appointmentId,
        patientName,
        patientPhone,
        jobType: 'appointment_rescheduled',
        scheduledAt: nowIso,
        originalScheduledAt: nowIso,
        expiresAt: apptTimestamp ? new Date(apptTimestamp + 4 * 3_600_000).toISOString() : undefined,
        status: 'queued',
        clinicName,
        doctorName,
        branchName,
        appointmentDate: newDate,
        appointmentTime: newTime,
        hasFixedTime,
        scheduleVersion: version,
        idempotencyKey: rschId,
        attempts: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      } satisfies WhatsAppJob)
      count++
      await executeWhatsAppJob(rschId, waConfig, { store, fetchImpl: rawParams.fetchImpl, clinicDoc: clinicDoc || rawParams.clinicDoc })
    }

    const remPolicy = policy.features.appointment_reminder
    if (remPolicy.autoSend && hasWhatsAppConsent(consentCtx, 'appointment_reminder') && apptTimestamp && patientPhone) {
      const rules = waConfig?.settings.reminders || DEFAULT_WHATSAPP_SETTINGS.reminders
      for (const [amount, unit] of rules) {
        const offsetMs = unit === 'day' ? amount * 24 * 3_600_000 : amount * 3_600_000
        const targetMs = apptTimestamp - offsetMs
        if (targetMs <= nowMs + 60_000) continue
        const targetIso = new Date(targetMs).toISOString()
        const remId = `rem_${sanitizeIdPart(appointmentId)}_${amount}${unit}_v${version}`
        await store.writeDoc(`whatsapp_jobs/${remId}`, {
          id: remId,
          clinicId,
          clinicSlug,
          appointmentId,
          patientName,
          patientPhone,
          jobType: 'appointment_reminder',
          scheduledAt: targetIso,
          originalScheduledAt: targetIso,
          expiresAt: new Date(apptTimestamp).toISOString(),
          status: 'queued',
          clinicName,
          doctorName,
          branchName,
          appointmentDate: newDate,
          appointmentTime: newTime,
          hasFixedTime,
          scheduleVersion: version,
          idempotencyKey: remId,
          attempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        } satisfies WhatsAppJob)
        count++
      }
    }

    return { rescheduled: count }
  } catch (err) {
    console.error('[WhatsApp Scheduler] Reschedule handling failed:', err)
    return { rescheduled: 0, error: err instanceof Error ? err.message : 'UNKNOWN' }
  }
}

export interface AppointmentCancelledParams {
  clinicId?: string
  clinicSlug?: string
  clinicName?: string
  doctorName?: string
  branchName?: string
  appointmentId: string
  patientName?: string
  patientPhone?: string
  appointmentDate?: string
  appointmentTime?: string
  whatsappConsent?: boolean
  whatsappConsentPreferences?: { booking?: boolean; reminders?: boolean; documents?: boolean }
  reason?: string
  hasFixedTime?: boolean
  shouldSendCancellationNotice?: boolean
  clinicDoc?: any
  store?: WhatsAppQueueStore
  fetchImpl?: typeof fetch
}

export async function handleAppointmentCancelled(
  paramsOrId: AppointmentCancelledParams | string,
  legacyReason = 'APPOINTMENT_CANCELLED',
  legacySendNotice?: boolean,
) {
  const rawParams: AppointmentCancelledParams =
    typeof paramsOrId === 'string'
      ? {
          appointmentId: paramsOrId,
          reason: legacyReason,
          shouldSendCancellationNotice: legacySendNotice,
        }
      : paramsOrId

  const store = rawParams.store || activeStore
  const appointmentId = rawParams.appointmentId
  const reason = rawParams.reason || 'APPOINTMENT_CANCELLED'
  if (!appointmentId) return { cancelledJobs: 0, notificationSent: false }

  try {
    const cancelledCount = await cancelPendingAppointmentJobs(appointmentId, reason, undefined, { store })
    const suppressNotice =
      rawParams.shouldSendCancellationNotice === false ||
      reason === 'COMPLETED' ||
      reason === 'NO_SHOW' ||
      reason === 'TRANSITION_COMPLETE' ||
      reason === 'TRANSITION_NO_SHOW'

    const apptDoc =
      !suppressNotice && (!rawParams.clinicId || !rawParams.patientPhone)
        ? await store.readDoc(`appointments/${appointmentId}`).catch(() => null)
        : null

    const clinicId = rawParams.clinicId || String(apptDoc?.clinic_id || apptDoc?.clinicId || '')
    const patientPhone = rawParams.patientPhone || String(apptDoc?.phone || '')
    const consentCtx = {
      whatsappConsent: rawParams.whatsappConsent ?? Boolean(apptDoc?.whatsappConsent),
      whatsappConsentPreferences: rawParams.whatsappConsentPreferences || apptDoc?.whatsappConsentPreferences,
    }

    if (suppressNotice || !clinicId || !patientPhone || !hasWhatsAppConsent(consentCtx, 'appointment_cancelled')) {
      return { cancelledJobs: cancelledCount, notificationSent: false }
    }

    const { clinicDoc, waConfig, policy } = await resolveClinicAndPolicy(clinicId, rawParams.clinicDoc, undefined, store)
    const cancelPolicy = policy.features.reschedule_cancel
    if (!policy.sectionVisible || !policy.serviceEnabled || !cancelPolicy.autoSend) {
      return { cancelledJobs: cancelledCount, notificationSent: false }
    }
    if (waConfig?.settings.sendCancelledNotification === false) {
      return { cancelledJobs: cancelledCount, notificationSent: false }
    }

    const clinicSlug = rawParams.clinicSlug || String(clinicDoc?.slug || '')
    const clinicName = rawParams.clinicName || String(clinicDoc?.clinicName || clinicDoc?.name || 'العيادة')
    const doctorName = rawParams.doctorName || String(clinicDoc?.doctorName || '')
    const branchName = rawParams.branchName || String(apptDoc?.branchName || '')
    const patientName = rawParams.patientName || String(apptDoc?.patientName || 'المريض')
    const appointmentDate = rawParams.appointmentDate || String(apptDoc?.date || '')
    const appointmentTime = rawParams.appointmentTime || String(apptDoc?.whatsappReminderTime || apptDoc?.time || '')
    const hasFixedTime = Boolean(rawParams.hasFixedTime ?? apptDoc?.whatsappHasFixedTime)

    const nowIso = new Date().toISOString()
    const cancelId = `can_${sanitizeIdPart(appointmentId)}`
    const acquired = await store.createUniqueDoc('whatsapp_dedup', { jobId: cancelId, createdAt: nowIso }, cancelId)
    if (!acquired) return { cancelledJobs: cancelledCount, notificationSent: false }

    await store.writeDoc(`whatsapp_jobs/${cancelId}`, {
      id: cancelId,
      clinicId,
      clinicSlug,
      appointmentId,
      patientName,
      patientPhone,
      jobType: 'appointment_cancelled',
      scheduledAt: nowIso,
      originalScheduledAt: nowIso,
      status: 'queued',
      clinicName,
      doctorName,
      branchName,
      appointmentDate,
      appointmentTime,
      hasFixedTime,
      cancelledReason: reason,
      idempotencyKey: cancelId,
      attempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    } satisfies WhatsAppJob)

    const execRes = await executeWhatsAppJob(cancelId, waConfig, { store, fetchImpl: rawParams.fetchImpl, clinicDoc: clinicDoc || rawParams.clinicDoc })
    return { cancelledJobs: cancelledCount, notificationSent: execRes.outcome === 'sent', outcome: execRes.outcome }
  } catch (err) {
    console.error('[WhatsApp Scheduler] Cancellation handling failed:', err)
    return { cancelledJobs: 0, notificationSent: false }
  }
}

export interface EnqueueDocumentParams {
  clinicId: string
  clinicSlug?: string
  clinicName: string
  doctorName?: string
  branchName?: string
  type: 'prescription' | 'invoice'
  documentId: string
  documentRootKey?: string
  appointmentId?: string
  version?: number
  contentHash: string
  documentUrl: string
  patientName: string
  patientPhone: string
  appointmentDate?: string
  appointmentTime?: string
  consentRecord?: any
  clinicDoc?: any
  waConfig?: ClinicWhatsAppConfig | null
  store?: WhatsAppQueueStore
  fetchImpl?: typeof fetch
}

export interface EnqueueDocumentResult {
  enqueued: boolean
  status: 'sent' | 'waiting_for_connection' | 'queued' | 'manual_only' | 'blocked_by_policy' | 'skipped_consent' | 'deduplicated' | 'failed' | 'uncertain'
  jobId?: string
  reason?: string
}

/**
 * Trusted server-side enqueuer for automated Prescription & Invoice WhatsApp delivery.
 * Enforces Owner policy, consent, edit/version rules, and content-hash deduplication.
 */
export async function enqueueDocumentWhatsAppJob(params: EnqueueDocumentParams): Promise<EnqueueDocumentResult> {
  const store = params.store || activeStore
  const { clinicId, type, documentId, contentHash, documentUrl, patientName, patientPhone } = params
  const jobType: WhatsAppJobType = type === 'prescription' ? 'prescription_ready' : 'invoice_ready'
  const rootKey = sanitizeIdPart(params.documentRootKey || params.appointmentId || documentId)

  const { waConfig, policy } = await resolveClinicAndPolicy(clinicId, params.clinicDoc, params.waConfig, store)
  const feat = policy.features[type]
  if (!policy.sectionVisible || !feat.visible || !feat.enabled || !policy.serviceEnabled) {
    return { enqueued: false, status: 'blocked_by_policy', reason: 'WHATSAPP_DOCUMENT_FEATURE_DISABLED' }
  }
  if (!feat.autoSend) {
    return { enqueued: false, status: 'manual_only', reason: 'AUTO_SEND_OFF' }
  }

  const consentSource =
    params.consentRecord ||
    (params.appointmentId ? await store.readDoc(`appointments/${params.appointmentId}`).catch(() => null) : null) ||
    { whatsappConsent: true }
  if (!hasWhatsAppConsent(consentSource, jobType)) {
    return { enqueued: false, status: 'skipped_consent', reason: 'PATIENT_OPTED_OUT_DOCUMENTS' }
  }

  if (!patientPhone || !documentUrl) {
    return { enqueued: false, status: 'failed', reason: 'DATA_INCOMPLETE' }
  }

  const editPolicy = type === 'prescription' ? policy.prescriptionResendOnEdit : policy.invoiceResendOnEdit
  const nowIso = new Date().toISOString()

  // Lock key prevents duplicate sends across repeated clicks / parallel saves:
  // - editPolicy === 'none': strictly 1 send ever per documentRootKey
  // - editPolicy === 'new_version': deduplicates identical contentHash, allows true content change as new version
  const dedupKey =
    editPolicy === 'none'
      ? `doc_${type}_${sanitizeIdPart(clinicId)}_${rootKey}`
      : `doc_${type}_${sanitizeIdPart(clinicId)}_${rootKey}_h_${sanitizeIdPart(contentHash)}`

  const acquired = await store.createUniqueDoc(
    'whatsapp_dedup',
    { type, clinicId, documentId, documentRootKey: rootKey, contentHash, editPolicy, createdAt: nowIso },
    dedupKey,
  )
  if (!acquired) {
    return { enqueued: false, status: 'deduplicated', reason: 'DUPLICATE_VERSION_OR_HASH' }
  }

  // Cancel any stale unsent versions of this document root before queueing new version
  const existingSiblings = await store.queryByField('whatsapp_jobs', 'documentRootKey', rootKey, 30).catch(() => [])
  const maxExistingVer = existingSiblings.reduce((mx, s) => Math.max(mx, Number(s.documentVersion || 0)), 0)
  const nextVersion = Math.max(Number(params.version || 0), maxExistingVer + 1)
  for (const s of existingSiblings) {
    if (['pending', 'queued', 'waiting_for_connection'].includes(s.status)) {
      await store.writeDoc(`whatsapp_jobs/${s.id}`, { status: 'cancelled', cancelledReason: 'SUPERSEDED_BY_NEW_VERSION', updatedAt: nowIso }, true)
    }
  }

  const jobId = `doc_${type}_${sanitizeIdPart(clinicId)}_${rootKey}_v${nextVersion}_${sanitizeIdPart(contentHash.slice(0, 8))}`
  const job: WhatsAppJob = {
    id: jobId,
    clinicId,
    clinicSlug: params.clinicSlug,
    appointmentId: params.appointmentId || '',
    patientName,
    patientPhone,
    jobType,
    scheduledAt: nowIso,
    originalScheduledAt: nowIso,
    status: 'queued',
    clinicName: params.clinicName,
    doctorName: params.doctorName,
    branchName: params.branchName,
    appointmentDate: params.appointmentDate || nowIso.slice(0, 10),
    appointmentTime: params.appointmentTime || '',
    hasFixedTime: Boolean(params.appointmentTime),
    documentId,
    documentRootKey: rootKey,
    documentType: type,
    documentVersion: nextVersion,
    contentHash,
    documentUrl,
    idempotencyKey: jobId,
    attempts: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  await store.writeDoc(`whatsapp_jobs/${jobId}`, job)
  const exec = await executeWhatsAppJob(jobId, waConfig, { store, fetchImpl: params.fetchImpl, clinicDoc: params.clinicDoc })
  return {
    enqueued: true,
    status:
      exec.outcome === 'sent'
        ? 'sent'
        : exec.outcome === 'waiting_for_connection'
        ? 'waiting_for_connection'
        : exec.outcome === 'uncertain'
        ? 'uncertain'
        : exec.outcome === 'failed'
        ? 'failed'
        : 'queued',
    jobId,
    reason: exec.reason,
  }
}

/**
 * Re-activate waiting jobs when a clinic reconnects WhatsApp; expire any whose time passed.
 */
export async function requeueWaitingJobsForClinic(
  clinicId: string,
  options?: { store?: WhatsAppQueueStore; drainImmediately?: boolean; fetchImpl?: typeof fetch },
): Promise<{ requeued: number; expired: number; sent: number }> {
  const store = options?.store || activeStore
  const jobs = await store.queryByFields(
    'whatsapp_jobs',
    [
      { field: 'clinicId', value: clinicId },
      { field: 'status', value: 'waiting_for_connection' },
    ],
    100,
  ).catch(() => [])

  const nowIso = new Date().toISOString()
  await store.writeDoc(
    `clinic_whatsapp_configs/${clinicId}`,
    { sessionStatus: 'connected', lastConnectedAt: nowIso, updatedAt: nowIso },
    true,
  ).catch(() => null)

  let requeued = 0
  let expired = 0
  let sent = 0
  for (const job of jobs) {
    if (job.expiresAt && job.expiresAt < nowIso) {
      await store.writeDoc(`whatsapp_jobs/${job.id}`, { status: 'expired', cancelledReason: 'EXPIRED_BEFORE_RECONNECT', updatedAt: nowIso }, true)
      expired++
      continue
    }
    await store.writeDoc(
      `whatsapp_jobs/${job.id}`,
      { status: 'queued', scheduledAt: nowIso, lastError: null, errorClass: null, updatedAt: nowIso },
      true,
    )
    requeued++
    if (options?.drainImmediately) {
      const res = await executeWhatsAppJob(job.id, undefined, { store, fetchImpl: options?.fetchImpl })
      if (res.outcome === 'sent') sent++
    }
  }
  return { requeued, expired, sent }
}

/**
 * Explicit manual retry triggered from Owner Dashboard.
 */
export async function retryWhatsAppJobById(
  jobId: string,
  actorUid: string,
  options?: { allowUncertainRetry?: boolean; store?: WhatsAppQueueStore; fetchImpl?: typeof fetch },
): Promise<DispatchJobOutcome> {
  const store = options?.store || activeStore
  const ver = await store.readVersionedDoc(`whatsapp_jobs/${jobId}`)
  if (!ver) return { outcome: 'skipped', reason: 'JOB_NOT_FOUND' }
  const job = ver.data as WhatsAppJob
  if (job.status === 'sent' || job.status === 'delivered' || job.status === 'cancelled' || job.status === 'expired') {
    return { outcome: 'skipped', status: job.status, reason: `CANNOT_RETRY_${job.status.toUpperCase()}` }
  }
  if (job.uncertainOutcome && !options?.allowUncertainRetry) {
    return { outcome: 'skipped', status: 'uncertain', reason: 'CONFIRM_UNCERTAIN_RETRY_REQUIRED' }
  }
  const nowIso = new Date().toISOString()
  await store.writeDoc(
    `whatsapp_jobs/${jobId}`,
    {
      status: 'queued',
      scheduledAt: nowIso,
      uncertainOutcome: false,
      lastError: null,
      errorClass: null,
      updatedAt: nowIso,
      retriedBy: actorUid,
      retriedAt: nowIso,
    },
    true,
  )
  return executeWhatsAppJob(jobId, undefined, { store, fetchImpl: options?.fetchImpl, allowExpiredBypass: false })
}

/**
 * Update job or clinic connectivity based on webhook event from WP Sender.
 */
export async function handleWpSenderWebhookEvent(
  payload: {
    event?: string
    status?: string
    messageId?: string
    sessionId?: string
    clinicId?: string
    timestamp?: string
    error?: string
  },
  options?: { store?: WhatsAppQueueStore; fetchImpl?: typeof fetch },
): Promise<{ updated: number; action: string }> {
  const store = options?.store || activeStore
  const nowIso = payload.timestamp || new Date().toISOString()
  const rawStatus = String(payload.status || payload.event || '').toLowerCase()

  if (payload.sessionId || payload.clinicId) {
    let targetClinicId = payload.clinicId ? String(payload.clinicId) : ''
    if (!targetClinicId && payload.sessionId) {
      const bySession = await store.queryByField('clinic_whatsapp_configs', 'sessionId', payload.sessionId, 1).catch(() => [])
      if (bySession[0]?.id) targetClinicId = String(bySession[0].id)
    }
    if (targetClinicId) {
      if (['disconnected', 'logged_out', 'session_disconnected', 'qr_required', 'closed'].includes(rawStatus)) {
        await store.writeDoc(
          `clinic_whatsapp_configs/${targetClinicId}`,
          { sessionStatus: 'disconnected', disconnectedAt: nowIso, updatedAt: nowIso },
          true,
        )
        return { updated: 1, action: 'session_disconnected' }
      }
      if (['connected', 'ready', 'authenticated', 'session_connected'].includes(rawStatus)) {
        const res = await requeueWaitingJobsForClinic(targetClinicId, { store, drainImmediately: true, fetchImpl: options?.fetchImpl })
        return { updated: res.requeued + 1, action: 'session_connected' }
      }
    }
  }

  if (payload.messageId) {
    const matching = await store.queryByField('whatsapp_jobs', 'providerMessageId', String(payload.messageId), 5).catch(() => [])
    let updated = 0
    for (const job of matching) {
      if (['delivered', 'read', 'played', 'ack_2', 'ack_3'].includes(rawStatus)) {
        await store.writeDoc(
          `whatsapp_jobs/${job.id}`,
          { status: 'delivered', providerStatus: 'delivered', deliveredAt: nowIso, updatedAt: nowIso },
          true,
        )
        updated++
      } else if (['sent', 'server', 'ack_1'].includes(rawStatus) && job.status !== 'delivered') {
        await store.writeDoc(
          `whatsapp_jobs/${job.id}`,
          { status: 'sent', providerStatus: 'sent', updatedAt: nowIso },
          true,
        )
        updated++
      } else if (['failed', 'error', 'undelivered'].includes(rawStatus) && job.status !== 'delivered') {
        await store.writeDoc(
          `whatsapp_jobs/${job.id}`,
          { status: 'failed', providerStatus: 'failed', lastError: payload.error || rawStatus, updatedAt: nowIso },
          true,
        )
        updated++
      }
    }
    return { updated, action: `message_${rawStatus}` }
  }

  return { updated: 0, action: 'ignored' }
}

/**
 * Drain due queued, legacy pending, and reconnected waiting jobs reliably via Worker Cron.
 */
export async function drainPendingWhatsAppJobs(
  maxBatch = 25,
  options?: { store?: WhatsAppQueueStore; fetchImpl?: typeof fetch; nowIso?: string },
) {
  const store = options?.store || activeStore
  const nowIso = options?.nowIso || new Date().toISOString()
  try {
    const dueJobs = await store.queryDueJobs(nowIso, ['queued', 'pending', 'waiting_for_connection'], maxBatch)
    if (dueJobs.length === 0) return { processed: 0, sent: 0, waiting: 0, failed: 0, expired: 0 }

    const sessionHealthCache = new Map<string, boolean>()
    const clinicCache = new Map<string, any>()
    let sent = 0
    let waiting = 0
    let failed = 0
    let expired = 0

    for (const job of dueJobs) {
      if (job.status === 'waiting_for_connection') {
        let healthy = sessionHealthCache.get(job.clinicId)
        if (healthy === undefined) {
          const cfg = await getClinicWhatsAppConfig(job.clinicId, store)
          const check = await checkWpSenderSessionHealth(job.clinicId, {
            fetchImpl: options?.fetchImpl,
            persistedStatus: cfg?.sessionStatus,
          })
          healthy = check.connected
          sessionHealthCache.set(job.clinicId, healthy)
          if (healthy && cfg?.sessionStatus === 'disconnected') {
            await store.writeDoc(
              `clinic_whatsapp_configs/${job.clinicId}`,
              { sessionStatus: 'connected', lastConnectedAt: nowIso, updatedAt: nowIso },
              true,
            ).catch(() => null)
          }
        }
        if (!healthy) {
          if (job.expiresAt && job.expiresAt < nowIso) {
            await store.writeDoc(`whatsapp_jobs/${job.id}`, { status: 'expired', cancelledReason: 'EXPIRED_WHILE_DISCONNECTED', updatedAt: nowIso }, true)
            expired++
          } else {
            await store.writeDoc(
              `whatsapp_jobs/${job.id}`,
              { scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(), updatedAt: nowIso },
              true,
            )
            waiting++
          }
          continue
        }
      }

      if (!clinicCache.has(job.clinicId)) {
        clinicCache.set(job.clinicId, await store.readDoc(`clinics/${job.clinicId}`).catch(() => null))
      }

      const res = await executeWhatsAppJob(job.id, undefined, {
        store,
        fetchImpl: options?.fetchImpl,
        clinicDoc: clinicCache.get(job.clinicId),
      })
      if (res.outcome === 'sent') sent++
      else if (res.outcome === 'waiting_for_connection') waiting++
      else if (res.outcome === 'expired') expired++
      else if (res.outcome === 'failed' || res.outcome === 'uncertain') failed++
    }
    return { processed: dueJobs.length, sent, waiting, failed, expired }
  } catch (err) {
    console.error('[WhatsApp Scheduler] Drain failed:', err)
    return { processed: 0, sent: 0, waiting: 0, failed: 0, expired: 0, error: String(err) }
  }
}
