/** Public booking-page presentation only. These settings never alter queue or payment rules. */
export type BookingPageConfig = {
  headlineAr: string
  headlineEn: string
  badgeAr: string
  badgeEn: string
  bookLabelAr: string
  bookLabelEn: string
  trackLabelAr: string
  trackLabelEn: string
  portalLabelAr: string
  portalLabelEn: string
  servicesTitleAr: string
  servicesTitleEn: string
  locationTitleAr: string
  locationTitleEn: string
  branchesTitleAr: string
  branchesTitleEn: string
  trustAr: string[]
  trustEn: string[]
  showDoctorPhoto: boolean
  showRating: boolean
  showExperience: boolean
  showTrust: boolean
  showServices: boolean
  showLocation: boolean
  showBranches: boolean
  showContact: boolean
  showQueueButton: boolean
  showPatientPortal: boolean
  showHeaderNavigation: boolean
  heroLayout: 'doctor_first' | 'copy_first'
  primaryColor?: string
  secondaryColor?: string
}

export const DEFAULT_BOOKING_PAGE_CONFIG: BookingPageConfig = {
  headlineAr: 'احجز موعدك الآن',
  headlineEn: 'Book Your Appointment',
  badgeAr: 'رعاية صحية أفضل.. بخطوة أسهل',
  badgeEn: 'Better Healthcare.. In One Easy Step',
  bookLabelAr: 'حجز موعد الآن',
  bookLabelEn: 'Book Appointment',
  trackLabelAr: 'تابع دورك',
  trackLabelEn: 'Track Queue',
  portalLabelAr: 'بوابة المريض',
  portalLabelEn: 'Patient Portal',
  servicesTitleAr: 'الخدمات الطبية المتاحة',
  servicesTitleEn: 'Available Medical Services',
  locationTitleAr: 'خريطة الوصول وموقع العيادة',
  locationTitleEn: 'Clinic Location Map',
  branchesTitleAr: 'فروع العيادة',
  branchesTitleEn: 'Clinic Branches',
  trustAr: ['دقة في المواعيد', 'تقييمات حقيقية', 'خدمة متميزة', 'خصوصية وأمان'],
  trustEn: ['Punctual Appointments', 'Verified Reviews', 'Premium Care', 'Privacy & Security'],
  showDoctorPhoto: true,
  showRating: true,
  showExperience: true,
  showTrust: true,
  showServices: true,
  showLocation: true,
  showBranches: true,
  showContact: true,
  showQueueButton: true,
  showPatientPortal: true,
  showHeaderNavigation: true,
  heroLayout: 'doctor_first',
  primaryColor: '#0066dc',
  secondaryColor: '#00a8e8',
}

const textKeys = [
  'headlineAr', 'headlineEn', 'badgeAr', 'badgeEn', 'bookLabelAr', 'bookLabelEn',
  'trackLabelAr', 'trackLabelEn', 'portalLabelAr', 'portalLabelEn',
  'servicesTitleAr', 'servicesTitleEn', 'locationTitleAr', 'locationTitleEn',
  'branchesTitleAr', 'branchesTitleEn', 'primaryColor', 'secondaryColor',
] as const

const switchKeys = [
  'showDoctorPhoto', 'showRating', 'showExperience', 'showTrust',
  'showServices', 'showLocation', 'showBranches', 'showContact',
  'showQueueButton', 'showPatientPortal', 'showHeaderNavigation',
] as const

/** Defensive parsing for old documents and untrusted API input. */
export function normalizeBookingPageConfig(input: unknown): BookingPageConfig {
  const raw = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {}
  const result: BookingPageConfig = {
    ...DEFAULT_BOOKING_PAGE_CONFIG,
    trustAr: [...DEFAULT_BOOKING_PAGE_CONFIG.trustAr],
    trustEn: [...DEFAULT_BOOKING_PAGE_CONFIG.trustEn]
  }
  for (const key of textKeys) {
    if (typeof raw[key] === 'string') {
      const value = raw[key].trim().slice(0, 180)
      if (value) result[key] = value
    }
  }
  for (const key of switchKeys) {
    if (typeof raw[key] === 'boolean') result[key] = raw[key]
  }
  for (const key of ['trustAr', 'trustEn'] as const) {
    if (Array.isArray(raw[key]) && raw[key].length === 4) {
      result[key] = raw[key].map((value, idx) =>
        typeof value === 'string' && value.trim()
          ? value.trim().slice(0, 100)
          : DEFAULT_BOOKING_PAGE_CONFIG[key][idx]
      )
    }
  }
  if (raw.heroLayout === 'copy_first') result.heroLayout = 'copy_first'
  return result
}

/**
 * Cleanly format doctor name with an honorific/title.
 * Strips any duplicated titles (e.g. "د. د. أحمد السعيد" or "د. دكتور أحمد")
 * ensuring it formats cleanly as "د. أحمد السعيد" or "Dr. Ahmed" everywhere.
 */
export function displayDoctorName(name: string | undefined, title: string = 'د.'): string {
  if (!name || typeof name !== 'string') return ''
  let cleaned = name.trim()
  if (!cleaned) return ''

  // Repeatedly remove leading doctor prefixes to eliminate duplicates
  const prefixRegex = /^(د\.|دكتور|دكتورة|أ\.د\.|استشاري|طبيب|dr\.|doctor)\s+/i
  let hadPrefix = false
  while (prefixRegex.test(cleaned)) {
    hadPrefix = true
    cleaned = cleaned.replace(prefixRegex, '').trim()
  }

  const effectiveTitle = (title || (hadPrefix ? 'د.' : '')).trim()
  if (!effectiveTitle) return cleaned
  return `${effectiveTitle} ${cleaned}`
}
