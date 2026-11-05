import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'
import { Branch, BranchScheduleDay } from '@/types/clinic'
import { DEFAULT_WEEKLY_SCHEDULE, formatWeeklyScheduleSummary } from '@/lib/branchService'
import { sanitizeAddress } from '@/lib/mapsHelper'

/**
 * Helper to fetch all branches for a clinic doc ID.
 * Looks for both clinicId and clinic_id fields for complete backward and forward compatibility.
 */
async function fetchBranchesForClinic(clinicId: string): Promise<Branch[]> {
  const branchesRef = collection(db, 'branches')
  const [snap1, snap2] = await Promise.all([
    getDocs(query(branchesRef, where('clinicId', '==', clinicId))),
    getDocs(query(branchesRef, where('clinic_id', '==', clinicId)))
  ])

  const map = new Map<string, Branch>()
  snap1.docs.forEach((d) => {
    map.set(d.id, { id: d.id, ...(d.data() as any) })
  })
  snap2.docs.forEach((d) => {
    map.set(d.id, { id: d.id, ...(d.data() as any) })
  })

  return Array.from(map.values()).filter((b) => !b.isArchived)
}

/**
 * GET: Retrieve all active branches for a clinic.
 * If none exist, automatically provisions the default main branch and returns it.
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

    let clinic: any = null
    let clinicId = slug

    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (!cSnap.empty) {
        clinic = cSnap.docs[0].data()
        clinicId = cSnap.docs[0].id
      }
    } catch (dbErr) {
      console.warn('Firestore clinics lookup failed, proceeding with fallback:', dbErr)
    }

    let branches: Branch[] = []
    try {
      branches = await fetchBranchesForClinic(clinicId)
    } catch (bErr) {
      console.warn('fetchBranchesForClinic failed:', bErr)
    }

    // Fallback: If no branches exist, return or provision the default Main Branch
    if (branches.length === 0) {
      const schedule: BranchScheduleDay[] =
        Array.isArray(clinic?.weeklySchedule) && clinic.weeklySchedule.length > 0
          ? clinic.weeklySchedule
          : DEFAULT_WEEKLY_SCHEDULE

      const defaultBranchData: any = {
        clinicId,
        clinic_id: clinicId,
        name: 'الفرع الرئيسي',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: '',
        address: sanitizeAddress(clinic?.clinicAddress || clinic?.address) || 'مقر العيادة الرئيسي',
        mapsLink: clinic?.mapsLink || '',
        phone: clinic?.clinicPhone || (clinic?.clinicPhones?.[0] || '01012345678'),
        whatsapp: clinic?.clinicPhone || '',
        weeklySchedule: schedule,
        workingHours: formatWeeklyScheduleSummary(schedule, true),
        slotDuration: Number(clinic?.averageVisitTime) || 15,
        maxDailyBookings: Number(clinic?.maxDailyBookings) || 0,
        services: Array.isArray(clinic?.services) && clinic.services.length > 0
          ? clinic.services
          : [
              { id: '1', name: 'كشف عادي', price: 250, duration: '15 دقيقة' },
              { id: '2', name: 'استشارة', price: 150, duration: '10 دقائق' },
              { id: '3', name: 'كشف مستعجل', price: 400, duration: 'فوري' }
            ],
        isOpen: clinic?.isClinicOpen !== false,
        isArchived: false,
        isMain: true,
        createdAt: new Date().toISOString()
      }

      try {
        const newDocRef = await addDoc(collection(db, 'branches'), defaultBranchData)
        branches = [{ id: newDocRef.id, ...defaultBranchData }]
      } catch (createErr) {
        console.warn('Could not persist default branch to Firestore, returning in-memory branch:', createErr)
        branches = [{ id: 'main-branch-' + slug, ...defaultBranchData }]
      }
    }

    return NextResponse.json({
      success: true,
      branches
    })
  } catch (err: any) {
    console.error('Error in branches GET:', err)
    return NextResponse.json(
      { error: 'فشل في استرجاع فروع العيادة: ' + (err.message || '') },
      { status: 500 }
    )
  }
}

/**
 * POST: Create or update a branch.
 * Requires authenticated doctor or assistant session.
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

    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const cDoc = cSnap.docs[0]
    const clinic = cDoc.data()
    const clinicId = cDoc.id

    const body = await req.json().catch(() => ({}))
    const {
      id: branchId,
      name,
      governorate,
      city,
      area,
      address,
      mapsLink,
      latitude,
      longitude,
      phone,
      whatsapp,
      image,
      slotDuration,
      maxDailyBookings,
      isOpen,
      weeklySchedule,
      isMain
    } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'اسم الفرع مطلوب' }, { status: 400 })
    }

    const schedule = Array.isArray(weeklySchedule) && weeklySchedule.length > 0
      ? weeklySchedule
      : DEFAULT_WEEKLY_SCHEDULE

    const branchPayload: any = {
      clinicId,
      clinic_id: clinicId,
      name: String(name).trim(),
      governorate: governorate || 'القاهرة',
      city: city || 'القاهرة',
      area: area || '',
      address: sanitizeAddress(address) || 'عنوان الفرع',
      mapsLink: mapsLink || '',
      latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : null,
      phone: phone || '',
      whatsapp: whatsapp || '',
      image: image || '',
      slotDuration: Number(slotDuration) || 15,
      maxDailyBookings: Number(maxDailyBookings) || 0,
      isOpen: isOpen !== false,
      weeklySchedule: schedule,
      workingHours: formatWeeklyScheduleSummary(schedule, true),
      isMain: Boolean(isMain),
      updatedAt: new Date().toISOString()
    }

    if (branchId && typeof branchId === 'string' && branchId !== 'new') {
      // Update existing branch
      await updateDoc(doc(db, 'branches', branchId), branchPayload)
      return NextResponse.json({
        success: true,
        branch: { id: branchId, ...branchPayload }
      })
    } else {
      // Create new branch
      branchPayload.isArchived = false
      branchPayload.createdAt = new Date().toISOString()
      const docRef = await addDoc(collection(db, 'branches'), branchPayload)
      return NextResponse.json({
        success: true,
        branch: { id: docRef.id, ...branchPayload }
      })
    }
  } catch (err: any) {
    console.error('Error in branches POST:', err)
    return NextResponse.json(
      { error: 'فشل في حفظ بيانات الفرع: ' + (err.message || '') },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Soft-archive a branch.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const sessionToken =
      req.cookies.get('clinic_session')?.value ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'جلسة الدخول غير صالحة' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    if (!branchId) {
      return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    await updateDoc(doc(db, 'branches', branchId), {
      isArchived: true,
      updatedAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true, message: 'تم أرشفة الفرع بنجاح' })
  } catch (err: any) {
    console.error('Error in branches DELETE:', err)
    return NextResponse.json(
      { error: 'فشل في أرشفة الفرع: ' + (err.message || '') },
      { status: 500 }
    )
  }
}
