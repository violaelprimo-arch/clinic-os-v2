import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
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
        { error: 'اسم المريض ورقم الهاتف مطلوبان' },
        { status: 400 }
      )
    }

    const cleanPhone = String(patientPhone).trim().replace(/\s+/g, '')
    const cleanName = String(patientName).trim()

    // 1. Resolve clinic document strictly from database by slug (A05 - P1 Isolation)
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json(
        { error: 'العيادة المطلوبة غير موجودة في النظام' },
        { status: 404 }
      )
    }

    const cDoc = cSnap.docs[0]
    const cData = cDoc.data()
    const clinicId = cDoc.id

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

    const maxLimit = Number(cData.maxDailyBookings) || 0
    const bookingDate = date || new Date().toISOString().split('T')[0]

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

    // 4. Calculate existing queue count for initial aheadCount estimate
    const qAppts = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', bookingDate)
    )
    const apptSnap = await getDocs(qAppts)
    const activeAppts = apptSnap.docs.filter((d) => d.data().status !== 'cancelled')

    const aheadCount = activeAppts.filter(
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
      const atomicRes = await createAtomicAppointment(newAppt, maxLimit)
      newApptId = atomicRes.id
      queueNumber = atomicRes.queueNumber
    } catch (atomicErr: any) {
      if (atomicErr?.message?.startsWith('QUOTA_EXCEEDED')) {
        return NextResponse.json(
          { error: `عذراً، اكتمل الحد الأقصى للحجوزات لهذا اليوم (${maxLimit} كشف)` },
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
      branchId: branchId || undefined,
      recipientType: 'staff',
      recipientTarget: clinicId,
      title: 'حجز جديد مسجل',
      body: `حجز جديد للمريض ${cleanName} برقم دور #${queueNumber}.`,
      type: 'new_booking',
      appointmentId: docRef.id
    }).catch(() => {})

    // Real Web Push dispatch to patient device
    dispatchPatientPushNotification({
      type: 'booking_confirmed',
      appointmentId: docRef.id,
      clinicId,
      branchId: branchId || undefined,
      patientPhone: cleanPhone,
      title: 'تم تأكيد حجزك بنجاح!',
      body: `تم تأكيد حجزك لدى العيادة برقم دور #${queueNumber} (${branchName || 'الفرع الرئيسي'}).`,
      url: `/clinic/${slug}/track/${docRef.id}`,
      tag: `booking-confirmed-${docRef.id}`,
      eventId: `booking_confirmed_${docRef.id}`,
    }).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        appointment: {
          id: docRef.id,
          queueNumber,
          aheadCount,
          date: bookingDate,
          time,
          branchName: branchName || 'الفرع الرئيسي',
          patientName: cleanName,
          servicePrice: verifiedServicePrice
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Booking API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء تسجيل الحجز' },
      { status: 500 }
    )
  }
}
