import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/owner-session'
import { Branch, BranchScheduleDay } from '@/types/clinic'
import { DEFAULT_WEEKLY_SCHEDULE, formatWeeklyScheduleSummary } from '@/lib/branchService'
import { sanitizeAddress } from '@/lib/mapsHelper'
import { queryDocuments } from '@/lib/server/firebase-rest'

/**
 * Helper to fetch all branches for a clinic doc ID.
 * Looks for both clinicId and clinic_id fields for complete compatibility.
 */
async function fetchBranchesForClinic(clinicId: string, slug?: string): Promise<Branch[]> {
  const map = new Map<string, Branch>()

  try {
    const branchesRef = collection(db, 'branches')
    const [snap1, snap2] = await Promise.all([
      getDocs(query(branchesRef, where('clinicId', '==', clinicId))),
      getDocs(query(branchesRef, where('clinic_id', '==', clinicId)))
    ])

    snap1.docs.forEach((d) => {
      map.set(d.id, { id: d.id, ...(d.data() as any) })
    })
    snap2.docs.forEach((d) => {
      map.set(d.id, { id: d.id, ...(d.data() as any) })
    })
  } catch (clientErr) {
    console.warn('Client SDK fetch branches failed, falling back to server REST:', clientErr)
  }

  // Fallback to server REST if client SDK failed or returned empty
  if (map.size === 0) {
    try {
      const restBranches = await queryDocuments('branches')
      for (const b of restBranches) {
        if (
          b.clinicId === clinicId ||
          b.clinic_id === clinicId ||
          (slug && (b.clinicId === slug || b.clinic_id === slug))
        ) {
          map.set(b.id, b as unknown as Branch)
        }
      }
    } catch (restErr) {
      console.warn('REST fetch branches failed:', restErr)
    }
  }

  return Array.from(map.values()).filter((b) => !b.isArchived)
}

/**
 * Verify caller identity: Platform Owner OR Doctor/Assistant for this clinic.
 */
async function authenticateCaller(req: NextRequest, clinicSlug: string, clinicId: string) {
  let isOwner = false
  let isClinicStaff = false

  // 1. Check Owner session cookie
  const ownerCookie = req.cookies.get(OWNER_COOKIE)?.value
  if (ownerCookie) {
    const secret = process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
    if (secret.length >= 32) {
      try {
        const owner = await verifyOwnerSession(ownerCookie, secret)
        if (owner && (!process.env.PLATFORM_OWNER_UID || owner.uid === process.env.PLATFORM_OWNER_UID)) {
          isOwner = true
        }
      } catch {}
    }
  }

  // 2. Check Clinic session token
  const sessionToken =
    req.cookies.get('clinic_session')?.value ||
    req.headers.get('Authorization')?.replace('Bearer ', '')

  if (sessionToken) {
    try {
      const session = await verifySessionToken(sessionToken)
      if (session.valid && session.payload) {
        // A clinic session is never sufficient to claim platform-owner privileges.
        // Only a verified OWNER_COOKIE can authorize platform-wide operations.
        if (
          session.payload.slug === clinicSlug ||
          session.payload.clinicId === clinicId ||
          session.payload.clinicId === clinicSlug
        ) {
          isClinicStaff = true
        }
      }
    } catch {}
  }

  return { isOwner, isClinicStaff, isAuthorized: isOwner || isClinicStaff }
}

/**
 * GET: Retrieve all active branches for a clinic.
 * Returns actual registered branches without phantom auto-creation.
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

    let clinicId = slug
    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (!cSnap.empty) {
        clinicId = cSnap.docs[0].id
      }
    } catch (dbErr) {
      console.warn('Firestore clinics lookup failed, proceeding with fallback:', dbErr)
    }

    const branches = await fetchBranchesForClinic(clinicId, slug)

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
 * Enforces permissions: Owner can manage any branch, Doctor respects allowDoctorCreateBranches and quota.
 */
export async function POST(
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
    const clinic = cDoc.data()
    const clinicId = cDoc.id

    const auth = await authenticateCaller(req, slug, clinicId)
    if (!auth.isAuthorized) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

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

    const isCreating = !branchId || branchId === 'new'

    // Doctor Permission & Quota Checks
    if (!auth.isOwner) {
      if (isCreating) {
        if (clinic.allowDoctorCreateBranches === false) {
          return NextResponse.json(
            { error: 'إضافة الفروع مقيدة بواسطة إدارة المنصة.' },
            { status: 403 }
          )
        }
        if (clinic.branchesEnabled === false) {
          return NextResponse.json(
            { error: 'ميزة الفروع غير مفعلة لاشتراك العيادة. يرجى التواصل مع الدعم.' },
            { status: 403 }
          )
        }

        const maxBranches = typeof clinic.maxBranches === 'number' ? clinic.maxBranches : 1
        const currentBranches = await fetchBranchesForClinic(clinicId, slug)
        if (currentBranches.length >= maxBranches) {
          return NextResponse.json(
            {
              error: `تم الوصول للحد الأقصى المسموح به من الفروع لهذه العيادة (${maxBranches} فرع). يرجى الترقية لإضافة فروع جديدة.`
            },
            { status: 403 }
          )
        }
      }
    }

    if ((isCreating || Object.prototype.hasOwnProperty.call(body, 'name')) && (!name || !String(name).trim())) {
      return NextResponse.json({ error: 'اسم الفرع مطلوب' }, { status: 400 })
    }

    const schedule =
      Array.isArray(weeklySchedule) && weeklySchedule.length > 0
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

    if (!isCreating) {
      // Some legacy clinics displayed a virtual branch with id="main" even though
      // Firestore has no document at branches/main. Resolve its real document ID.
      const legacyMain = branchId === 'main' || String(branchId).startsWith('main-branch-')
      let resolvedId: string = branchId
      let branchRef = doc(db, 'branches', resolvedId)
      let existing = await getDoc(branchRef)

      if (!existing.exists() && legacyMain) {
        const registered = await fetchBranchesForClinic(clinicId, slug)
        for (const candidate of registered.filter((b) => b.isMain || b.name === 'الفرع الرئيسي')) {
          const candidateRef = doc(db, 'branches', candidate.id)
          const candidateDoc = await getDoc(candidateRef)
          if (candidateDoc.exists()) {
            branchRef = candidateRef
            resolvedId = candidate.id
            existing = candidateDoc
            break
          }
        }
        if (!existing.exists()) {
          // Create the missing main branch once using a deterministic, clinic-scoped ID.
          // Do not create/update a shared global "main" document.
          resolvedId = `main-${clinicId}`
          branchRef = doc(db, 'branches', resolvedId)
          existing = await getDoc(branchRef)
          if (!existing.exists()) {
            const seed = {
              ...branchPayload,
              clinicId,
              clinic_id: clinicId,
              name: String(name || clinic.clinicName || 'الفرع الرئيسي').trim(),
              address: sanitizeAddress(address || clinic.clinicAddress || clinic.address) || 'مقر العيادة',
              mapsLink: mapsLink || clinic.mapsLink || '',
              phone: phone || clinic.clinicPhone || '',
              weeklySchedule: Array.isArray(weeklySchedule) && weeklySchedule.length > 0
                ? weeklySchedule
                : (clinic.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE),
              isMain: true,
              isArchived: false,
              createdAt: new Date().toISOString()
            }
            await setDoc(branchRef, {
              ...seed,
              workingHours: formatWeeklyScheduleSummary(seed.weeklySchedule, true)
            })
            existing = await getDoc(branchRef)
          }
        }
      }

      if (!existing.exists()) {
        return NextResponse.json({ error: 'هذا الفرع غير موجود. حدّث قائمة الفروع ثم حاول مجددًا.' }, { status: 404 })
      }
      const oldBranch = existing.data()
      // Ownership must be checked even for the platform owner to prevent
      // modifying a different clinic via a forged branch ID.
      if (![oldBranch.clinicId, oldBranch.clinic_id].includes(clinicId)) {
        return NextResponse.json({ error: 'الفرع لا يتبع العيادة المحددة' }, { status: 403 })
      }
      if (oldBranch.isArchived === true) {
        return NextResponse.json({ error: 'الفرع مؤرشف ولا يقبل التعديل' }, { status: 409 })
      }

      // PATCH semantics: a status-only update must not wipe the schedule,
      // map coordinates, contacts, photo, or main-branch flag.
      const editableFields = [
        'name', 'governorate', 'city', 'area', 'address', 'mapsLink',
        'latitude', 'longitude', 'phone', 'whatsapp', 'image',
        'slotDuration', 'maxDailyBookings', 'isOpen', 'weeklySchedule'
      ]
      const patch: Record<string, any> = { updatedAt: new Date().toISOString() }
      for (const key of editableFields) {
        if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = branchPayload[key]
      }
      if (Object.prototype.hasOwnProperty.call(body, 'weeklySchedule')) {
        patch.workingHours = formatWeeklyScheduleSummary(patch.weeklySchedule, true)
      }
      if (auth.isOwner && Object.prototype.hasOwnProperty.call(body, 'isMain')) {
        patch.isMain = Boolean(body.isMain)
      }

      await updateDoc(branchRef, patch)
      return NextResponse.json({
        success: true,
        branch: { id: resolvedId, ...oldBranch, ...patch }
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
 * DELETE: Soft-archive a branch safely without deleting historical appointment or financial data.
 */
export async function DELETE(
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
    const clinicId = cDoc.id

    const auth = await authenticateCaller(req, slug, clinicId)
    if (!auth.isAuthorized) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    if (!branchId) {
      return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    // Never allow archiving a branch of a different clinic, even as platform owner.
    const targetBranch = await getDoc(doc(db, 'branches', branchId))
    if (!targetBranch.exists()) return NextResponse.json({ error: 'الفرع غير موجود' }, { status: 404 })
    const targetData = targetBranch.data()
    if (![targetData.clinicId, targetData.clinic_id].includes(clinicId)) {
      return NextResponse.json({ error: 'الفرع لا يتبع العيادة المحددة' }, { status: 403 })
    }
    if (targetData.isMain) {
      return NextResponse.json({ error: 'لا يمكن أرشفة الفرع الرئيسي' }, { status: 409 })
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
