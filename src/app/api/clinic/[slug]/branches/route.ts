import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { authenticateOwnerRequest, assertSameOrigin } from '@/lib/server/owner-access'
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/owner-session'
import { Branch, BranchScheduleDay } from '@/types/clinic'
import { DEFAULT_WEEKLY_SCHEDULE, formatWeeklyScheduleSummary } from '@/lib/branchService'
import { sanitizeAddress } from '@/lib/mapsHelper'
import { canonicalizeBranches, mainBranchDuplicateKey } from '@/lib/branchCanonical'
import { queryDocumentsByField, readDocument, writeDocument, createDocument, commitDocumentPatches } from '@/lib/server/firebase-rest'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'

/**
 * Helper to fetch all branches for a clinic doc ID.
 * Looks for both clinicId and clinic_id fields for complete compatibility.
 */
async function fetchBranchesForClinic(clinicId: string, slug?: string, includeArchived = false): Promise<Branch[]> {
  // Server credentials are required after client Firestore access was restricted.
  // Never silently return an empty list if the database is unavailable.
  const groups = await Promise.all([
    queryDocumentsByField('branches', 'clinicId', clinicId),
    queryDocumentsByField('branches', 'clinic_id', clinicId),
    ...(slug && slug !== clinicId ? [queryDocumentsByField('branches', 'clinicId', slug),
      queryDocumentsByField('branches', 'clinic_id', slug)] : []),
  ])
  const matches = [...new Map(groups.flat().map(b => [b.id, b])).values()]

  return matches.filter((b: any) => includeArchived || b.isArchived !== true) as unknown as Branch[]
}

async function findClinicBySlug(slug: string): Promise<any | null> {
  return (await queryDocumentsByField('clinics', 'slug', slug))[0] || null
}

/**
 * Verify caller identity: Platform Owner OR Doctor/Assistant for this clinic.
 */
async function authenticateCaller(req: NextRequest, clinicSlug: string, clinicId: string) {
  if (req.method !== 'GET') assertSameOrigin(req)
  const owner = await authenticateOwnerRequest(req).catch(() => null)
  if (owner) return { isOwner: true, isClinicStaff: false, isAuthorized: true }
  const staff = await getCurrentClinicStaff(req, clinicSlug)
  const isClinicStaff = Boolean(staff && staff.clinicId === clinicId && staff.user.role === 'doctor')
  return { isOwner: false, isClinicStaff, isAuthorized: isClinicStaff }
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

    const clinic = await findClinicBySlug(slug)
    if (!clinic) return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    const clinicId = String(clinic.id)

    const management = req.nextUrl.searchParams.get('view') === 'management'
    if (management) {
      const auth = await authenticateCaller(req, slug, clinicId)
      if (!auth.isOwner) {
        return NextResponse.json({ error: 'إدارة الفروع المؤرشفة متاحة لمالك المنصة فقط' }, { status: 403 })
      }
    }
    const registered = await fetchBranchesForClinic(clinicId, slug, management)
    const branches = management ? registered : canonicalizeBranches(registered)

    return NextResponse.json({
      success: true,
      branches
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    })
  } catch (err: any) {
    console.error('Error in branches GET:', err)
    return NextResponse.json(
      { error: 'تعذر استرجاع فروع العيادة. حاول مرة أخرى.' },
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

    const clinic = await findClinicBySlug(slug)
    if (!clinic) return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    const clinicId = String(clinic.id)

    const auth = await authenticateCaller(req, slug, clinicId)
    if (!auth.isAuthorized) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }
    if (!auth.isOwner && isClinicSuspended(clinic)) {
      return NextResponse.json({ error: 'الاشتراك منتهي. يمكنك عرض الحسابات والتقارير وسجل المرضى فقط.' }, { status: 403 })
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
      isMain,
      locationVerified,
      verifiedMapsLink
    } = body

    if (branchId && (typeof branchId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(branchId))) {
      return NextResponse.json({ error: 'معرف الفرع غير صالح' }, { status: 400 })
    }
    if (Object.hasOwn(body, 'isOpen') && typeof isOpen !== 'boolean') {
      return NextResponse.json({ error: 'حالة الحجز يجب أن تكون مفتوحًا أو مغلقًا' }, { status: 400 })
    }
    if (Object.hasOwn(body, 'slotDuration') && (!Number.isFinite(Number(slotDuration)) || Number(slotDuration) < 1 || Number(slotDuration) > 240)) {
      return NextResponse.json({ error: 'مدة الكشف يجب أن تكون بين 1 و240 دقيقة' }, { status: 400 })
    }
    if (Object.hasOwn(body, 'maxDailyBookings') && (!Number.isInteger(Number(maxDailyBookings)) || Number(maxDailyBookings) < 0 || Number(maxDailyBookings) > 10000)) {
      return NextResponse.json({ error: 'الحد اليومي غير صالح' }, { status: 400 })
    }
    const isCreating = !branchId || branchId === 'new'

    // The platform owner registers physical branch locations. Doctors operate
    // already-registered branches but may not create new ones.
    if (isCreating && !auth.isOwner) {
      return NextResponse.json({ error: 'إضافة فروع جديدة متاحة فقط لمالك المنصة.' }, { status: 403 })
    }

    // Doctors may update ONLY operation-specific fields. Never allow a doctor
    // to replace the owner's branch identity, address, coordinates or map URL.
    if (!auth.isOwner && !isCreating) {
      const doctorAllowed = new Set([
        'id', 'isOpen', 'weeklySchedule', 'slotDuration', 'maxDailyBookings', 'isMain'
      ])
      for (const key of Object.keys(body)) {
        if (!doctorAllowed.has(key)) {
          return NextResponse.json({
            error: 'يمكن للطبيب تعديل مواعيد الفرع ومدة الكشف والحد اليومي وحالة الحجز فقط'
          }, { status: 403 })
        }
      }
    }

    if ((isCreating || Object.prototype.hasOwnProperty.call(body, 'name')) && (!name || !String(name).trim())) {
      return NextResponse.json({ error: 'اسم الفرع مطلوب' }, { status: 400 })
    }

    if (auth.isOwner && locationVerified === true) {
      const lat = Number(latitude)
      const lng = Number(longitude)
      if (latitude == null || longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return NextResponse.json({ error: 'إحداثيات الفرع المؤكدة غير صالحة' }, { status: 400 })
      }
    }

    const schedule =
      Array.isArray(weeklySchedule) && weeklySchedule.length > 0
        ? weeklySchedule
        : DEFAULT_WEEKLY_SCHEDULE

    const branchPayload: any = {
      clinicId,
      clinic_id: clinicId,
      name: typeof name === 'string' ? name.trim() : '',
      governorate: governorate || 'القاهرة',
      city: city || 'القاهرة',
      area: area || '',
      address: sanitizeAddress(address) || 'عنوان الفرع',
      mapsLink: mapsLink || '',
      latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : null,
      locationVerified: locationVerified === true,
      verifiedMapsLink: locationVerified === true ? String(verifiedMapsLink || mapsLink || '').trim() : '',
      phone: phone || '',
      whatsapp: whatsapp || '',
      image: image || '',
      slotDuration: Number(slotDuration) || 15,
      maxDailyBookings: Number(maxDailyBookings) || 0,
      // Branches registered by the owner start closed until doctor configures them.
      isOpen: isCreating && auth.isOwner ? false : isOpen !== false,
      weeklySchedule: isCreating && auth.isOwner
        ? DEFAULT_WEEKLY_SCHEDULE.map(day => ({ ...day, isOpen: false }))
        : schedule,
      workingHours: isCreating && auth.isOwner
        ? 'لم يحدد الطبيب مواعيد هذا الفرع بعد'
        : formatWeeklyScheduleSummary(schedule, true),
      isMain: Boolean(isMain),
      updatedAt: new Date().toISOString()
    }

    if (!isCreating) {
      // Some legacy clinics displayed a virtual branch with id="main" even though
      // Firestore has no document at branches/main. Resolve its real document ID.
      const legacyMain = branchId === 'main' || String(branchId).startsWith('main-branch-')
      let resolvedId: string = branchId
      let existing = await readDocument(`branches/${resolvedId}`)

      if (!existing && legacyMain) {
        const registered = await fetchBranchesForClinic(clinicId, slug)
        for (const candidate of registered.filter((b) => b.isMain || b.name === 'الفرع الرئيسي')) {
          const candidateDoc = await readDocument(`branches/${candidate.id}`)
          if (candidateDoc) {
            resolvedId = candidate.id
            existing = candidateDoc
            break
          }
        }
        // Never manufacture a second branch as a side effect of editing or toggling.
        // The Platform Owner must explicitly register the missing main branch.
      }

      if (!existing) {
        return NextResponse.json({ error: 'هذا الفرع غير موجود. حدّث قائمة الفروع ثم حاول مجددًا.' }, { status: 404 })
      }
      const oldBranch = existing
      // Ownership must be checked even for the platform owner to prevent
      // modifying a different clinic via a forged branch ID.
      if (![oldBranch.clinicId, oldBranch.clinic_id].includes(clinicId)) {
        return NextResponse.json({ error: 'الفرع لا يتبع العيادة المحددة' }, { status: 403 })
      }
      const restoreArchived = auth.isOwner && body.isArchived === false
      if (oldBranch.isArchived === true && !restoreArchived) {
        return NextResponse.json({ error: 'الفرع مؤرشف ولا يقبل التعديل' }, { status: 409 })
      }

      // PATCH semantics: a status-only update must not wipe the schedule,
      // map coordinates, contacts, photo, or main-branch flag.
      const editableFields = auth.isOwner
        ? ['name', 'governorate', 'city', 'area', 'address', 'mapsLink',
          'latitude', 'longitude', 'locationVerified', 'verifiedMapsLink', 'phone', 'whatsapp', 'image',
          'slotDuration', 'maxDailyBookings', 'isOpen', 'weeklySchedule']
        : ['slotDuration', 'maxDailyBookings', 'isOpen', 'weeklySchedule']
      const patch: Record<string, any> = { updatedAt: new Date().toISOString() }
      for (const key of editableFields) {
        if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = branchPayload[key]
      }
      if (Object.prototype.hasOwnProperty.call(body, 'weeklySchedule')) {
        patch.workingHours = formatWeeklyScheduleSummary(patch.weeklySchedule, true)
      }
      if (restoreArchived) patch.isArchived = false

      // A single atomic batch prevents the old and new primary branches from
      // both remaining primary. A plain isMain:false request is rejected.
      if (Object.prototype.hasOwnProperty.call(body, 'isMain') && body.isMain === false) {
        return NextResponse.json({
          error: 'اختر الفرع الرئيسي البديل بدلاً من إلغاء الرئيسي بدون بديل.'
        }, { status: 400 })
      }
      if (body.isMain === true) {
        if (oldBranch.isArchived === true) {
          return NextResponse.json({ error: 'لا يمكن تعيين فرع مؤرشف كرئيسي' }, { status: 409 })
        }
        const registered = await fetchBranchesForClinic(clinicId, slug)
        if (!registered.some((item) => item.id === resolvedId)) {
          return NextResponse.json({ error: 'الفرع المحدد غير موجود بالقائمة المسجلة' }, { status: 404 })
        }
        const timestamp = new Date().toISOString()
        await commitDocumentPatches(registered.map((item) => ({
          path: `branches/${item.id}`,
          data: { isMain: item.id === resolvedId, updatedAt: timestamp }
        })))
      }

      await writeDocument(`branches/${resolvedId}`, patch, true)
      return NextResponse.json({
        success: true,
        branch: { ...oldBranch, ...patch, id: resolvedId, ...(body.isMain === true ? { isMain: true } : {}) }
      })
    } else {
      // Create new branch
      branchPayload.isArchived = false
      branchPayload.createdAt = new Date().toISOString()
      // Enforce owner-specified clinic quota for branch creation.
      const maxAllowed = Math.max(1, Number(clinic.maxBranches ?? clinic.branchQuota ?? 1))
      const existingBranches = canonicalizeBranches(await fetchBranchesForClinic(clinicId, slug))
      if (existingBranches.length >= maxAllowed) {
        return NextResponse.json({ error: `اكتمل الحد المسموح به من الفروع (${maxAllowed})` }, { status: 403 })
      }
      // New branches cannot silently steal the primary designation. First
      // created branch becomes primary; others are promoted via atomic update.
      branchPayload.isMain = existingBranches.length === 0
      const newBranchId = await createDocument('branches', branchPayload)
      return NextResponse.json({
        success: true,
        branch: { id: newBranchId, ...branchPayload }
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

    const clinic = await findClinicBySlug(slug)
    if (!clinic) return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    const clinicId = String(clinic.id)

    const auth = await authenticateCaller(req, slug, clinicId)
    if (!auth.isOwner) {
      return NextResponse.json({ error: 'أرشفة الفروع متاحة لمالك المنصة فقط' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    if (!branchId) {
      return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    // Never allow archiving a branch of a different clinic, even as platform owner.
    const targetBranch = await readDocument(`branches/${branchId}`)
    if (!targetBranch) return NextResponse.json({ error: 'الفرع غير موجود' }, { status: 404 })
    const targetData = targetBranch
    if (![targetData.clinicId, targetData.clinic_id].includes(clinicId)) {
      return NextResponse.json({ error: 'الفرع لا يتبع العيادة المحددة' }, { status: 403 })
    }
    if (targetData.isMain && targetData.isArchived !== true) {
      const remainingBranches = (await fetchBranchesForClinic(clinicId, slug))
        .filter((branch) => branch.id !== branchId)
      const mainKey = mainBranchDuplicateKey({ ...targetData, id: branchId })
      const hasAnotherMain = !!mainKey && remainingBranches.some(
        (branch) => mainBranchDuplicateKey(branch) === mainKey
      )
      if (remainingBranches.length > 0 && !hasAnotherMain) {
        return NextResponse.json({
          error: 'لا يمكن أرشفة الفرع الرئيسي الوحيد. يمكنك أرشفة النسخة المكررة فقط.'
        }, { status: 409 })
      }
    }

    await writeDocument(`branches/${branchId}`, {
      isArchived: true,
      updatedAt: new Date().toISOString()
    }, true)

    return NextResponse.json({ success: true, message: 'تم أرشفة الفرع بنجاح' })
  } catch (err: any) {
    console.error('Error in branches DELETE:', err)
    return NextResponse.json(
      { error: 'فشل في أرشفة الفرع: ' + (err.message || '') },
      { status: 500 }
    )
  }
}
