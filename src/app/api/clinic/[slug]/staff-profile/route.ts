import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { isCurrentClinicDoctor } from '@/lib/clinic-credential-policy'
import { authenticateOwnerRequest } from '@/lib/server/owner-access'
import { queryDocumentsByField } from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

// Never send raw clinic documents to tenant browser clients: they may contain
// credential hashes, API keys, or owner-controlled private metadata.
const STAFF_VIEW_FIELDS = [
  'slug', 'clinicName', 'name', 'doctorName', 'doctorTitle', 'specialty',
  'doctorPhone', 'clinicPhone', 'clinicPhones', 'clinicAddress', 'address',
  'mapsLink', 'latitude', 'longitude', 'primaryColor', 'secondaryColor',
  'logoUrl', 'thermalMonoLogoUrl', 'heroImage', 'heroTitle', 'heroSubtitle',
  'badge1Title', 'badge1Value', 'badge2Title', 'badge2Value',
  'certificationTitle', 'certificationEntity', 'doctorRating',
  'experienceYears', 'bookingPageConfig', 'bookingAvailability',
  'allowFutureBookings', 'weeklySchedule', 'workingHours', 'services',
  'averageVisitTime', 'maxDailyBookings', 'queueNormal', 'queueConsult',
  'queueUrgent', 'queuePattern', 'assistantPermissions', 'isActive',
  'expirationDate', 'activationDate', 'packageName', 'packagePermissions',
  'branchesEnabled', 'maxBranches', 'branchCreationAllowed',
  'allowFinance', 'allowDrugs', 'allowPrescriptions', 'allowCustomTemplate',
  'allowDoctorEditBranding', 'allowOnlineBooking', 'allowTvScreen',
  'allowAnalytics', 'allowPatientAlerts', 'aiEnabled', 'aiLockedByOwner',
  'hiddenTabs', 'hiddenSections', 'isClinicOpen', 'showPrices', 'hidePrices',
  'isCashEnabled', 'isWalletEnabled', 'isInstapayEnabled',
  'onlinePaymentEnabled', 'walletNumber', 'instapayHandle',
  'favorite_drugs', 'favoriteDrugs', 'custom_drugs', 'prescriptionTemplateUrl',
  'slogan', 'receiptHeaderNote', 'receiptFooterNote', 'reportHeaderNote',
  'supportNumbers', 'branches', 'hiddenProtocolIds', 'doctorEmail',
  'aiResponsesLimit', 'aiResponsesCount', 'aiKnowledge', 'tvConfig',
  'allowPatientMedicalView', 'residentialAreas', 'textColor', 'doctorImage',
] as const

function pickStaffFields(clinic: Record<string, unknown>) {
  const safe: Record<string, unknown> = {}
  for (const key of STAFF_VIEW_FIELDS) {
    if (clinic[key] !== undefined) safe[key] = clinic[key]
  }
  return safe
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
      return NextResponse.json({ error: 'رابط عيادة غير صالح' }, { status: 400 })
    }

    let clinic: Record<string, unknown> | null = null
    let clinicId = ''
    const staff = await getCurrentClinicStaff(req, slug)
    if (staff) {
      clinic = staff.clinic
      clinicId = staff.clinicId
    } else {
      const owner = await authenticateOwnerRequest(req).catch(() => null)
      if (!owner) return NextResponse.json({ error: 'يرجى تسجيل الدخول' }, { status: 401 })
      const found = (await queryDocumentsByField('clinics', 'slug', slug))[0]
      if (!found) return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
      clinicId = String(found.id)
      clinic = found
    }

    return NextResponse.json(
      { success: true, clinic: { ...pickStaffFields(clinic!), id: clinicId, hasAiApiKey: Boolean(clinic?.aiApiKey) } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    console.error('[staff-profile] Could not retrieve clinic profile:',
      err instanceof Error ? err.message : 'UNKNOWN')
    return NextResponse.json({ error: 'تعذر تحميل بيانات العيادة' }, { status: 503 })
  }
}
