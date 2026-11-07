import { isOwnerSectionVisible, type ClinicAccessRecord } from '@/lib/clinicAccessPolicy'

/** Rules shared by doctor credential endpoints and their unit tests. */
export function normalizeDoctorEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null
}

export function isCurrentClinicDoctor(
  payload: Record<string, unknown> | null | undefined,
  clinic: Record<string, unknown>,
  clinicId: string,
  slug: string,
): boolean {
  const passwordChangedAt = typeof clinic.passwordLastChangedAt === 'string'
    ? Date.parse(clinic.passwordLastChangedAt)
    : NaN
  return Boolean(
    payload?.role === 'doctor' &&
    payload.clinicId === clinicId &&
    payload.slug === slug &&
    typeof payload.email === 'string' &&
    normalizeDoctorEmail(payload.email) === normalizeDoctorEmail(clinic.doctorEmail) &&
    normalizeDoctorEmail(clinic.doctorEmail) !== null &&
    clinic.slug === slug &&
    (!Number.isFinite(passwordChangedAt) || (
      typeof payload.issuedAt === 'number' && payload.issuedAt >= passwordChangedAt
    )),
  )
}

// Normal settings may never set account credentials, subscription rights or tenant IDs.
// Add new ordinary settings here as they are introduced in the settings form.
const allowedSettings = new Set([
  'clinicName', 'doctorName', 'doctorTitle', 'specialty', 'heroSubtitle',
  'certificationTitle', 'certificationEntity', 'heroImage', 'branchImage',
  'bookingPageConfig',
  'experienceYears', 'doctorRating', 'logoUrl', 'thermalMonoLogoUrl',
  'slogan', 'receiptHeaderNote', 'receiptFooterNote', 'reportHeaderNote',
  'secondaryColor', 'primaryColor', 'services', 'assistantPermissions',
  'averageVisitTime', 'maxDailyBookings', 'bookingAvailability',
  'allowFutureBookings', 'allowPatientMedicalView', 'hidePrices',
  'weeklySchedule', 'workingHours', 'clinicAddress', 'address',
  'clinicPhone', 'doctorPhone', 'mapsLink', 'latitude', 'longitude',
  'clinicPhones', 'onlinePaymentEnabled', 'walletNumber',
  'instapayHandle', 'isCashEnabled', 'showPrices',
  'isWalletEnabled', 'isInstapayEnabled', 'queueNormal', 'queueConsult',
  'queueUrgent', 'queuePattern', 'assistants',
])

// Owner-managed visibility is also a server-side write permission: hidden
// fields are not allowed to be modified by a forged settings POST.
const fieldSection: Record<string, string> = {
  clinicName: 'settings.profile.doctor',
  doctorName: 'settings.profile.doctor',
  doctorTitle: 'settings.profile.doctor',
  specialty: 'settings.profile.doctor',
  heroSubtitle: 'settings.profile.doctor',
  certificationTitle: 'settings.profile.doctor',
  certificationEntity: 'settings.profile.doctor',
  heroImage: 'settings.profile.doctor',
  branchImage: 'settings.profile.doctor',
  experienceYears: 'settings.profile.doctor',
  doctorRating: 'settings.profile.doctor',
  logoUrl: 'settings.branding.logos',
  thermalMonoLogoUrl: 'settings.branding.logos',
  slogan: 'settings.branding.texts',
  receiptHeaderNote: 'settings.branding.texts',
  receiptFooterNote: 'settings.branding.texts',
  reportHeaderNote: 'settings.branding.texts',
  primaryColor: 'settings.branding.colors',
  secondaryColor: 'settings.branding.colors',
  bookingPageConfig: 'settings.booking_design',
  clinicAddress: 'settings.profile.contact',
  address: 'settings.profile.contact',
  clinicPhone: 'settings.profile.contact',
  doctorPhone: 'settings.profile.contact',
  mapsLink: 'settings.profile.contact',
  latitude: 'settings.profile.contact',
  longitude: 'settings.profile.contact',
  clinicPhones: 'settings.profile.contact',
  hidePrices: 'settings.profile.prices',
  showPrices: 'settings.profile.prices',
  allowPatientMedicalView: 'settings.profile',
  services: 'settings.services.catalog',
  assistantPermissions: 'settings.staff.permissions',
  assistants: 'settings.staff.permissions',
  averageVisitTime: 'settings.queue.capacity',
  maxDailyBookings: 'settings.queue.capacity',
  bookingAvailability: 'settings.queue.capacity',
  allowFutureBookings: 'settings.queue.capacity',
  queueNormal: 'settings.queue.capacity',
  queueConsult: 'settings.queue.capacity',
  queueUrgent: 'settings.queue.capacity',
  queuePattern: 'settings.queue.capacity',
  weeklySchedule: 'settings.queue.schedule',
  workingHours: 'settings.queue.schedule',
  onlinePaymentEnabled: 'settings.payment.methods',
  walletNumber: 'settings.payment.methods',
  instapayHandle: 'settings.payment.methods',
  isCashEnabled: 'settings.payment.methods',
  isWalletEnabled: 'settings.payment.methods',
  isInstapayEnabled: 'settings.payment.methods',
}

export function pickNormalClinicSettings(
  body: unknown,
  clinic?: ClinicAccessRecord | null,
): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  return Object.fromEntries(
    Object.entries(body).filter(([key, value]) =>
      allowedSettings.has(key) &&
      value !== undefined &&
      Boolean(fieldSection[key]) &&
      isOwnerSectionVisible(clinic, fieldSection[key]),
    ),
  )
}
