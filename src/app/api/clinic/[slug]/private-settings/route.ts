import { NextRequest, NextResponse } from 'next/server'
import { getClinicDoctorAccount } from '@/lib/server/clinic-credential-access'
import { authenticateOwnerRequest } from '@/lib/server/owner-access'
import { readDocument, queryDocuments } from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

/**
 * GET: Retrieve private administrative clinic settings.
 * Strictly requires authentication as the Clinic Doctor or Platform Owner.
 * Never accessible by unauthenticated visitors or public booking pages.
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

    // 1. Authorize: either Platform Owner or verified Clinic Doctor
    let clinicDoc: any = null
    let clinicId = ''

    const doctorAccount = await getClinicDoctorAccount(req, slug).catch(() => null)
    if (doctorAccount && doctorAccount.ok) {
      clinicDoc = doctorAccount.clinic
      clinicId = doctorAccount.clinicId
    } else {
      // Check platform owner
      const owner = await authenticateOwnerRequest(req).catch(() => null)
      if (owner) {
        const allClinics = await queryDocuments('clinics')
        const found = allClinics.find((c: any) => c.slug === slug || c.id === slug)
        if (found) {
          clinicDoc = found
          clinicId = found.id
        }
      }
    }

    if (!clinicDoc) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول لإعدادات العيادة الخاصة. يرجى تسجيل الدخول.' },
        { status: 401 }
      )
    }

    // Strip password hashes before returning
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
    } = clinicDoc

    const safeAssistants = Array.isArray(rawSafe.assistants)
      ? rawSafe.assistants.map((a: any) => {
          const { password, passwordHash, ...cleanA } = a
          return cleanA
        })
      : []

    const privateClinic = {
      ...rawSafe,
      id: clinicId,
      assistants: safeAssistants
    }

    return NextResponse.json({
      success: true,
      clinic: privateClinic
    })
  } catch (err: any) {
    console.error('Error in private-settings GET:', err)
    return NextResponse.json(
      { error: 'تعذر استرجاع الإعدادات الخاصة بالعيادة' },
      { status: 500 }
    )
  }
}
