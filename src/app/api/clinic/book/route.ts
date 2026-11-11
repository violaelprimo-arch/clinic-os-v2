import { NextRequest, NextResponse } from 'next/server'
// firebase client SDK removed - all server operations use firebase-rest
import { readDocument, queryDocuments, writeDocument } from '@/lib/server/firebase-rest'
import { canonicalizeBranches } from '@/lib/branchCanonical'

import { createServerNotification } from '@/lib/server/clinic-notifications'
import { dispatchPatientPushNotification } from '@/lib/pushDispatcher'
import { createAtomicAppointmentServer } from '@/lib/server/firebase-rest'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'
import { calculatePatientLivePosition } from '@/lib/queueCalculations'
import {
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  getCairoDateString,
  findNearestAvailableDate,
  validateBookingAvailability,
  CAPACITY_FULL_MESSAGE
} from '@/lib/bookingCapacity'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      slug = 'zizo',
      patientName,
      patientPhone,
      age,
      birthDate,
      gender,
      serviceId = '1',
      serviceName = 'كشف عادي',
      servicePrice,
      branchId,
      branchName,
      date,
      time = '10:00 AM',
      paymentMethod = 'cash',
      paymentStatus = 'unpaid',
      paymentDetails = null,
      residence = null
    } = body

    if (!patientName || !patientPhone) {
      return NextResponse.json(
        { error: 'الاسم ورقم الهاتف مطلوبان لإتمام الحجز' },
        { status: 400 }
      )
    }

    const cleanPhone = String(patientPhone).replace(/\s+/g, '')
    const cleanName = String(patientName).trim()

    // 1. Resolve clinic by clinicId or slug
    let clinicId = body.clinicId
    let cData: any = null

    if (clinicId && typeof clinicId === 'string') {
      const direct = await readDocument('clinics/' + clinicId)
      if (direct) {
        cData = direct
      }
    }

    if (!cData) {
      const allClinics = await queryDocuments('clinics')
      const found = allClinics.find((c: any) => c.slug === slug || c.id === slug)
      if (found) {
        clinicId = found.id
        cData = found
      }
    }

    if (!cData) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    // 2. Check subscription consistently with doctor access and Cairo timezone.
    if (isClinicSuspended(cData)) {
      return NextResponse.json(
        { error: 'عذراً، اشتراك العيادة منتهي أو تم إيقافها من إدارة المنصة' },
        { status: 403 }
      )
    }

    // Resolve booking date in Cairo timezone
    const todayCairo = getCairoDateString()
    const bookingDate = date || todayCairo

    // Fail closed on unregistered, paused or duplicate branches.
    // A forged POST must never bypass restrictions shown in the patient UI.
    if (typeof branchId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(branchId)) {
      return NextResponse.json({ error: 'يرجى اختيار فرع مسجل ومتاح للحجز' }, { status: 400 })
    }
    const bData = await readDocument(`branches/${branchId}`)
    if (!bData || bData.isArchived === true || bData.isOpen === false) {
      return NextResponse.json({ error: 'الفرع مغلق أو غير متاح للحجز' }, { status: 409 })
    }
    if (![bData.clinicId, bData.clinic_id].includes(clinicId)) {
      return NextResponse.json({ error: 'الفرع المحدد لا يتبع هذه العيادة' }, { status: 403 })
    }
    const allRegistered = await queryDocuments('branches')
    const publishedBranches = canonicalizeBranches(
      allRegistered.filter((b: any) => (b.clinicId === clinicId || b.clinic_id === clinicId))
    )
    if (!publishedBranches.some((b) => b.id === branchId && b.isOpen !== false)) {
      return NextResponse.json({ error: 'يوجد سجل مكرر أو موقوف لهذا الفرع؛ يرجى تحديث الصفحة أو التواصل مع إدارة العيادة' }, { status: 409 })
    }

    // Unified resolution: clinic limit takes precedence for single clinic, sub-branch limit respected in multi-branch
    const effectiveLimit = resolveEffectiveDailyLimit(cData, bData as { maxDailyBookings?: number | string; isMain?: boolean }, Boolean(cData.branchesEnabled))

    // 3. Enforce server-side service price and reject client tampering (A05 - P1 Protection)
    let verifiedServicePrice = 0
    let verifiedServiceName = String(serviceName || 'كشف عيادة')

    if (Array.isArray(cData.services) && cData.services.length > 0) {
      const matched = cData.services.find(
        (s: any) => String(s.id) === String(serviceId) || String(s.name).trim() === String(serviceName).trim()
      )
      if (matched) {
        verifiedServicePrice = Number(matched.price) || 0
        verifiedServiceName = matched.name || verifiedServiceName
      } else {
        return NextResponse.json({ error: 'الخدمة المختارة غير مسجلة في العيادة' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'لا توجد خدمات طبية متاحة للحجز حالياً' }, { status: 409 })
    }

    // 4. Calculate existing active appointments for this date via secure server REST
    const allAppts = await queryDocuments('appointments')
    const activeAppts = allAppts.filter((d: any) =>
      (d.clinic_id === clinicId || d.clinicId === clinicId) &&
      d.date === bookingDate &&
      isAppointmentActive(d.status)
    )

    const activeScoped = branchId && effectiveLimit > 0
      ? activeAppts.filter((d: any) => (d.branch_id || d.branchId || null) === branchId)
      : activeAppts

    // 5. Enforce full booking schedule, hours, and capacity availability
    const validation = validateBookingAvailability({
      bookingDate,
      clinic: cData,
      branch: bData,
      hasMultipleBranches: Boolean(cData.branchesEnabled),
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

    // Duplicate booking protection (accidental double submit within active session)
    const cleanDigits = cleanPhone.replace(/[^0-9]/g, '')
    const existingDuplicate: any = activeAppts.find((d: any) => {
      const dPhone = String(d.phone || '').replace(/[^0-9]/g, '')
      const dName = String(d.patientName || '').trim().toLowerCase()
      const dService = String(d.serviceId || '')
      return (
        dPhone === cleanDigits &&
        dName === cleanName.toLowerCase() &&
        dService === String(serviceId) &&
        (d.status === 'waiting' || d.status === 'in_progress')
      )
    })

    if (existingDuplicate) {
      return NextResponse.json({
        success: true,
        isExisting: true,
        appointmentId: existingDuplicate.id,
        queueNumber: existingDuplicate.queue_number,
        aheadCount: 0,
        date: existingDuplicate.date,
        time: existingDuplicate.time,
        branchName: existingDuplicate.branchName || branchName || 'الفرع الرئيسي',
        serviceName: existingDuplicate.serviceName || verifiedServiceName,
        servicePrice: existingDuplicate.servicePrice || verifiedServicePrice
      })
    }

    const aheadCount = activeScoped.filter(
      (d: any) => d.status === 'waiting' || !d.status
    ).length

    const isUrgent =
      String(verifiedServiceName).includes('مستعجل') ||
      String(verifiedServiceName).includes('طوارئ') ||
      String(serviceId) === '3'

    let calculatedAge = age ? String(age).trim() : ''
    if (!calculatedAge && birthDate) {
      const bYear = new Date(birthDate).getFullYear()
      const curYear = new Date().getFullYear()
      if (bYear > 1900 && bYear <= curYear) {
        calculatedAge = String(curYear - bYear)
      }
    }

    const newAppt = {
      clinic_id: clinicId,
      branch_id: branchId || null,
      branchName: branchName || 'الفرع الرئيسي',
      patientName: cleanName,
      phone: cleanPhone,
      age: calculatedAge || null,
      birthDate: birthDate || null,
      gender: gender || 'أنثى',
      serviceId: String(serviceId),
      serviceName: verifiedServiceName,
      servicePrice: verifiedServicePrice,
      isUrgent,
      date: bookingDate,
      time: String(time),
      status: 'waiting',
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: paymentStatus === 'paid' ? 'paid' : 'unpaid',
      paymentDetails: paymentDetails || null,
      patientResidenceSnapshot: residence || null,
      createdAt: new Date().toISOString()
    }

    // 5. Atomically allocate sequential queue number and verify quota inside single transaction (A06 - P1 Concurrency)
    let newApptId: string
    let queueNumber: number

    try {
      const observedMaxQueue = Math.max(
        0,
        ...allAppts
          .filter((d: any) => (d.clinic_id === clinicId || d.clinicId === clinicId) && d.date === bookingDate)
          .filter((d: any) => !branchId || (d.branch_id || d.branchId) === branchId)
          .map((d: any) => Number(d.queue_number) || 0)
      )
      const atomicRes = await createAtomicAppointmentServer(newAppt, effectiveLimit, activeScoped.length, observedMaxQueue)
      newApptId = atomicRes.id
      queueNumber = atomicRes.queueNumber
    } catch (atomicErr: any) {
      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        const nearest = findNearestAvailableDate({
          requestedDateStr: bookingDate,
          limit: effectiveLimit,
          dailyCounts: { [bookingDate]: effectiveLimit },
          schedule: bData?.weeklySchedule || cData?.weeklySchedule || []
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

    const docRef = { id: newApptId }

    // Auto-create patient account if missing via server REST
    try {
      const existingAccs = await queryDocuments('patient_accounts')
      const foundAcc = existingAccs.find((a: any) =>
        (a.clinic_id === clinicId || a.clinicId === clinicId) &&
        (a.phone === cleanPhone || a.phone === '+' + cleanPhone.replace(/^\+/, ''))
      )
      if (!foundAcc) {
        const accId = 'patient-' + cleanPhone.replace(/\+/g, '')
        await writeDocument('patient_accounts/' + accId, {
          clinic_id: clinicId,
          name: cleanName,
          phone: cleanPhone,
          age: calculatedAge || '',
          createdAt: new Date().toISOString()
        }, true)
      }
    } catch (e) {
      console.warn('Patient account auto creation notice:', e)
    }

    // Trigger clinic notifications
    createServerNotification({
      clinicId,
      branchId,
      recipientTarget: clinicId,
      recipientType: 'staff',
      type: 'new_booking',
      title: 'حجز جديد',
      body: `حجز جديد للمريض ${cleanName} - دور #${queueNumber} (${verifiedServiceName})`,
      eventId: `new_booking_${clinicId}_${docRef.id}`,
      appointmentId: docRef.id
    }).catch((err) => console.error('Failed to persist staff notification:', err))

    // Send push notification
    dispatchPatientPushNotification({
      type: 'booking_confirmed',
      clinicId,
      patientPhone: cleanPhone,
      appointmentId: docRef.id,
      title: 'تم تأكيد حجزك بنجاح ✓',
      body: `مرحباً ${cleanName}، دورك هو #${queueNumber} في عيادة ${cData.name || 'العيادة'}.`,
      url: `/clinic/${slug}/track/${docRef.id}`,
      tag: `booking-${docRef.id}`
    }).catch((err) => console.error('Push notification failed non-blockingly:', err))

    // Compute schedule-anchored queue position and entrance estimate
    const livePos = calculatePatientLivePosition({
      targetAppointment: {
        id: docRef.id,
        queue_number: queueNumber,
        date: bookingDate,
        branch_id: branchId || null,
        serviceId: serviceId ? String(serviceId) : undefined,
        serviceName: verifiedServiceName,
        status: 'waiting'
      },
      allTodayAppointments: [
        ...activeScoped.map((d: any) => ({ id: d.id, ...d })),
        {
          id: docRef.id,
          queue_number: queueNumber,
          date: bookingDate,
          branch_id: branchId || null,
          serviceId: serviceId ? String(serviceId) : undefined,
          serviceName: verifiedServiceName,
          status: 'waiting'
        }
      ],
      clinic: cData,
      branch: bData,
      bookingDateStr: bookingDate
    })

    return NextResponse.json({
      success: true,
      appointmentId: docRef.id,
      id: docRef.id,
      queueNumber,
      aheadCount: livePos.aheadCount,
      effectivePosition: livePos.effectivePosition,
      estimatedWaitMinutes: livePos.estimatedWaitMins,
      estimatedEntranceTime12H: livePos.estimatedEntranceTime12H,
      estimatedEntranceDateTime: livePos.estimatedEntranceDateTime,
      formattedWaitTime: livePos.formattedWaitTime,
      isEstimateConfirmed: livePos.isEstimateConfirmed,
      date: bookingDate,
      time: String(time),
      branchName: branchName || 'الفرع الرئيسي',
      serviceName: verifiedServiceName,
      servicePrice: verifiedServicePrice,
      appointment: {
        id: docRef.id,
        queueNumber,
        aheadCount: livePos.aheadCount,
        date: bookingDate,
        time: String(time),
        branchName: branchName || 'الفرع الرئيسي',
        patientName: cleanName,
        servicePrice: verifiedServicePrice
      }
    })
  } catch (err: any) {
    console.error('Error booking appointment:', err)
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء حجز الموعد' },
      { status: 500 }
    )
  }
}
