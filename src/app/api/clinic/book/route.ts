import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createClinicNotification } from '@/lib/notificationService'
import { dispatchPatientPushNotification } from '@/lib/pushDispatcher'
import { createAtomicAppointment } from '@/lib/queueService'
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
      slug = 'yalla-demo',
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

    // 1. Resolve clinic by slug
    const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(qClinic)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const clinicDoc = cSnap.docs[0]
    const clinicId = clinicDoc.id
    const cData = clinicDoc.data()

    // 2. Enforce clinic active status & subscription validity (A05 - P1 Protection)
    if (cData.isActive === false) {
      return NextResponse.json(
        { error: 'عذراً، هذه العيادة متوقفة حالياً عن استقبال الحجوزات' },
        { status: 403 }
      )
    }

    if (cData.expirationDate) {
      const expDate = new Date(cData.expirationDate)
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        return NextResponse.json(
          { error: 'عذراً، اشتراك هذه العيادة منتهي حالياً، يرجى التواصل مع إدارة العيادة' },
          { status: 403 }
        )
      }
    }

    // Resolve booking date in Cairo timezone
    const todayCairo = getCairoDateString()
    const bookingDate = date || todayCairo

    // Resolve branch details if branchId provided
    let bData: any = null
    if (branchId) {
      try {
        const bDoc = await getDoc(doc(db, 'branches', String(branchId)))
        if (bDoc.exists()) {
          bData = bDoc.data()
        }
      } catch (e) {
        // Fallback
      }
    }

    // Unified resolution: clinic limit takes precedence for single clinic, sub-branch limit respected in multi-branch
    const effectiveLimit = resolveEffectiveDailyLimit(cData, bData, Boolean(cData.branchesEnabled))

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
        verifiedServicePrice = Number(servicePrice) || 0
      }
    } else {
      verifiedServicePrice = Number(servicePrice) || 0
    }

    // 4. Calculate existing active appointments for this date
    const qAppts = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', bookingDate)
    )
    const apptSnap = await getDocs(qAppts)
    const activeAppts = apptSnap.docs.filter((d) => isAppointmentActive(d.data().status))

    const activeScoped = branchId && effectiveLimit > 0
      ? activeAppts.filter((d) => (d.data().branch_id || d.data().branchId || null) === branchId)
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
    const existingDuplicate = activeAppts.find((d) => {
      const data = d.data()
      const dPhone = String(data.phone || '').replace(/[^0-9]/g, '')
      const dName = String(data.patientName || '').trim().toLowerCase()
      const dService = String(data.serviceId || '')
      return (
        dPhone === cleanDigits &&
        dName === cleanName.toLowerCase() &&
        dService === String(serviceId) &&
        (data.status === 'waiting' || data.status === 'in_progress')
      )
    })

    if (existingDuplicate) {
      const dup = existingDuplicate.data()
      return NextResponse.json({
        success: true,
        isExisting: true,
        appointmentId: existingDuplicate.id,
        queueNumber: dup.queue_number,
        aheadCount: 0,
        date: dup.date,
        time: dup.time,
        branchName: dup.branchName || branchName || 'الفرع الرئيسي',
        serviceName: dup.serviceName || verifiedServiceName,
        servicePrice: dup.servicePrice || verifiedServicePrice
      })
    }

    const aheadCount = activeScoped.filter(
      (d) => d.data().status === 'waiting' || !d.data().status
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
      const atomicRes = await createAtomicAppointment(newAppt, effectiveLimit)
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

    // Auto-create patient account if missing
    try {
      const accQ = query(
        collection(db, 'patient_accounts'),
        where('clinic_id', '==', clinicId),
        where('phone', '==', cleanPhone)
      )
      const accSnap = await getDocs(accQ)
      if (accSnap.empty) {
        await addDoc(collection(db, 'patient_accounts'), {
          clinic_id: clinicId,
          name: cleanName,
          phone: cleanPhone,
          age: calculatedAge || '',
          createdAt: new Date().toISOString()
        })
      }
    } catch (e) {
      console.warn('Patient account auto creation notice:', e)
    }

    // Trigger clinic notifications
    createClinicNotification({
      clinicId,
      recipientTarget: clinicId,
      recipientType: 'staff',
      type: 'new_booking',
      title: 'حجز جديد',
      body: `حجز جديد للمريض ${cleanName} - دور #${queueNumber} (${verifiedServiceName})`,
      appointmentId: docRef.id
    }).catch((err) => console.error('Failed to trigger in-app notification:', err))

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
        ...activeScoped.map(d => ({ id: d.id, ...d.data() })),
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
