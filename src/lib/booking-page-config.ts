/**
 * Public booking-page presentation and styling configuration.
 * Controls doctor photo, badges, titles, section visibility, hero layout, and palette colors.
 */
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

export const COLOR_PALETTES = [
  { label: 'أزرق ملكي طبي', labelEn: 'Royal Medical Blue', primary: '#087CF4', secondary: '#0284C7' },
  { label: 'كحلي وقور', labelEn: 'Prestige Navy', primary: '#0F2042', secondary: '#1E3A8A' },
  { label: 'أخضر صحي', labelEn: 'Emerald Care', primary: '#059669', secondary: '#10B981' },
  { label: 'تيل بحري', labelEn: 'Modern Teal', primary: '#0D9488', secondary: '#14B8A6' },
  { label: 'ياقوتي نقي', labelEn: 'Clinical Sapphire', primary: '#1D4ED8', secondary: '#3B82F6' },
  { label: 'عنابي راقي', labelEn: 'Burgundy Elite', primary: '#991B1B', secondary: '#DC2626' },
  { label: 'بنفسجي وقور', labelEn: 'Deep Violet', primary: '#6D28D9', secondary: '#8B5CF6' },
]

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
  trustAr: ['دقة في المواعيد', 'تقييمات موثقة', 'خدمة متميزة', 'خصوصية وأمان'],
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
  primaryColor: '#087CF4',
  secondaryColor: '#0284C7',
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

/** Defensive parsing for old documents and untrusted input. */
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
 * Prevents duplicated doctor titles like "د. د. أحمد السعيد" or "Dr. Dr. Karim".
 * Safely strips duplicated honorifics and produces a canonical clean doctor title.
 */
export function displayDoctorName(nameOrTitle?: string | null, maybeNameOrTitle?: string | null): string {
  let title = 'د.'
  let name = ''

  const a = (nameOrTitle || '').trim()
  const b = (maybeNameOrTitle || '').trim()

  const isHonorific = (s: string) => /^(د\.|د|د\/|دكتور|الدكتور|Dr\.|Dr)$/i.test(s)

  if (isHonorific(a) && b) {
    title = a
    name = b
  } else if (isHonorific(b) && a) {
    title = b
    name = a
  } else {
    name = a || b
    title = b && isHonorific(b) ? b : 'د.'
  }

  const cleanedName = name
    .replace(/^(د\.\s*|د\/\s*|دكتور\s*|الدكتور\s*|Dr\.\s*|Dr\s+)+/gi, '')
    .trim()

  if (!cleanedName) return a || b
  return `${title} ${cleanedName}`.trim()
}
