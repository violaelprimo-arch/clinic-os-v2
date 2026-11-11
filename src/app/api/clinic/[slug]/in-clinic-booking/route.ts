import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import {
  createAtomicAppointmentServer,
  isFirestoreQuotaError,
  queryDocumentsByFields,
  readDocument,
  writeDocument,
} from '@/lib/server/firebase-rest'
import {
  getOrHydrateDayFromRoom,
  upsertAppointmentInRoom,
} from '@/lib/server/queue-room-client'
import { createServerNotification } from '@/lib/server/clinic-notifications'
import { calculatePatientLivePosition } from '@/lib/queueCalculations'
import {
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  getCairoDateString,
  findNearestAvailableDate,
  validateBookingAvailability,
  CAPACITY_FULL_MESSAGE
} from '@/lib/bookingCapacity'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!sameOriginMutation(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    }

    const resolvedParams = await params
    const slug = resolvedParams.slug

    // 1. Authenticate doctor/assistant against active clinic credentials & branch
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    const userRole = String(staff.user.role || '')
    if (userRole !== 'doctor' && userRole !== 'assistant') {
      return NextResponse.json({ error: 'صلاحيات غير كافية لإجراء الحجز الداخلي' }, { status: 403 })
    }

    const clinic = staff.clinic
    const clinicId = staff.clinicId

    if (isClinicSuspended(clinic)) {
      return NextResponse.json({ error: 'الاشتراك منتهي ولا يمكن إنشاء حجوزات جديدة' }, { status: 403 })
    }

    // Assistant assistantPermissions check
    if (userRole === 'assistant') {
      const permissions = Array.isArray(clinic.assistantPermissions)
        ? clinic.assistantPermissions
        : ['appointments']
      if (!permissions.includes('appointments') && !permissions.includes('in-clinic-booking')) {
        return NextResponse.json({ error: 'ليس لديك صلاحية لتسجيل الحجوزات' }, { status: 403 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const {
      patientName,
      phone,
      age,
      birthDate,
      gender = 'أنثى',
      branchId,
      serviceId,
      date,
      time,
      paymentMethod = 'cash',
      paymentStatus = 'unpaid',
      notes,
      residence
    } = body

    // 3. Validate mandatory fields
    if (!patientName || !String(patientName).trim()) {
      return NextResponse.json({ error: 'اسم المريض مطلوب' }, { status: 400 })
    }
    if (!phone || !String(phone).trim()) {
      return NextResponse.json({ error: 'رقم هاتف المريض مطلوب' }, { status: 400 })
    }

    const cleanName = String(patientName).trim()
    const cleanPhone = String(phone).trim().replace(/\s+/g, '')

    // 4. Branch Restriction Check
    const lockedBranchId = staff.user.branchId
    let effectiveBranchId = branchId || lockedBranchId || null

    if (userRole === 'assistant' && lockedBranchId) {
      if (branchId && branchId !== lockedBranchId) {
        return NextResponse.json(
          { error: 'غير مصرح لك بتسجيل حجز لفرع آخر غير الفرع المقيد به حسابك' },
          { status: 403 }
        )
      }
      effectiveBranchId = lockedBranchId
    }

    // Resolve branch details from server REST
    let branchName = 'الفرع الرئيسي'
    let bData: any = null
    if (effectiveBranchId) {
      try {
        const bDoc = await readDocument(`branches/${effectiveBranchId}`)
        if (bDoc) {
          bData = bDoc
          if (bData.isArchived) {
            return NextResponse.json({ error: 'هذا الفرع مؤرشف حاليًا وغير متاح للحجز' }, { status: 400 })
          }
          branchName = bData.name || branchName
        } else if (clinic.branches && Array.isArray(clinic.branches)) {
          const found = clinic.branches.find((b: any) => b.id === effectiveBranchId)
          if (found) {
            bData = found
            branchName = found.name || branchName
          }
        }
      } catch (err) {
        console.warn('Branch fetch warning:', err)
      }
    }

    // 5. Service & Pricing Verification from Database
    const clinicServices = Array.isArray(clinic.services) && clinic.services.length > 0
      ? clinic.services
      : [
          { id: '1', name: 'كشف عادي', price: 250 },
          { id: '2', name: 'استشارة', price: 150 },
          { id: '3', name: 'كشف مستعجل', price: 400 },
          { id: '4', name: 'متابعة دورية', price: 100 }
        ]

    const targetService = clinicServices.find((s: any) => String(s.id) === String(serviceId)) || clinicServices[0]
    const verifiedServiceId = String(targetService.id)
    const verifiedServiceName = String(targetService.name || 'كشف عيادة')
    // Server-enforced price from database
    const verifiedServicePrice = Number(targetService.price) || 0

    const isUrgent =
      Boolean(targetService.isUrgent) ||
      verifiedServiceName.includes('مستعجل') ||
      verifiedServiceName.includes('طوارئ') ||
      verifiedServiceId === '3'

    // 6. Booking Date & Capacity Limits
    const todayCairo = getCairoDateString()
    const bookingDate = date || todayCairo

    const effectiveLimit = resolveEffectiveDailyLimit(clinic, bData, Boolean(clinic.branchesEnabled))
    const warmDay = await getOrHydrateDayFromRoom(clinicId, bookingDate).catch(() => null)
    const dayAppts: Array<Record<string, any>> = warmDay
      ? warmDay.appointments
      : await queryDocumentsByFields('appointments', { clinic_id: clinicId, date: bookingDate }, 250)
    const activeAppts = dayAppts.filter((d) => isAppointmentActive(d.status))

    const activeScoped = effectiveBranchId && effectiveLimit > 0
      ? activeAppts.filter((d) => (d.branch_id || d.branchId || null) === effectiveBranchId)
      : activeAppts

    // Check clinic/branch daily limit and full availability
    const validation = validateBookingAvailability({
      bookingDate,
      clinic,
      branch: bData,
      hasMultipleBranches: Boolean(clinic.branchesEnabled),
      currentActiveBookings: activeScoped.length,
      isRtl: true
    })

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.error,
          isFull: validation.status === 'full',
          status: validation.status,
          limit: validation.effectiveLimit,
          nextAvailableDate: validation.nextAvailableDate || null,
          nextAvailableFormatted: validation.nextAvailableFormatted || null
        },
        { status: 400 }
      )
    }

    // 7. Duplicate Booking Guard (prevents double clicking / accidental multi-submits)
    const cleanPhoneDigits = cleanPhone.replace(/[^0-9]/g, '')
    const existingDuplicate = activeAppts.find((data) => {
      const dPhone = String(data.phone || '').replace(/[^0-9]/g, '')
      const dName = String(data.patientName || '').trim().toLowerCase()
      const dBranch = data.branch_id || data.branchId || null
      const isSameBranch = !effectiveBranchId || !dBranch || dBranch === effectiveBranchId

      return (
        isSameBranch &&
        dPhone === cleanPhoneDigits &&
        dName === cleanName.toLowerCase() &&
        (data.status === 'waiting' || data.status === 'in_progress')
      )
    })

    if (existingDuplicate) {
      return NextResponse.json(
        {
          error: `يوجد حجز مسجل بالفعل لهذا المريض في نفس التاريخ والفرع (تذكرة رقم #${existingDuplicate.queue_number || '--'})`
        },
        { status: 409 }
      )
    }

    // Calculate age if not provided but birthDate exists
    let calculatedAge = age ? String(age).trim() : ''
    if (!calculatedAge && birthDate) {
      const bYear = new Date(birthDate).getFullYear()
      const curYear = new Date().getFullYear()
      if (bYear > 1900 && bYear <= curYear) {
        calculatedAge = String(curYear - bYear)
      }
    }

    // 8. Prepare appointment data with source: 'in_clinic'
    const newAppointmentData = {
      clinic_id: clinicId,
      branch_id: effectiveBranchId || null,
      branchName,
      patientName: cleanName,
      phone: cleanPhone,
      age: calculatedAge || null,
      birthDate: birthDate || null,
      gender: gender || 'أنثى',
      serviceId: verifiedServiceId,
      serviceName: verifiedServiceName,
      servicePrice: verifiedServicePrice,
      isUrgent,
      date: bookingDate,
      time: time || 'حسب الدور',
      status: 'waiting',
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: paymentStatus === 'paid' ? 'paid' : 'unpaid',
      source: 'in_clinic', // explicitly marks as in-clinic booking
      notes: notes ? String(notes).trim() : null,
      patientResidenceSnapshot: residence || null,
      bookedBy: {
        role: userRole,
        name: staff.user.name || 'الاستقبال',
        email: staff.user.email
      },
      createdAt: new Date().toISOString()
    }

    // 9. Atomically allocate queue ticket number with quota protection
    let newApptId: string
    let queueNumber: number
    try {
      const observedMaxQueue = Math.max(
        0,
        ...dayAppts
          .filter((d) => !effectiveBranchId || (d.branch_id || d.branchId) === effectiveBranchId)
          .map((d) => Number(d.queue_number) || 0),
      )
      const atomicRes = await createAtomicAppointmentServer(newAppointmentData, effectiveLimit, activeScoped.length, observedMaxQueue)
      newApptId = atomicRes.id
      queueNumber = atomicRes.queueNumber
    } catch (atomicErr: any) {
      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        const nearest = findNearestAvailableDate({
          requestedDateStr: bookingDate,
          limit: effectiveLimit,
          dailyCounts: { [bookingDate]: effectiveLimit },
          schedule: clinic.weeklySchedule || []
        })
        return NextResponse.json(
          {
            error: CAPACITY_FULL_MESSAGE,
            isFull: true,
            limit: effectiveLimit,
            nextAvailableDate: nearest?.nearestDateStr || null,
            nextAvailableFormatted: nearest?.formattedDate || null
          },
          { status: 400 }
        )
      }
      throw atomicErr
    }

    // 10. Auto-create patient account if missing via server REST
    try {
      const accId = 'patient-' + cleanPhone.replace(/\+/g, '')
      const existingAcc = await readDocument('patient_accounts/' + accId).catch(() => null)
      if (!existingAcc) {
        await writeDocument('patient_accounts/' + accId, {
          clinic_id: clinicId,
          name: cleanName,
          phone: cleanPhone,
          age: calculatedAge || '',
          gender: gender || '',
          createdAt: new Date().toISOString()
        }, true)
      }
    } catch (e) {
      console.warn('Patient account auto update warning:', e)
    }

    // 11. Trigger Staff Notifications then immediately broadcast new booking via Durable Object
    try {
      await createServerNotification({
        clinicId,
        branchId: effectiveBranchId || undefined,
        recipientType: 'staff',
        recipientTarget: clinicId,
        title: 'حجز جديد داخل العيادة',
        body: `تم تسجيل حجز للمريض ${cleanName} (${verifiedServiceName} - دور #${queueNumber})`,
        type: 'new_booking',
        eventId: `in_clinic_booking_${clinicId}_${newApptId}`,
        appointmentId: newApptId
      })
    } catch (e) {
      console.warn('Notification warning:', e)
    }

    const committedAppointment = {
      ...newAppointmentData,
      id: newApptId,
      queue_number: queueNumber,
      updatedAt: newAppointmentData.createdAt,
    }
    await upsertAppointmentInRoom({
      clinicId,
      date: bookingDate,
      appointment: committedAppointment,
      clinic,
      commitIso: newAppointmentData.createdAt,
      notifyChanged: true,
    }).catch(() => null)

    const livePos = calculatePatientLivePosition({
      targetAppointment: {
        id: newApptId,
        queue_number: queueNumber,
        date: bookingDate,
        branch_id: effectiveBranchId,
        serviceId: verifiedServiceId,
        serviceName: verifiedServiceName,
        status: 'waiting'
      },
      allTodayAppointments: [
        ...activeScoped,
        {
          id: newApptId,
          queue_number: queueNumber,
          date: bookingDate,
          branch_id: effectiveBranchId,
          serviceId: verifiedServiceId,
          serviceName: verifiedServiceName,
          status: 'waiting'
        }
      ],
      clinic,
      branch: bData,
      bookingDateStr: bookingDate
    })

    return NextResponse.json({
      success: true,
      appointment: {
        ...committedAppointment,
        id: newApptId,
        queueNumber,
        queue_number: queueNumber,
        aheadCount: livePos.aheadCount,
        effectivePosition: livePos.effectivePosition,
        estimatedWaitMinutes: livePos.estimatedWaitMins,
        estimatedEntranceTime12H: livePos.estimatedEntranceTime12H,
        estimatedEntranceDateTime: livePos.estimatedEntranceDateTime,
        formattedWaitTime: livePos.formattedWaitTime,
        isEstimateConfirmed: livePos.isEstimateConfirmed,
        patientName: cleanName,
        phone: cleanPhone,
        serviceId: verifiedServiceId,
        serviceName: verifiedServiceName,
        servicePrice: verifiedServicePrice,
        branchId: effectiveBranchId,
        branchName,
        date: bookingDate,
        time: time || 'حسب الدور',
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: paymentStatus === 'paid' ? 'paid' : 'unpaid',
        source: 'in_clinic'
      }
    })
  } catch (error: any) {
    console.error('In-clinic booking API error:', error)
    const isQuota = isFirestoreQuotaError(error)
    return NextResponse.json(
      { error: isQuota ? 'الخدمة مزدحمة مؤقتاً، يرجى المحاولة بعد قليل' : (error?.message || 'حدث خطأ في الخادم أثناء تأكيد الحجز') },
      { status: isQuota ? 503 : 500 }
    )
  }
}
