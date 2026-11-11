import { NextRequest, NextResponse } from 'next/server'
import { getClinicDoctorAccount } from '@/lib/server/clinic-credential-access'
import {
  isFirestoreQuotaError,
  writeDocument,
  queryDocumentsByField,
  readDocument,
  commitDocumentPatches,
} from '@/lib/server/firebase-rest'
import {
  getClinicMetaFromRoom,
  resolveClinicSlugFromRoom,
  setClinicSlugInRoom,
  updateClinicMetaInRoom,
} from '@/lib/server/queue-room-client'
import { normalizeAssistantAccounts } from '@/lib/server/assistant-credentials'
import { createSessionToken } from '@/lib/auth-crypto'
import { pickNormalClinicSettings } from '@/lib/clinic-credential-policy'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'
import { formatWeeklyScheduleSummary } from '@/lib/branchService'

export const dynamic = 'force-dynamic'

/**
 * Public Allowlist for Clinic Data Minimization:
 * Only public-facing attributes needed by patient booking, branding, and schedules
 * are permitted in public responses. Administrative fields, assistant credentials,
 * billing data, and internal notes are strictly excluded.
 */
const PUBLIC_CLINIC_FIELDS = [
  'id',
  'slug',
  'clinicName',
  'name',
  'doctorName',
  'doctorTitle',
  'specialty',
  'heroSubtitle',
  'certificationTitle',
  'certificationEntity',
  'heroImage',
  'branchImage',
  'experienceYears',
  'doctorRating',
  'logoUrl',
  'thermalMonoLogoUrl',
  'slogan',
  'receiptHeaderNote',
  'receiptFooterNote',
  'reportHeaderNote',
  'primaryColor',
  'secondaryColor',
  'bookingPageConfig',
  'clinicAddress',
  'address',
  'clinicPhone',
  'clinicPhones',
  'doctorPhone',
  'whatsappNumber',
  'mapsLink',
  'latitude',
  'longitude',
  'branches',
  'services',
  'workingHours',
  'weeklySchedule',
  'bookingAvailability',
  'allowFutureBookings',
  'averageVisitTime',
  'isClinicOpen',
  'showPrices',
  'hidePrices',
  'onlinePaymentEnabled',
  'isCashEnabled',
  'isInstapayEnabled',
  'instapayHandle',
  'instapayAccount',
  'isWalletEnabled',
  'walletNumber',
  'vodafoneCashNumber',
  'prescriptionTemplateUrl',
  'aiEnabled',
  'tvConfig',
  'isActive',
  'expirationDate',
] as const

function pickPublicClinicData(cDoc: Record<string, any>, clinicId: string) {
  const publicData: Record<string, any> = {
    id: clinicId,
    slug: cDoc.slug || '',
    isActive: cDoc.isActive !== false,
  }
  for (const field of PUBLIC_CLINIC_FIELDS) {
    if (cDoc[field] !== undefined) {
      publicData[field] = cDoc[field]
    }
  }
  return publicData
}

/**
 * GET: Retrieve public clinic profile via strict data minimization allowlist.
 * If called with valid doctor credentials, returns extended clinic configuration.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug) {
      return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400 })
    }

    const mappedClinicId = await resolveClinicSlugFromRoom(slug)
    let cDoc = mappedClinicId ? await getClinicMetaFromRoom(mappedClinicId) : null
    if (!cDoc || (cDoc.slug !== slug && cDoc.id !== slug)) {
      cDoc = (await queryDocumentsByField('clinics', 'slug', slug))[0]
        || (/^[a-zA-Z0-9_-]{1,128}$/.test(slug) ? await readDocument(`clinics/${slug}`) : null)
      if (cDoc) {
        const resolvedId = String(cDoc.id || slug)
        await Promise.all([
          setClinicSlugInRoom(String(cDoc.slug || slug), resolvedId).catch(() => null),
          updateClinicMetaInRoom({ clinicId: resolvedId, clinic: cDoc }).catch(() => null),
        ])
      }
    }
    if (!cDoc) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const clinicId = cDoc.id

    // Check if requester is authenticated as this clinic doctor
    const doctorAuth = await getClinicDoctorAccount(req, slug).catch(() => null)
    if (doctorAuth && doctorAuth.ok) {
      // Authenticated doctor gets full settings (with passwords stripped)
      const {
        doctorPasswordHash,
        doctorPassword,
        assistantPasswordHash,
        assistantPassword,
        resetPasswordOtp, resetPasswordOtpHashed,
        resetPasswordExpiresAt, resetPasswordAttempts,
        aiApiKey,
        brevoApiKey,
        resendApiKey,
        ...rawSafe
      } = cDoc

      const safeAssistants = Array.isArray(rawSafe.assistants)
        ? rawSafe.assistants.map((a: any) => {
            const { password, passwordHash, ...cleanA } = a
            return cleanA
          })
        : []

      return NextResponse.json({
        success: true,
        clinic: {
          ...rawSafe,
          id: clinicId,
          assistants: safeAssistants
        }
      })
    }

    // Unauthenticated public request: Return strictly minimized allowlist data
    const publicClinic = pickPublicClinicData(cDoc, clinicId)

    return NextResponse.json({
      success: true,
      clinic: publicClinic
    })
  } catch (err: any) {
    console.error('Error in settings GET:', err)
    const isQuota = isFirestoreQuotaError(err)
    return NextResponse.json(
      { error: isQuota ? 'الخدمة مزدحمة مؤقتاً، يرجى المحاولة بعد قليل' : 'فشل في استرجاع بيانات العيادة' },
      { status: isQuota ? 503 : 500 }
    )
  }
}

/**
 * POST / PATCH: Save normal clinic configuration.
 * Strictly separates business settings from password management.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug) return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400 })
    const account = await getClinicDoctorAccount(req, slug)
    if (!account.ok) {
      return NextResponse.json({ error: account.error }, { status: account.status })
    }

    if (isClinicSuspended(account.clinic)) {
      return NextResponse.json({
        error: 'الاشتراك منتهي: يمكنك مشاهدة الحسابات والتقارير وسجل المرضى فقط.'
      }, { status: 403 })
    }

    // Never accept account credentials, hidden sections, or subscription fields.
    const body = await req.json().catch(() => null)
    const settings = pickNormalClinicSettings(body, account.clinic)
    if (!Object.keys(settings).length) {
      return NextResponse.json({ error: 'لا توجد إعدادات مسموح بتعديلها' }, { status: 400 })
    }
    const cleanedPayload: Record<string, any> = {
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    const clinicId = account.clinicId
    let credentialsVersion = Number(account.clinic.credentialsVersion || 0)
    let requiresSessionRefresh = false
    if (Object.hasOwn(cleanedPayload, 'assistants')) {
      const normalized = await normalizeAssistantAccounts(cleanedPayload.assistants, account.clinic.assistants)
      cleanedPayload.assistants = normalized.accounts
      if (normalized.credentialsChanged) {
        credentialsVersion = Date.now()
        cleanedPayload.credentialsVersion = credentialsVersion
        requiresSessionRefresh = true
      }
    }
    await writeDocument(`clinics/${clinicId}`, cleanedPayload, true)

    await updateClinicMetaInRoom({
      clinicId,
      clinic: { ...account.clinic, ...cleanedPayload, id: clinicId },
    }).catch(() => null)

    // Sync schedule to main branch if weeklySchedule provided
    if (Array.isArray(cleanedPayload.weeklySchedule) && cleanedPayload.weeklySchedule.length > 0) {
      try {
        const groups = await Promise.all([
          queryDocumentsByField('branches', 'clinicId', clinicId),
          queryDocumentsByField('branches', 'clinic_id', clinicId),
        ])
        const branches = [...new Map(groups.flat().map(branch => [String(branch.id), branch])).values()]
        const main = branches.find(branch => branch.isMain === true) || (branches.length === 1 ? branches[0] : null)
        if (main) await commitDocumentPatches([{ path: `branches/${main.id}`, data: {
          weeklySchedule: cleanedPayload.weeklySchedule,
          workingHours: formatWeeklyScheduleSummary(cleanedPayload.weeklySchedule, true),
          ...(cleanedPayload.maxDailyBookings !== undefined ? { maxDailyBookings: Math.max(0, Number(cleanedPayload.maxDailyBookings) || 0) } : {}),
          updatedAt: new Date().toISOString(),
        } }])
      } catch (syncErr) {
        console.warn('Schedule sync warning in settings POST:', syncErr)
      }
    }

    const response = NextResponse.json({
      success: true,
      requiresSessionRefresh,
      message: 'تم حفظ كافة إعدادات العيادة بنجاح'
    })
    if (requiresSessionRefresh) {
      const token = await createSessionToken({ role: 'doctor', clinicId, slug,
        name: String(account.clinic.doctorName || 'طبيب العيادة'),
        username: String(account.clinic.doctorUsername || ''),
        email: String(account.clinic.doctorEmail || ''), credentialsVersion,
        mustChangePassword: account.clinic.mustChangePassword === true,
      })
      response.cookies.set('clinic_session', token, { httpOnly: true,
        secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
        maxAge: 7 * 24 * 60 * 60,
        domain: process.env.NODE_ENV === 'production' ? '.yalla-clinic.com' : undefined,
      })
    }
    return response
  } catch (err: any) {
    if (/^(INVALID_ASSISTANT_|DUPLICATE_ASSISTANT_|ASSISTANT_PASSWORD_REQUIRED)/.test(err?.message || '')) {
      return NextResponse.json({ error: 'راجع بيانات المساعدين: اسم دخول فريد، وكلمة مرور لا تقل عن 6 خانات للحساب الجديد.' }, { status: 400 })
    }
    console.error('Error in settings POST:', err)
    return NextResponse.json(
      { error: err?.message === 'FIREBASE_SERVER_NOT_CONFIGURED'
        ? 'خدمة حفظ إعدادات العيادة غير مهيأة، تواصل مع الدعم'
        : 'تعذر حفظ إعدادات العيادة، حاول مرة أخرى' },
      { status: err?.message === 'FIREBASE_SERVER_NOT_CONFIGURED' ? 503 : 500 }
    )
  }
}
