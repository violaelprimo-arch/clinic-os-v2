import { isOwnerSectionVisible, isOwnerTabVisible } from './clinicAccessPolicy'

export type WhatsAppSubFeatureKey =
  | 'booking_confirmation'
  | 'appointment_reminder'
  | 'reschedule_cancel'
  | 'prescription'
  | 'invoice'

export const ALL_WHATSAPP_SUB_FEATURES: WhatsAppSubFeatureKey[] = [
  'booking_confirmation',
  'appointment_reminder',
  'reschedule_cancel',
  'prescription',
  'invoice',
]

export type WhatsAppSubFeatureMode = 'auto' | 'manual' | 'disabled'
export type DocumentEditResendPolicy = 'none' | 'new_version'

export interface OwnerSubFeatureControl {
  /** Whether Doctor & Assistant can see UI/tabs/buttons/status for this feature */
  visible: boolean
  /** Whether the feature can execute at all (if false, UI actions & API requests are rejected) */
  enabled: boolean
  /** Sending strategy: automatic (via WP Sender queue), manual click-to-chat only, or disabled */
  mode: WhatsAppSubFeatureMode
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
  prescriptionResendOnEdit: DocumentEditResendPolicy
  invoiceResendOnEdit: DocumentEditResendPolicy
  features: Record<WhatsAppSubFeatureKey, OwnerSubFeatureControl>
}

export const DEFAULT_PLATFORM_WHATSAPP_DEFAULTS: PlatformWhatsAppDefaults = {
  sectionVisible: true,
  serviceEnabled: true,
  prescriptionResendOnEdit: 'none',
  invoiceResendOnEdit: 'none',
  features: {
    booking_confirmation: { visible: true, enabled: true, mode: 'auto' },
    appointment_reminder: { visible: true, enabled: true, mode: 'auto' },
    reschedule_cancel: { visible: true, enabled: true, mode: 'auto' },
    prescription: { visible: true, enabled: true, mode: 'manual' },
    invoice: { visible: true, enabled: true, mode: 'manual' },
  },
}

export interface ResolvedSubFeaturePolicy {
  visible: boolean
  enabled: boolean
  mode: WhatsAppSubFeatureMode
  autoSend: boolean
  allowManualSend: boolean
  lockedByOwner: boolean
}

export interface EffectiveWhatsAppPolicy {
  /** Whether clinic staff can see the WhatsApp admin section/nav */
  sectionVisible: boolean
  /** Whether clinic messaging service is active (can send live/queued messages) */
  serviceEnabled: boolean
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

function asResendPolicy(val: unknown, fallback: DocumentEditResendPolicy): DocumentEditResendPolicy {
  return val === 'new_version' || val === 'none' ? val : fallback
}

export function normalizePlatformWhatsAppDefaults(raw: unknown): PlatformWhatsAppDefaults {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<OwnerWhatsAppPolicyInput>
  const base = DEFAULT_PLATFORM_WHATSAPP_DEFAULTS
  const resolvedFeatures = {} as Record<WhatsAppSubFeatureKey, OwnerSubFeatureControl>

  for (const key of ALL_WHATSAPP_SUB_FEATURES) {
    const def = base.features[key]
    const ov = input.features?.[key]
    const visible = ov?.visible !== undefined ? Boolean(ov.visible) : def.visible
    const enabled = visible && (ov?.enabled !== undefined ? Boolean(ov.enabled) : def.enabled)
    const mode = enabled ? asMode(ov?.mode, def.mode) : 'disabled'
    resolvedFeatures[key] = { visible, enabled: enabled && mode !== 'disabled', mode }
  }

  return {
    sectionVisible: input.sectionVisible !== undefined ? Boolean(input.sectionVisible) : base.sectionVisible,
    serviceEnabled: input.serviceEnabled !== undefined ? Boolean(input.serviceEnabled) : base.serviceEnabled,
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
      outFeatures[key] = { visible, enabled: enabled && mode !== 'disabled', mode }
    }
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
 * 1. Platform-level Owner defaults
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

  const serviceEnabled = Boolean(
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

    // Apply clinic doctor preferences inside owner-permitted bounds (cannot elevate above ownerMode)
    let effectiveMode: WhatsAppSubFeatureMode = ownerMode
    if (ownerMode !== 'disabled' && settings) {
      if (key === 'booking_confirmation' && settings.sendBookingConfirmation === false) {
        effectiveMode = 'disabled'
      } else if (key === 'appointment_reminder' && settings.sendAppointmentReminder === false) {
        effectiveMode = 'disabled'
      } else if (
        key === 'reschedule_cancel' &&
        settings.sendRescheduledNotification === false &&
        settings.sendCancelledNotification === false
      ) {
        effectiveMode = 'disabled'
      } else if (key === 'prescription') {
        if (settings.sendPrescription === false && ownerMode === 'auto') {
          // Doctor turned off auto prescription if owner didn't force manual-only
          effectiveMode = 'disabled'
        } else if (settings.sendPrescription === true && ownerMode === 'auto') {
          effectiveMode = 'auto'
        }
      } else if (key === 'invoice') {
        if (settings.sendInvoice === false && ownerMode === 'auto') {
          effectiveMode = 'disabled'
        } else if (settings.sendInvoice === true && ownerMode === 'auto') {
          effectiveMode = 'auto'
        }
      }
    }

    // Wait: if Owner explicitly hid service (`!serviceEnabled`), automatic delivery cannot run,
    // while manual click-to-chat can only run if mode === 'manual' AND ownerEnabled.
    // Wait: if Owner toggled `serviceEnabled === false` ("تعطيل الخدمة دون حذف النصوص والإعدادات"),
    // automated messaging stops cleanly across the board, while UI can indicate paused service.
    const autoSend = Boolean(
      serviceEnabled &&
        effectiveMode === 'auto' &&
        (key === 'prescription' || key === 'invoice' || automationActive || waConfig?.mode === 'live' || waConfig?.mode === 'mock'),
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
      autoSend,
      allowManualSend,
      lockedByOwner: !ownerVisible || !ownerEnabled || ownerMode === 'disabled',
    }
  }

  return {
    sectionVisible,
    serviceEnabled,
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
    titleAr: 'تأكيد الحجز التلقائي',
    descAr: 'إرسال تأكيد فور إنشاء الحجز عبر الإنترنت أو من العيادة.',
  },
  appointment_reminder: {
    titleAr: 'تذكيرات المواعيد',
    descAr: 'إرسال تذكيرات مجدولة قبل موعد الكشف.',
  },
  reschedule_cancel: {
    titleAr: 'تعديل وإلغاء الحجز',
    descAr: 'إشعار المريض عند تغيير الموعد أو إلغائه وإيقاف التذكيرات القديمة.',
  },
  prescription: {
    titleAr: 'مشاركة وإرسال الروشتة',
    descAr: 'التحكم في إخفاء الميزة أو الإرسال التلقائي أو مشاركة الروشتة يدويًا.',
  },
  invoice: {
    titleAr: 'مشاركة وإرسال الفاتورة',
    descAr: 'التحكم في إخفاء الميزة أو الإرسال التلقائي أو مشاركة الفاتورة يدويًا.',
  },
}
