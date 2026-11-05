import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'
import { syncClinicScheduleToMainBranch, formatWeeklyScheduleSummary } from '@/lib/branchService'

/**
 * GET: Retrieve clinic settings safely.
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

    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const cDoc = cSnap.docs[0]
    const data = cDoc.data()
    const clinicId = cDoc.id

    // Return safe data (strip sensitive hashes)
    const { doctorPasswordHash, doctorPassword, assistantPasswordHash, assistantPassword, ...safeClinic } = data

    return NextResponse.json({
      success: true,
      clinic: { id: clinicId, ...safeClinic }
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
    const sessionToken =
      req.cookies.get('clinic_session')?.value ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'جلسة الدخول غير صالحة أو منتهية' }, { status: 401 })
    }

    const userRole = session.payload.role
    if (userRole !== 'doctor' && userRole !== 'owner') {
      return NextResponse.json({ error: 'تعديل إعدادات العيادة متاح فقط للطبيب أو مالك المنصة' }, { status: 403 })
    }

    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const cDoc = cSnap.docs[0]
    const clinicId = cDoc.id

    const body = await req.json().catch(() => ({}))

    // Disallow password mutations through normal settings save
    const {
      newDoctorPassword,
      currentDoctorPassword,
      doctorPassword,
      doctorPasswordHash,
      assistantPassword,
      assistantPasswordHash,
      ...safePayload
    } = body

    safePayload.updatedAt = new Date().toISOString()

    // Remove any undefined values
    const cleanedPayload: Record<string, any> = Object.fromEntries(
      Object.entries(safePayload).filter(([_, v]) => v !== undefined)
    )

    await updateDoc(doc(db, 'clinics', clinicId), cleanedPayload)

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
      { error: 'فشل في حفظ إعدادات العيادة: ' + (err.message || '') },
      { status: 500 }
    )
  }
}
