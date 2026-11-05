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
  'experienceYears', 'doctorRating', 'logoUrl', 'thermalMonoLogoUrl',
  'slogan', 'receiptHeaderNote', 'receiptFooterNote', 'reportHeaderNote',
  'secondaryColor', 'primaryColor', 'services', 'assistantPermissions',
  'averageVisitTime', 'maxDailyBookings', 'bookingAvailability',
  'allowFutureBookings', 'allowPatientMedicalView', 'hidePrices',
  'weeklySchedule', 'workingHours', 'clinicAddress', 'address',
  'clinicPhone', 'doctorPhone', 'mapsLink', 'latitude', 'longitude',
  'clinicPhones', 'onlinePaymentEnabled', 'walletNumber',
  'instapayHandle', 'isCashEnabled', 'isClinicOpen', 'showPrices',
  'isWalletEnabled', 'isInstapayEnabled', 'queueNormal', 'queueConsult',
  'queueUrgent', 'queuePattern', 'assistants',
])

export function pickNormalClinicSettings(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  return Object.fromEntries(
    Object.entries(body).filter(([key, value]) =>
      allowedSettings.has(key) && value !== undefined,
    ),
  )
}
