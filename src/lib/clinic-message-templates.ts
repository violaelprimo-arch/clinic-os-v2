export type WhatsAppTemplateKey =
  | 'booking_confirmation'
  | 'appointment_reminder'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'prescription'
  | 'invoice'

export const WHATSAPP_TEMPLATE_KEYS: WhatsAppTemplateKey[] = [
  'booking_confirmation',
  'appointment_reminder',
  'appointment_rescheduled',
  'appointment_cancelled',
  'prescription',
  'invoice',
]

export const MAX_TEMPLATE_LENGTH = 1000
export const MIN_TEMPLATE_LENGTH = 5

export interface TemplateVariableDef {
  token: string
  key: 'patientName' | 'clinicName' | 'when' | 'doctorName' | 'branchName' | 'link'
  labelAr: string
  descriptionAr: string
  sampleValue: string
}

export const TEMPLATE_VARIABLE_DEFS: TemplateVariableDef[] = [
  {
    token: '{اسم_المريض}',
    key: 'patientName',
    labelAr: 'اسم المريض',
    descriptionAr: 'يُستبدل تلقائيًا باسم المريض المسجل بالحجز',
    sampleValue: 'أحمد محمود',
  },
  {
    token: '{اسم_العيادة}',
    key: 'clinicName',
    labelAr: 'اسم العيادة',
    descriptionAr: 'اسم العيادة كما يظهر للمرضى',
    sampleValue: 'عيادة النور التخصصية',
  },
  {
    token: '{الموعد}',
    key: 'when',
    labelAr: 'الموعد',
    descriptionAr: 'تاريخ ووقت الكشف (أو التاريخ فقط إذا لم يكن هناك وقت محدد)',
    sampleValue: 'الأحد 3 مايو، الساعة 07:30 م',
  },
  {
    token: '{اسم_الدكتور}',
    key: 'doctorName',
    labelAr: 'اسم الدكتور',
    descriptionAr: 'اسم الطبيب المعالج بالعيادة',
    sampleValue: 'د. كريم عبد الله',
  },
  {
    token: '{اسم_الفرع}',
    key: 'branchName',
    labelAr: 'اسم الفرع',
    descriptionAr: 'الفرع المحجوز به الموعد',
    sampleValue: 'فرع مدينة نصر',
  },
  {
    token: '{الرابط}',
    key: 'link',
    labelAr: 'الرابط الآمن',
    descriptionAr: 'رابط الروشتة أو الفاتورة أو صفحة متابعة الحجز',
    sampleValue: 'https://yalla-clinic.com/clinic/clinic-demo/track/sample',
  },
]

export const ALLOWED_TEMPLATE_TOKENS = new Set(TEMPLATE_VARIABLE_DEFS.map((v) => v.token))

export interface TemplateCatalogItem {
  key: WhatsAppTemplateKey
  titleAr: string
  subtitleAr: string
  categoryAr: string
  recommendedVars: string[]
  requiresWhen?: boolean
  requiresLink?: boolean
  privacyNoteAr?: string
}

export const TEMPLATE_CATALOG: Record<WhatsAppTemplateKey, TemplateCatalogItem> = {
  booking_confirmation: {
    key: 'booking_confirmation',
    titleAr: 'تأكيد الحجز',
    subtitleAr: 'يُرسل تلقائيًا فور تسجيل حجز جديد بعد التأكد من عدم تكراره.',
    categoryAr: 'الحجوزات',
    recommendedVars: ['{اسم_المريض}', '{اسم_العيادة}', '{اسم_الدكتور}', '{اسم_الفرع}', '{الموعد}'],
    requiresWhen: true,
  },
  appointment_reminder: {
    key: 'appointment_reminder',
    titleAr: 'تذكير بالموعد',
    subtitleAr: 'يُرسل قبل موعد الكشف حسب أوقات التذكير المضبوطة للعيادة.',
    categoryAr: 'الحجوزات',
    recommendedVars: ['{اسم_المريض}', '{اسم_العيادة}', '{اسم_الفرع}', '{الموعد}'],
    requiresWhen: true,
    privacyNoteAr: 'لا يحتوي التذكير على أي تشخيص أو تفاصيل طبية حفاظًا على خصوصية المريض.',
  },
  appointment_rescheduled: {
    key: 'appointment_rescheduled',
    titleAr: 'تعديل الموعد',
    subtitleAr: 'يُرسل عند تغيير يوم أو وقت الحجز بعد إلغاء التذكيرات القديمة.',
    categoryAr: 'الحجوزات',
    recommendedVars: ['{اسم_المريض}', '{اسم_العيادة}', '{اسم_الفرع}', '{الموعد}'],
    requiresWhen: true,
  },
  appointment_cancelled: {
    key: 'appointment_cancelled',
    titleAr: 'إلغاء الحجز',
    subtitleAr: 'يُرسل عند إلغاء الموعد وإيقاف أي تذكيرات لاحقة لنفس الحجز.',
    categoryAr: 'الحجوزات',
    recommendedVars: ['{اسم_المريض}', '{اسم_العيادة}', '{الموعد}'],
    requiresWhen: true,
  },
  prescription: {
    key: 'prescription',
    titleAr: 'الروشتة الطبية',
    subtitleAr: 'رسالة مشاركة رابط الروشتة الآمن بدون كشف أسماء الأدوية أو التشخيص داخل واتساب.',
    categoryAr: 'المستندات الطبية',
    recommendedVars: ['{اسم_المريض}', '{اسم_العيادة}', '{اسم_الدكتور}', '{الرابط}'],
    requiresLink: true,
    privacyNoteAr: 'حفاظًا على سرية المريض، يُرسل رابط الروشتة الآمن فقط بدون ذكر الأدوية أو التشخيص.',
  },
  invoice: {
    key: 'invoice',
    titleAr: 'الفاتورة والإيصال',
    subtitleAr: 'رسالة إرسال الفاتورة الرسمية ورابط التحميل للمريض.',
    categoryAr: 'المالية والفواتير',
    recommendedVars: ['{اسم_المريض}', '{اسم_العيادة}', '{اسم_الفرع}', '{الرابط}'],
    requiresLink: true,
  },
}

export const messageDefaults: Record<WhatsAppTemplateKey, string> = {
  booking_confirmation:
    'أهلًا *{اسم_المريض}* 👋\nتم تأكيد حجزك في *{اسم_العيادة}*.\n• الطبيب: {اسم_الدكتور}\n• الفرع: {اسم_الفرع}\n• الموعد: {الموعد}\n\nنتشرف بزيارتكم، ونتمنى لكم دوام الصحة.',
  appointment_reminder:
    'مرحبًا *{اسم_المريض}* ⏰\nنذكّرك بموعدك القادم في *{اسم_العيادة}*.\n• الطبيب: {اسم_الدكتور}\n• الفرع: {اسم_الفرع}\n• الموعد: {الموعد}\n\nيسعدنا استقبالكم في الموعد المحدد.',
  appointment_rescheduled:
    'أهلًا *{اسم_المريض}* 📅\nتم تعديل موعد زيارتك في *{اسم_العيادة}*.\n• الطبيب: {اسم_الدكتور}\n• الفرع: {اسم_الفرع}\n• الموعد الجديد: {الموعد}\n\nنتطلع لخدمتكم بكل سرور.',
  appointment_cancelled:
    'مرحبًا *{اسم_المريض}*\nنود إعلامك بأنه تم إلغاء موعدك في *{اسم_العيادة}* ({الموعد}).\nفي حال رغبتك بحجز موعد جديد في أي وقت، يسعدنا تواصلك معنا.',
  prescription:
    'مرحبًا *{اسم_المريض}* 📄\nتم إصدار روشتتك الطبية من *{اسم_العيادة}* ({اسم_الدكتور}).\nيمكنك عرض الروشتة وتحميلها أو طباعتها من الرابط التالي:\n{الرابط}\n\nنتمنى لك الشفاء العاجل ودوام العافية.',
  invoice:
    'مرحبًا *{اسم_المريض}* 🧾\nتم إصدار فاتورتك الرسمية من *{اسم_العيادة}* ({اسم_الفرع}).\nيمكنك الاطلاع على الفاتورة وتحميلها من الرابط التالي:\n{الرابط}\n\nشكرًا لثقتكم بنا.',
}

export interface WhatsAppTemplateAuditEntry {
  updatedAt?: string
  updatedBy?: string
  updatedByRole?: string
  mode?: 'custom' | 'default'
}

export interface WhatsAppMessageRenderContext {
  patientName?: string | null
  clinicName?: string | null
  when?: string | null
  doctorName?: string | null
  branchName?: string | null
  link?: string | null
}

export interface TemplateValidationIssue {
  valid: boolean
  unknownTokens: string[]
  missingRequiredValues: string[]
  lengthError?: string
}

export const TEMPLATE_SAMPLE_CONTEXT: Required<WhatsAppMessageRenderContext> = {
  patientName: 'أحمد محمود',
  clinicName: 'عيادة النور التخصصية',
  when: 'الأحد 3 مايو، الساعة 07:30 م',
  doctorName: 'د. كريم عبد الله',
  branchName: 'فرع مدينة نصر',
  link: 'https://yalla-clinic.com/clinic/clinic-demo/prescription/sample',
}

const PLACEHOLDER_REGEX = /\{[^}\r\n]{1,40}\}/g

export function normalizeTemplateText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
}

export function extractTemplateTokens(template: string): string[] {
  const matches = String(template || '').match(PLACEHOLDER_REGEX)
  if (!matches) return []
  return Array.from(new Set(matches))
}

export function validateTemplateText(template: string): TemplateValidationIssue {
  const clean = normalizeTemplateText(template)
  if (clean.length < MIN_TEMPLATE_LENGTH) {
    return {
      valid: false,
      unknownTokens: [],
      missingRequiredValues: [],
      lengthError: 'نص الرسالة قصير جدًا (الحد الأدنى 5 أحرف).',
    }
  }
  if (clean.length > MAX_TEMPLATE_LENGTH) {
    return {
      valid: false,
      unknownTokens: [],
      missingRequiredValues: [],
      lengthError: `نص الرسالة طويل جدًا (الحد الأقصى ${MAX_TEMPLATE_LENGTH} حرف).`,
    }
  }
  const tokens = extractTemplateTokens(clean)
  const unknownTokens = tokens.filter((t) => !ALLOWED_TEMPLATE_TOKENS.has(t))
  return {
    valid: unknownTokens.length === 0,
    unknownTokens,
    missingRequiredValues: [],
  }
}

function buildContextMap(ctx: WhatsAppMessageRenderContext): Record<string, string> {
  const doctorRaw = String(ctx.doctorName || '').trim()
  const doctorDisplay = doctorRaw
    ? doctorRaw.startsWith('د.') || doctorRaw.toLowerCase().startsWith('dr.')
      ? doctorRaw
      : `د. ${doctorRaw}`
    : ''
  return {
    '{اسم_المريض}': String(ctx.patientName || '').trim(),
    '{اسم_العيادة}': String(ctx.clinicName || '').trim(),
    '{الموعد}': String(ctx.when || '').trim(),
    '{اسم_الدكتور}': doctorDisplay,
    '{اسم_الفرع}': String(ctx.branchName || '').trim(),
    '{الرابط}': String(ctx.link || '').trim(),
  }
}

/**
 * Check whether every placeholder used in the template has an actual value in context.
 */
export function inspectTemplateContextReadiness(
  template: string,
  ctx: WhatsAppMessageRenderContext,
  templateKey?: WhatsAppTemplateKey,
): { ready: boolean; missingVariables: string[] } {
  const map = buildContextMap(ctx)
  const tokens = extractTemplateTokens(template)
  const missingVariables: string[] = []
  for (const token of tokens) {
    if (!ALLOWED_TEMPLATE_TOKENS.has(token)) continue
    if (!map[token]) {
      missingVariables.push(token)
    }
  }
  if (templateKey === 'prescription' || templateKey === 'invoice') {
    if (!map['{الرابط}'] && tokens.includes('{الرابط}')) {
      if (!missingVariables.includes('{الرابط}')) missingVariables.push('{الرابط}')
    }
  }
  return {
    ready: missingVariables.length === 0,
    missingVariables,
  }
}

/**
 * Cleanly remove empty lines or parenthesized empty placeholders so a sent WhatsApp
 * message never shows raw `{اسم_الفرع}` or awkward `• الفرع: ` lines.
 */
function sanitizeRenderedLines(text: string): string {
  const lines = text.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    // Drop optional metadata bullet lines if their value became empty after substitution
    if (/^[•\-*]\s*[^:]+:\s*$/.test(line.trim())) continue
    const cleanedLine = line
      .replace(/\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trimEnd()
    kept.push(cleanedLine)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function renderClinicMessage(
  template: string,
  patientOrCtx: string | WhatsAppMessageRenderContext,
  clinic?: string,
  when?: string,
  extra?: Pick<WhatsAppMessageRenderContext, 'doctorName' | 'branchName' | 'link'>,
): string {
  const ctx: WhatsAppMessageRenderContext =
    typeof patientOrCtx === 'object' && patientOrCtx !== null
      ? patientOrCtx
      : {
          patientName: patientOrCtx,
          clinicName: clinic,
          when,
          doctorName: extra?.doctorName,
          branchName: extra?.branchName,
          link: extra?.link,
        }

  const map = buildContextMap(ctx)
  let output = normalizeTemplateText(template)
  for (const [token, val] of Object.entries(map)) {
    output = output.replaceAll(token, val)
  }
  // Remove any stray unknown placeholders defensively rather than leaking raw `{foo}`
  output = output.replace(PLACEHOLDER_REGEX, '')
  return sanitizeRenderedLines(output)
}

export function resolveSampleContextForKey(key: WhatsAppTemplateKey): Required<WhatsAppMessageRenderContext> {
  if (key === 'invoice') {
    return {
      ...TEMPLATE_SAMPLE_CONTEXT,
      link: 'https://yalla-clinic.com/clinic/clinic-demo/invoice/inv-2026-041',
    }
  }
  if (key === 'prescription') {
    return {
      ...TEMPLATE_SAMPLE_CONTEXT,
      link: 'https://yalla-clinic.com/clinic/clinic-demo/prescription/rx-2026-041',
    }
  }
  return { ...TEMPLATE_SAMPLE_CONTEXT }
}

export interface WhatsAppPreviewSegment {
  type: 'text' | 'bold' | 'link'
  value: string
}

/**
 * Parse a single line into plain text, WhatsApp *bold* spans, and https links for safe JSX rendering.
 */
export function parseWhatsAppPreviewLine(line: string): WhatsAppPreviewSegment[] {
  if (!line) return []
  const segments: WhatsAppPreviewSegment[] = []
  const pattern = /(\*[^*\r\n]+\*|https?:\/\/[^\s]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: line.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 3) {
      segments.push({ type: 'bold', value: token.slice(1, -1) })
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      segments.push({ type: 'link', value: token })
    } else {
      segments.push({ type: 'text', value: token })
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < line.length) {
    segments.push({ type: 'text', value: line.slice(lastIndex) })
  }
  return segments
}
