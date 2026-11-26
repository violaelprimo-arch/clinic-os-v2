import { isOwnerSectionVisible, isOwnerTabVisible } from './clinicAccessPolicy'

export type WhatsAppSubFeatureKey =
  | 'booking_confirmation'
  | 'appointment_reminder'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'queue_alert'
  | 'prescription_ready'
  | 'invoice_ready'
  | 'reschedule_cancel'
  | 'prescription'
  | 'invoice'

export const PRIMARY_WHATSAPP_SUB_FEATURES = [
  'booking_confirmation',
  'appointment_reminder',
  'appointment_rescheduled',
  'appointment_cancelled',
  'queue_alert',
  'prescription_ready',
  'invoice_ready',
] as const

export const ALL_WHATSAPP_SUB_FEATURES: WhatsAppSubFeatureKey[] = [
  'booking_confirmation',
  'appointment_reminder',
  'appointment_rescheduled',
  'appointment_cancelled',
  'queue_alert',
  'prescription_ready',
  'invoice_ready',
  'reschedule_cancel',
  'prescription',
  'invoice',
]

export type WhatsAppSubFeatureMode = 'auto' | 'manual' | 'disabled'
export type WhatsAppEditPermission = 'read_only' | 'editable'
export type DocumentEditResendPolicy = 'none' | 'new_version'

export interface OwnerSubFeatureControl {
  /** Whether Doctor & Assistant can see UI/tabs/buttons/status for this feature */
  visible: boolean
  /** Whether the feature can execute at all (if false, UI actions & API requests are rejected) */
  enabled: boolean
  /** Sending strategy: automatic (via WP Sender queue), manual click-to-chat only, or disabled */
  mode: WhatsAppSubFeatureMode
  /** Whether Doctor & Assistant can edit this message template or it is locked read-only */
  editPermission?: WhatsAppEditPermission
}

export interface PlatformQuietHours {
  enabled: boolean
  startCairoHour: number // e.g. 23 (11 PM)
  endCairoHour: number   // e.g. 8 (8 AM)
}

export interface OwnerWhatsAppPolicyInput {
  /** Master Owner toggle to show/hide WhatsApp section & all sub-features for this clinic */
  sectionVisible?: boolean
  /** Master Owner toggle to enable/disable live WhatsApp messaging without deleting clinic templates/settings */
  serviceEnabled?: boolean
  /** Explicit Owner policy on editing an already-issued Prescription */
  prescriptionResendOnEdit?: DocumentEditResendPolicy
  /** Explicit Owner policy on editing an already-issued Invoice */
  invoiceResendOnEdit?: DocumentEditResendPolicy
  /** Per sub-feature master overrides */
  features?: Partial<Record<WhatsAppSubFeatureKey, Partial<OwnerSubFeatureControl>>>
}

export interface PlatformWhatsAppDefaults {
  sectionVisible: boolean
  serviceEnabled: boolean
  emergencyStop?: boolean
  quietHours?: PlatformQuietHours
  prescriptionResendOnEdit: DocumentEditResendPolicy
  invoiceResendOnEdit: DocumentEditResendPolicy
  features: Record<WhatsAppSubFeatureKey, OwnerSubFeatureControl>
}

export const DEFAULT_PLATFORM_WHATSAPP_DEFAULTS: PlatformWhatsAppDefaults = {
  sectionVisible: true,
  serviceEnabled: true,
  emergencyStop: false,
  quietHours: {
    enabled: false,
    startCairoHour: 23,
    endCairoHour: 8,
  },
  prescriptionResendOnEdit: 'none',
  invoiceResendOnEdit: 'none',
  features: {
    booking_confirmation: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
    appointment_reminder: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
    appointment_rescheduled: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
    appointment_cancelled: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
    queue_alert: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
    prescription_ready: { visible: true, enabled: true, mode: 'manual', editPermission: 'read_only' },
    invoice_ready: { visible: true, enabled: true, mode: 'manual', editPermission: 'read_only' },
    // Backwards-compatible aliases
    reschedule_cancel: { visible: true, enabled: true, mode: 'auto', editPermission: 'read_only' },
    prescription: { visible: true, enabled: true, mode: 'manual', editPermission: 'read_only' },
    invoice: { visible: true, enabled: true, mode: 'manual', editPermission: 'read_only' },
  },
}

export interface ResolvedSubFeaturePolicy {
  visible: boolean
  enabled: boolean
  mode: WhatsAppSubFeatureMode
  editPermission: WhatsAppEditPermission
  autoSend: boolean
  allowManualSend: boolean
  lockedByOwner: boolean
}

export interface EffectiveWhatsAppPolicy {
  /** Whether clinic staff can see the WhatsApp admin section/nav */
  sectionVisible: boolean
  /** Whether clinic messaging service is active (can send live/queued messages) */
  serviceEnabled: boolean
  /** Whether emergency stop kill switch is activated platform-wide */
  emergencyStop: boolean
  /** Quiet hours configuration for scheduled automated messaging */
  quietHours?: PlatformQuietHours
  /** Legacy compatibility boolean reflecting platform + clinic subscription automation */
  automationActive: boolean
  prescriptionResendOnEdit: DocumentEditResendPolicy
  invoiceResendOnEdit: DocumentEditResendPolicy
  features: Record<WhatsAppSubFeatureKey, ResolvedSubFeaturePolicy>
}

export interface ClinicWhatsAppSettingsLike {
  sendBookingConfirmation?: boolean
  sendAppointmentReminder?: boolean
  sendRescheduledNotification?: boolean
  sendCancelledNotification?: boolean
  sendPrescription?: boolean
  sendInvoice?: boolean
  reminders?: any[]
}

export interface ClinicWhatsAppConfigLike {
  mode?: 'off' | 'mock' | 'live' | string
  connected?: boolean
  enabled?: boolean
  settings?: ClinicWhatsAppSettingsLike
  ownerPolicy?: OwnerWhatsAppPolicyInput | null
}

function asMode(val: unknown, fallback: WhatsAppSubFeatureMode): WhatsAppSubFeatureMode {
  return val === 'auto' || val === 'manual' || val === 'disabled' ? val : fallback
}

function asEditPermission(val: unknown, fallback: WhatsAppEditPermission = 'read_only'): WhatsAppEditPermission {
  return val === 'editable' || val === 'read_only' ? val : fallback
}

function asResendPolicy(val: unknown, fallback: DocumentEditResendPolicy): DocumentEditResendPolicy {
  return val === 'new_version' || val === 'none' ? val : fallback
}

export function getNewClinicDefaultWhatsAppPolicy(): OwnerWhatsAppPolicyInput {
  const features: any = {}
  for (const key of ALL_WHATSAPP_SUB_FEATURES) {
    features[key] = { visible: false, enabled: false, mode: 'disabled', editPermission: 'read_only' }
  }
  return {
    sectionVisible: false,
    serviceEnabled: false,
    features,
  }
}

export function normalizePlatformWhatsAppDefaults(raw: unknown): PlatformWhatsAppDefaults {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<PlatformWhatsAppDefaults>
  const base = DEFAULT_PLATFORM_WHATSAPP_DEFAULTS
  const resolvedFeatures = {} as Record<WhatsAppSubFeatureKey, OwnerSubFeatureControl>

  for (const key of ALL_WHATSAPP_SUB_FEATURES) {
    const def = base.features[key]
    const ov = input.features?.[key]
    const visible = ov?.visible !== undefined ? Boolean(ov.visible) : def.visible
    const enabled = visible && (ov?.enabled !== undefined ? Boolean(ov.enabled) : def.enabled)
    const mode = enabled ? asMode(ov?.mode, def.mode) : 'disabled'
    const editPermission = asEditPermission(ov?.editPermission, def.editPermission || 'read_only')
    resolvedFeatures[key] = { visible, enabled: enabled && mode !== 'disabled', mode, editPermission }
  }

  // Cross-sync aliases in platform defaults
  if (input.features?.reschedule_cancel && (!input.features?.appointment_rescheduled || !input.features?.appointment_cancelled)) {
    const rc = resolvedFeatures.reschedule_cancel
    resolvedFeatures.appointment_rescheduled = { ...rc }
    resolvedFeatures.appointment_cancelled = { ...rc }
  }
  if (input.features?.prescription && !input.features?.prescription_ready) {
    resolvedFeatures.prescription_ready = { ...resolvedFeatures.prescription }
  }
  if (input.features?.invoice && !input.features?.invoice_ready) {
    resolvedFeatures.invoice_ready = { ...resolvedFeatures.invoice }
  }

  return {
    sectionVisible: input.sectionVisible !== undefined ? Boolean(input.sectionVisible) : base.sectionVisible,
    serviceEnabled: input.serviceEnabled !== undefined ? Boolean(input.serviceEnabled) : base.serviceEnabled,
    emergencyStop: Boolean(input.emergencyStop),
    quietHours: input.quietHours || base.quietHours,
    prescriptionResendOnEdit: asResendPolicy(input.prescriptionResendOnEdit, base.prescriptionResendOnEdit),
    invoiceResendOnEdit: asResendPolicy(input.invoiceResendOnEdit, base.invoiceResendOnEdit),
    features: resolvedFeatures,
  }
}

export function normalizeOwnerPolicyInput(
  raw: unknown,
  platformDefaults: PlatformWhatsAppDefaults = DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
): OwnerWhatsAppPolicyInput {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<OwnerWhatsAppPolicyInput>
  const outFeatures: Partial<Record<WhatsAppSubFeatureKey, OwnerSubFeatureControl>> = {}
  if (input.features && typeof input.features === 'object') {
    for (const key of ALL_WHATSAPP_SUB_FEATURES) {
      const ov = input.features[key]
      if (!ov || typeof ov !== 'object') continue
      const def = platformDefaults.features[key]
      const visible = ov.visible !== undefined ? Boolean(ov.visible) : def.visible
      const enabled = visible && (ov.enabled !== undefined ? Boolean(ov.enabled) : def.enabled)
      const mode = enabled ? asMode(ov.mode, def.mode) : 'disabled'
      const editPermission = asEditPermission(ov.editPermission, def.editPermission || 'read_only')
      outFeatures[key] = { visible, enabled: enabled && mode !== 'disabled', mode, editPermission }
    }
  }

  // Cross-sync aliases in clinic overrides
  if (outFeatures.reschedule_cancel && (!outFeatures.appointment_rescheduled || !outFeatures.appointment_cancelled)) {
    outFeatures.appointment_rescheduled = { ...outFeatures.reschedule_cancel }
    outFeatures.appointment_cancelled = { ...outFeatures.reschedule_cancel }
  }
  if (outFeatures.prescription && !outFeatures.prescription_ready) {
    outFeatures.prescription_ready = { ...outFeatures.prescription }
  }
  if (outFeatures.invoice && !outFeatures.invoice_ready) {
    outFeatures.invoice_ready = { ...outFeatures.invoice }
  }

  return {
    ...(input.sectionVisible !== undefined ? { sectionVisible: Boolean(input.sectionVisible) } : {}),
    ...(input.serviceEnabled !== undefined ? { serviceEnabled: Boolean(input.serviceEnabled) } : {}),
    ...(input.prescriptionResendOnEdit !== undefined
      ? { prescriptionResendOnEdit: asResendPolicy(input.prescriptionResendOnEdit, platformDefaults.prescriptionResendOnEdit) }
      : {}),
    ...(input.invoiceResendOnEdit !== undefined
      ? { invoiceResendOnEdit: asResendPolicy(input.invoiceResendOnEdit, platformDefaults.invoiceResendOnEdit) }
      : {}),
    ...(Object.keys(outFeatures).length > 0 ? { features: outFeatures } : {}),
  }
}

/**
 * Single source of truth for effective clinic WhatsApp capabilities.
 * Precedence:
 * 1. Platform-level Owner defaults (including Global Emergency Stop)
 * 2. Clinic-level Owner access policy (`hiddenTabs`, `hiddenSections`, `whatsappPolicy` on clinic, `ownerPolicy` on config)
 * 3. Clinic service switch (`serviceEnabled` + clinic `whatsappAutomationEnabled`)
 * 4. Clinic-level operational preferences (`settings.sendBookingConfirmation`, `sendPrescription`, etc.)
 *
 * Owner restrictions always override clinic/doctor/assistant settings.
 */
export function resolveEffectiveWhatsAppPolicy(params: {
  platformDefaults?: PlatformWhatsAppDefaults | OwnerWhatsAppPolicyInput | null
  clinic?: Record<string, any> | null
  waConfig?: ClinicWhatsAppConfigLike | null
}): EffectiveWhatsAppPolicy {
  const platform = normalizePlatformWhatsAppDefaults(params.platformDefaults)
  const clinic = params.clinic || null
  const waConfig = params.waConfig || null

  const clinicPolicy: OwnerWhatsAppPolicyInput = {
    ...((waConfig?.ownerPolicy && typeof waConfig.ownerPolicy === 'object' ? waConfig.ownerPolicy : {}) as OwnerWhatsAppPolicyInput),
    ...((clinic?.whatsappPolicy && typeof clinic.whatsappPolicy === 'object' ? clinic.whatsappPolicy : {}) as OwnerWhatsAppPolicyInput),
  }

  const tabVisible = clinic ? isOwnerTabVisible(clinic, 'whatsapp') : true
  const rootSectionVisible = clinic ? isOwnerSectionVisible(clinic, 'whatsapp') : true

  const sectionVisible = Boolean(
    platform.sectionVisible &&
      (clinicPolicy.sectionVisible ?? true) &&
      tabVisible &&
      rootSectionVisible,
  )

  const isEmergencyStopped = platform.emergencyStop === true

  const serviceEnabled = Boolean(
    !isEmergencyStopped &&
      sectionVisible &&
      platform.serviceEnabled &&
      (clinicPolicy.serviceEnabled ?? true),
  )

  const automationActive = Boolean(
    serviceEnabled &&
      (clinic?.whatsappAutomationEnabled === true || waConfig?.enabled === true),
  )

  const prescriptionResendOnEdit = asResendPolicy(
    clinicPolicy.prescriptionResendOnEdit,
    platform.prescriptionResendOnEdit,
  )
  const invoiceResendOnEdit = asResendPolicy(
    clinicPolicy.invoiceResendOnEdit,
    platform.invoiceResendOnEdit,
  )

  const settings = waConfig?.settings
  const features = {} as Record<WhatsAppSubFeatureKey, ResolvedSubFeaturePolicy>

  for (const key of ALL_WHATSAPP_SUB_FEATURES) {
    const pFeat = platform.features[key]
    const cFeat = clinicPolicy.features?.[key]
    const clinicAccessSectionVisible = clinic ? isOwnerSectionVisible(clinic, `whatsapp.${key}`) : true

    const ownerVisible = Boolean(
      sectionVisible &&
        pFeat.visible &&
        (cFeat?.visible ?? true) &&
        clinicAccessSectionVisible,
    )
    const ownerEnabled = Boolean(
      !isEmergencyStopped &&
        ownerVisible &&
        pFeat.enabled &&
        (cFeat?.enabled ?? true),
    )

    // Determine effective mode from owner override -> platform default
    let ownerMode: WhatsAppSubFeatureMode = ownerEnabled
      ? asMode(cFeat?.mode, pFeat.mode)
      : 'disabled'
    if (ownerMode === 'disabled') {
      // keep disabled
    } else if (!ownerEnabled) {
      ownerMode = 'disabled'
    }

    const editPermission: WhatsAppEditPermission = asEditPermission(
      cFeat?.editPermission,
      pFeat?.editPermission || 'read_only',
    )

    // Apply clinic doctor preferences inside owner-permitted bounds (cannot elevate above ownerMode)
    let effectiveMode: WhatsAppSubFeatureMode = ownerMode
    if (ownerMode !== 'disabled' && settings) {
      if (key === 'booking_confirmation' && settings.sendBookingConfirmation === false) {
        effectiveMode = 'disabled'
      } else if (key === 'appointment_reminder' && settings.sendAppointmentReminder === false) {
        effectiveMode = 'disabled'
      } else if (
        (key === 'reschedule_cancel' || key === 'appointment_rescheduled' || key === 'appointment_cancelled') &&
        settings.sendRescheduledNotification === false &&
        settings.sendCancelledNotification === false
      ) {
        effectiveMode = 'disabled'
      } else if (key === 'prescription' || key === 'prescription_ready') {
        if (settings.sendPrescription === false && ownerMode === 'auto') {
          effectiveMode = 'disabled'
        } else if (settings.sendPrescription === true && ownerMode === 'auto') {
          effectiveMode = 'auto'
        }
      } else if (key === 'invoice' || key === 'invoice_ready') {
        if (settings.sendInvoice === false && ownerMode === 'auto') {
          effectiveMode = 'disabled'
        } else if (settings.sendInvoice === true && ownerMode === 'auto') {
          effectiveMode = 'auto'
        }
      }
    }

    const autoSend = Boolean(
      serviceEnabled &&
        effectiveMode === 'auto' &&
        (key === 'prescription' || key === 'prescription_ready' || key === 'invoice' || key === 'invoice_ready' || key === 'queue_alert' || automationActive || waConfig?.mode === 'live' || waConfig?.mode === 'mock'),
    )
    const allowManualSend = Boolean(
      ownerVisible &&
        ownerEnabled &&
        effectiveMode === 'manual' &&
        serviceEnabled,
    )

    features[key] = {
      visible: ownerVisible,
      enabled: ownerVisible && ownerEnabled && effectiveMode !== 'disabled',
      mode: ownerVisible && ownerEnabled ? effectiveMode : 'disabled',
      editPermission,
      autoSend,
      allowManualSend,
      lockedByOwner: !ownerVisible || !ownerEnabled || ownerMode === 'disabled',
    }
  }

  return {
    sectionVisible,
    serviceEnabled,
    emergencyStop: isEmergencyStopped,
    quietHours: platform.quietHours,
    automationActive,
    prescriptionResendOnEdit,
    invoiceResendOnEdit,
    features,
  }
}

export function canStaffUseWhatsAppFeature(
  policy: EffectiveWhatsAppPolicy | null | undefined,
  feature: WhatsAppSubFeatureKey,
): boolean {
  if (!policy || !policy.sectionVisible) return false
  const f = policy.features[feature]
  return Boolean(f && f.visible && f.enabled)
}

export const WHATSAPP_SUB_FEATURE_LABELS: Record<WhatsAppSubFeatureKey, { titleAr: string; descAr: string }> = {
  booking_confirmation: {
    titleAr: 'تأكيد الحجز',
    descAr: 'إرسال تأكيد فوري فور إنشاء الحجز عبر الإنترنت أو من العيادة.',
  },
  appointment_reminder: {
    titleAr: 'تذكير الموعد',
    descAr: 'إرسال تذكيرات مجدولة قبل موعد الكشف بوقت كافٍ.',
  },
  appointment_rescheduled: {
    titleAr: 'تعديل الموعد',
    descAr: 'إشعار المريض عند تغيير موعد الزيارة وجدولة تذكيرات الموعد الجديد.',
  },
  appointment_cancelled: {
    titleAr: 'إلغاء الحجز',
    descAr: 'إشعار المريض فور إلغاء الحجز وإلغاء أي تذكيرات سابقة مرتبطة به.',
  },
  queue_alert: {
    titleAr: 'اقتراب الدور في الطابور',
    descAr: 'تنبيه المريض باقتراب دوره للدخول إلى غرفة الكشف.',
  },
  prescription_ready: {
    titleAr: 'الروشتة الطبية',
    descAr: 'إرسال رابط الروشتة الآمن لعرضها وتحميلها بصيغة PDF أو طباعتها.',
  },
  invoice_ready: {
    titleAr: 'الفاتورة والإيصال',
    descAr: 'إرسال رابط الفاتورة الرسمي للتحميل والطباعة ومراجعة الحسابات.',
  },
  // Backwards-compatible aliases
  reschedule_cancel: {
    titleAr: 'تعديل وإلغاء الحجز',
    descAr: 'إشعار المريض عند تغيير الموعد أو إلغائه وإيقاف التذكيرات القديمة.',
  },
  prescription: {
    titleAr: 'الروشتة الطبية',
    descAr: 'التحكم في إخفاء الميزة أو الإرسال التلقائي أو مشاركة الروشتة يدويًا.',
  },
  invoice: {
    titleAr: 'الفاتورة والإيصال',
    descAr: 'التحكم في إخفاء الميزة أو الإرسال التلقائي أو مشاركة الفاتورة يدويًا.',
  },
}
