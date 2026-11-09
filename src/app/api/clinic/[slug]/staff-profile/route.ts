import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { isCurrentClinicDoctor } from '@/lib/clinic-credential-policy'
import { authenticateOwnerRequest } from '@/lib/server/owner-access'
import { queryDocuments, readDocument } from '@/lib/server/firebase-rest'

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
  'clinicAddress', 'doctorTitle', 'supportNumbers',
] as const

function pickStaffFields(clinic: Record<string, unknown>) {
  const safe: Record<string, unknown> = {}
  for (const key of STAFF_VIEW_FIELDS) {
    if (clinic[key] !== undefined) safe[key] = clinic[key]
  }
  return safe
}

function assistantIdentityMatches(
  payload: Record<string, unknown>,
  clinic: Record<string, unknown>,
) {
  const email = String(payload.email || '').trim().toLowerCase()
  const username = String(payload.username || '').trim().toLowerCase()
  const candidates = [
    { email: clinic.assistantEmail, username: clinic.assistantUsername },
    ...(Array.isArray(clinic.assistants) ? clinic.assistants : []),
  ]
  return candidates.some((c: any) => (
    (email && typeof c.email === 'string' && c.email.trim().toLowerCase() === email) ||
    (username && typeof c.username === 'string' && c.username.trim().toLowerCase() === username)
  ))
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
    const token = req.cookies.get('clinic_session')?.value || ''
    const session = token ? await verifySessionToken(token) : { valid: false }
    if (session.valid && session.payload) {
      const payload = session.payload as Record<string, unknown>
      if (payload.slug !== slug || typeof payload.clinicId !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.clinicId) ||
          !['doctor', 'assistant'].includes(String(payload.role))) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
      }
      clinicId = payload.clinicId
      clinic = await readDocument(`clinics/${clinicId}`)
      if (!clinic || clinic.slug !== slug) {
        return NextResponse.json({ error: 'العيادة غير متاحة' }, { status: 404 })
      }
      if (payload.role === 'doctor' &&
          !isCurrentClinicDoctor(payload, clinic, clinicId, slug)) {
        return NextResponse.json({ error: 'تم تغيير بيانات الدخول. سجل الدخول مجددًا.' }, { status: 401 })
      }
      if (payload.role === 'assistant' && !assistantIdentityMatches(payload, clinic)) {
        return NextResponse.json({ error: 'حساب السكرتارية لم يعد مصرحًا به' }, { status: 401 })
      }
    } else {
      // Enables owner previews without turning the private endpoint public.
      const owner = await authenticateOwnerRequest(req).catch(() => null)
      if (!owner) return NextResponse.json({ error: 'يرجى تسجيل الدخول' }, { status: 401 })
      const found = (await queryDocuments('clinics'))
        .find((c: Record<string, unknown>) => c.slug === slug)
      if (!found) return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
      clinicId = String(found.id)
      clinic = found
    }

    return NextResponse.json(
      { success: true, clinic: { ...pickStaffFields(clinic!), id: clinicId } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    console.error('[staff-profile] Could not retrieve clinic profile:',
      err instanceof Error ? err.message : 'UNKNOWN')
    return NextResponse.json({ error: 'تعذر تحميل بيانات العيادة' }, { status: 503 })
  }
}
