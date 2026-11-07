/**
 * Owner-owned clinic access policy. Keep the policy independent of React and
 * Firestore so it can be applied consistently by UI, routes and tests.
 */
export interface ClinicAccessRecord {
  isActive?: boolean
  expirationDate?: string | null
  hiddenTabs?: string[]
  hiddenSections?: string[]
}

/** The subscription suspension state is different from daily branch open hours. */
export function isClinicSuspended(source: unknown, now: Date = new Date()): boolean {
  if (!source || typeof source !== 'object') return false
  const clinic = source as ClinicAccessRecord
  if (clinic.isActive === false) return true
  const expires = String(clinic.expirationDate || '').trim()
  if (!expires) return false
  const expiry = new Date(expires)
  return !Number.isNaN(expiry.valueOf()) && expiry.valueOf() <= now.valueOf()
}

/**
 * Suspended doctors can inspect past records, but not operate the clinic.
 * Never use a startsWith check which could allow /admin/accounts/reset, etc.
 */
export function isSuspendedReadOnlyPath(pathname: string, slug: string): boolean {
  const prefix = `/clinic/${slug}/admin/`
  if (!pathname.startsWith(prefix)) return false
  const relative = pathname.slice(prefix.length).replace(/\/+$/, '')
  return relative === 'accounts' || relative === 'finance' ||
    relative === 'patients' || /^patients\/[^/]+$/.test(relative)
}

/** Strict allowlist; not supplying a section id must never grant access. */
export const OWNER_CONTROLLED_SECTIONS = [
  { id: 'settings.security', label: 'الأمان والحساب' },
  { id: 'settings.profile', label: 'الهوية والبيانات' },
  { id: 'settings.branding', label: 'هوية العيادة والطباعة' },
  { id: 'settings.booking_design', label: 'تصميم صفحة الحجز' },
  { id: 'settings.queue', label: 'المواعيد والدور' },
  { id: 'settings.services', label: 'الخدمات والأسعار' },
  { id: 'settings.payment', label: 'طرق الدفع' },
  { id: 'settings.staff', label: 'المساعدين والصلاحيات' },
  { id: 'settings.print', label: 'إعدادات الطباعة' },
  { id: 'settings.ai', label: 'إعدادات الذكاء الاصطناعي' },
  { id: 'settings.profile.doctor', label: 'بيانات وصورة الدكتور' },
  { id: 'settings.profile.contact', label: 'بيانات التواصل والموقع' },
  { id: 'settings.profile.prices', label: 'إظهار أسعار الكشوفات' },
  { id: 'settings.branding.logos', label: 'الشعارات' },
  { id: 'settings.branding.colors', label: 'ألوان العيادة' },
  { id: 'settings.branding.texts', label: 'النصوص والعناوين' },
  { id: 'settings.queue.schedule', label: 'جدول المواعيد' },
  { id: 'settings.queue.capacity', label: 'مدد الكشف والحد الأقصى للحجوزات' },
  { id: 'settings.services.catalog', label: 'كتالوج الخدمات' },
  { id: 'settings.payment.methods', label: 'طرق الدفع والتحويل' },
  { id: 'settings.staff.permissions', label: 'صلاحيات المساعدين' }
] as const

export function isOwnerSectionVisible(source: unknown, sectionId: string): boolean {
  if (!sectionId || !source || typeof source !== 'object') return true
  const clinic = source as ClinicAccessRecord
  const hidden = Array.isArray(clinic.hiddenSections) ? clinic.hiddenSections : []
  const parts = sectionId.split('.')
  return !parts.some((_, index) => hidden.includes(parts.slice(0, index + 1).join('.')))
}
