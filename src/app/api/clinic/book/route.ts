import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createClinicNotification } from '@/lib/notificationService'
import { dispatchPatientPushNotification } from '@/lib/pushDispatcher'
import { createAtomicAppointment } from '@/lib/queueService'

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
      time = '10:00 AM'
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
    const nowCairo = new Date()
    const todayCairo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)
    const bookingDate = date || todayCairo

    // Resolve maxDailyBookings from branch (if set) or clinic
    let effectiveLimit = Number(cData.maxDailyBookings) || 0
    if (branchId) {
      try {
        const bDoc = await getDoc(doc(db, 'branches', String(branchId)))
        if (bDoc.exists() && bDoc.data()?.maxDailyBookings) {
          effectiveLimit = Number(bDoc.data()?.maxDailyBookings) || effectiveLimit
        }
      } catch (e) {
        // Fallback to clinic limit
      }
    }

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
    const activeAppts = apptSnap.docs.filter((d) => d.data().status !== 'cancelled')

    const activeScoped = branchId && effectiveLimit > 0
      ? activeAppts.filter((d) => (d.data().branch_id || d.data().branchId || null) === branchId)
      : activeAppts

    // Enforce daily capacity limit immediately
    if (effectiveLimit > 0 && activeScoped.length >= effectiveLimit) {
      return NextResponse.json(
        { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
        { status: 400 }
      )
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
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
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
        return NextResponse.json(
          { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
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

    return NextResponse.json({
      success: true,
      appointmentId: docRef.id,
      queueNumber,
      aheadCount,
      estimatedWaitMinutes: aheadCount * 15,
      date: bookingDate,
      time: String(time),
      branchName: branchName || 'الفرع الرئيسي',
      serviceName: verifiedServiceName,
      servicePrice: verifiedServicePrice
    })
  } catch (err: any) {
    console.error('Error booking appointment:', err)
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء حجز الموعد' },
      { status: 500 }
    )
  }
}
