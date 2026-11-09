import { NextRequest, NextResponse } from 'next/server'
import { getClinicDoctorAccount } from '@/lib/server/clinic-credential-access'
import { writeDocument, queryDocuments } from '@/lib/server/firebase-rest'
import { pickNormalClinicSettings } from '@/lib/clinic-credential-policy'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'
import { syncClinicScheduleToMainBranch, formatWeeklyScheduleSummary } from '@/lib/branchService'

/**
 * GET: Retrieve clinic settings safely via server REST.
 * Strips all passwords, password hashes, and sensitive administrative fields.
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

    const allClinics = await queryDocuments('clinics')
    const cDoc = allClinics.find((c: any) => c.slug === slug)
    if (!cDoc) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const clinicId = cDoc.id

    // Return safe data (strip sensitive credentials and password hashes)
    const {
      doctorPasswordHash,
      doctorPassword,
      assistantPasswordHash,
      assistantPassword,
      ...rawSafe
    } = cDoc

    const safeAssistants = Array.isArray(rawSafe.assistants)
      ? rawSafe.assistants.map((a: any) => {
          const { password, passwordHash, ...cleanA } = a
          return cleanA
        })
      : []

    const safeClinic = {
      ...rawSafe,
      id: clinicId,
      assistants: safeAssistants
    }

    return NextResponse.json({
      success: true,
      clinic: safeClinic
    })
  } catch (err: any) {
    console.error('Error in settings GET:', err)
    return NextResponse.json(
      { error: 'فشل في استرجاع إعدادات العيادة: ' + (err.message || '') },
      { status: 500 }
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
    await writeDocument(`clinics/${clinicId}`, cleanedPayload, true)

    // Sync schedule to main branch if weeklySchedule provided
    if (Array.isArray(cleanedPayload.weeklySchedule) && cleanedPayload.weeklySchedule.length > 0) {
      try {
        await syncClinicScheduleToMainBranch(
          clinicId,
          cleanedPayload.weeklySchedule,
          formatWeeklyScheduleSummary(cleanedPayload.weeklySchedule, true),
          {
            address: cleanedPayload.clinicAddress || cleanedPayload.address || '',
            mapsLink: cleanedPayload.mapsLink || '',
            latitude: cleanedPayload.latitude ? parseFloat(cleanedPayload.latitude) : undefined,
            longitude: cleanedPayload.longitude ? parseFloat(cleanedPayload.longitude) : undefined,
            phone: cleanedPayload.clinicPhone || (cleanedPayload.clinicPhones?.[0] || '')
          }
        )
      } catch (syncErr) {
        console.warn('Schedule sync warning in settings POST:', syncErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم حفظ كافة إعدادات العيادة بنجاح'
    })
  } catch (err: any) {
    console.error('Error in settings POST:', err)
    return NextResponse.json(
      { error: err?.message === 'FIREBASE_SERVER_NOT_CONFIGURED'
        ? 'خدمة حفظ إعدادات العيادة غير مهيأة، تواصل مع الدعم'
        : 'تعذر حفظ إعدادات العيادة، حاول مرة أخرى' },
      { status: err?.message === 'FIREBASE_SERVER_NOT_CONFIGURED' ? 503 : 500 }
    )
  }
}
